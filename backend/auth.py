"""Database-backed sessions and a deny-by-default API access policy."""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, Integer, MetaData, String, Table, select, text
from starlette.concurrency import run_in_threadpool

from database import engine
from campus_email import is_student_email, MESSAGE

metadata = MetaData()
accounts = Table(
    "PortalAccounts", metadata,
    Column("account_id", String(36), primary_key=True),
    Column("email", String(254), nullable=False, unique=True),
    Column("password_hash", String(200), nullable=False),
    Column("role", String(20), nullable=False),
    Column("student_id", Integer, nullable=True),
    Column("failed_attempts", Integer, nullable=False, default=0),
    Column("locked_until", DateTime, nullable=True),
)
sessions = Table(
    "PortalSessions", metadata,
    Column("token_hash", String(64), primary_key=True),
    Column("account_id", String(36), nullable=False, index=True),
    Column("expires_at", DateTime, nullable=False),
)
router = APIRouter(prefix="/auth", tags=["Authentication"])


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def hash_password(password):
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 600_000)
    return f"pbkdf2_sha256$600000${salt}${digest.hex()}"


def verify_password(password, encoded):
    try:
        _, rounds, salt, expected = encoded.split("$")
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(rounds))
        return hmac.compare_digest(actual.hex(), expected)
    except (ValueError, TypeError):
        return False


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def public_account(account):
    return {key: account[key] for key in ("email", "role", "student_id")}


class Login(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


@router.post("/login")
def login(data: Login):
    email = data.email.strip().lower()
    with engine.begin() as conn:
        account = conn.execute(select(accounts).where(accounts.c.email == email)).mappings().first()
        # Use the same password work for an unknown account to avoid an easy timing oracle.
        encoded = account["password_hash"] if account else "pbkdf2_sha256$600000$unknown$" + "0" * 64
        valid = verify_password(data.password, encoded)
        locked = account and account["locked_until"] and account["locked_until"] > now()
        if account and not locked and not valid:
            failures = account["failed_attempts"] + 1
            conn.execute(accounts.update().where(accounts.c.account_id == account["account_id"]).values(
                failed_attempts=failures if failures < 5 else 0,
                locked_until=now() + timedelta(minutes=15) if failures >= 5 else None,
            ))
        if account and valid and not locked:
            if account["role"] == "student" and not is_student_email(account["email"]):
                raise HTTPException(403, MESSAGE + " Contact your placement team to correct your existing account.")
            conn.execute(accounts.update().where(accounts.c.account_id == account["account_id"]).values(
                failed_attempts=0, locked_until=None))
            token = secrets.token_urlsafe(32)
            conn.execute(sessions.delete().where(sessions.c.expires_at <= now()))
            conn.execute(sessions.insert().values(token_hash=token_hash(token),
                account_id=account["account_id"], expires_at=now() + timedelta(hours=8)))
            return {"token": token, "account": public_account(account)}
    raise HTTPException(401, "Invalid email or password, or account temporarily locked. Contact your placement team if you need access.")


def authenticate(request):
    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(401, "Please sign in to continue")
    with engine.connect() as conn:
        account = conn.execute(select(accounts).join(sessions,
            accounts.c.account_id == sessions.c.account_id).where(
                sessions.c.token_hash == token_hash(token), sessions.c.expires_at > now()
            )).mappings().first()
    if not account:
        raise HTTPException(401, "Your session has expired. Please sign in again")
    if account["role"] == "student" and not is_student_email(account["email"]):
        raise HTTPException(401, MESSAGE + " Contact your placement team to correct your existing account.")
    return dict(account)


@router.get("/me")
def me(request: Request):
    account = public_account(request.state.account)
    if account["role"] != "student":
        from signup import staff_details
        import json
        with engine.connect() as conn:
            row = conn.execute(staff_details.select().where(
                staff_details.c.account_id == request.state.account["account_id"])).mappings().first()
        account["profile"] = json.loads(row["details"]) if row else {}
        if account["role"] == "recruiter":
            from company_access import recruiter_company
            try:
                with engine.connect() as conn:
                    company = recruiter_company(conn, request.state.account)
                account["profile"].update(company_id=company["company_id"], organization=company["company_name"])
            except HTTPException as exc:
                account["profile"]["company_id"] = None
                account["company_error"] = exc.detail

    return account


@router.post("/logout")
def logout(request: Request):
    token = request.headers["authorization"].partition(" ")[2]
    with engine.begin() as conn:
        conn.execute(sessions.delete().where(sessions.c.token_hash == token_hash(token)))
    return {"message": "Signed out"}


# All resource routes must be listed here to be accessible. New routes fail closed.
STUDENT_ROUTES = {
    ("GET", "/students/me"), ("PUT", "/students/me"),
    ("GET", "/students/{student_id}/applications"), ("PUT", "/students/{student_id}"),
    ("GET", "/eligibility/{student_id}/{job_id}"),
    ("GET", "/readiness/{student_id}/{job_id}"),
    ("GET", "/company-preparation/{student_id}/{job_id}"),
    ("POST", "/applications"), ("POST", "/interview/start"),
    ("POST", "/interview/answer"), ("POST", "/interview/finish/{interview_id}"),
    ("GET", "/resume/recommendations"), ("POST", "/resume/analyze"), ("POST", "/resume/generate"),
    ("POST", "/resume/generate-pdf"), ("POST", "/placement-assistant"),
}
STAFF_ROUTES = {
    ("POST", "/knowledge/files"),
    ("PUT", "/auth/profile"),
    ("GET", "/students"), ("GET", "/companies"),
    ("GET", "/jobs/{job_id}/eligible-students"), ("GET", "/jobs/{job_id}/matches"),
    ("GET", "/jobs/{job_id}/ai-matches"), ("POST", "/ai/recruiter-match/{job_id}"),
    ("POST", "/recruiter/jobs"), ("GET", "/jobs/{job_id}/applications"),
    ("PUT", "/applications/{application_id}/status"),
}
TPO_ROUTES = {
    ("POST", "/knowledge/policies"), ("PUT", "/knowledge/policies/{document_id}"),
    ("DELETE", "/knowledge/policies/{document_id}"),
    ("GET", "/tpo/documents"), ("GET", "/tpo/documents/{document_id}"),
    ("GET", "/tpo/documents/{document_id}/download"),
    ("GET", "/tpo/resumes/{resume_id}"), ("GET", "/tpo/resumes/{resume_id}/download"),
    ("GET", "/health/db"), ("GET", "/test-db"),
    ("POST", "/companies"), ("PUT", "/companies/{company_id}"),
    ("DELETE", "/companies/{company_id}"),
    ("GET", "/tpo/dashboard"), ("GET", "/tpo/company-statistics"),
    ("GET", "/tpo/job-statistics"), ("GET", "/tpo/student-status"),
    ("GET", "/tpo/applications"),
}
DOCUMENT_ROUTES = {("GET", "/documents"), ("POST", "/documents/upload"),
                   ("POST", "/document-assistant/query")}


def check_access(account, route, values):
    role = account["role"]
    if route in {("GET", "/knowledge/policies"), ("GET", "/knowledge/jobs/{job_id}"), ("GET", "/auth/me"), ("PUT", "/auth/email"), ("POST", "/auth/logout"), ("GET", "/jobs")}:
        return
    if route in DOCUMENT_ROUTES:
        if route == ("POST", "/documents/upload") and role != "student":
            raise HTTPException(403, "Use campus policy management or attach requirements in the job form")
        if values.get("scope") != role:
            raise HTTPException(403, "This document workspace is not yours")
        if role != "student":
            return
    elif role == "student" and route in STUDENT_ROUTES:
        pass
    elif role in {"recruiter", "tpo"} and route in STAFF_ROUTES:
        if role == "recruiter" and ("job_id" in values or "application_id" in values):
            from company_access import recruiter_company
            with engine.connect() as conn:
                company_id = recruiter_company(conn, account)["company_id"]
                if "application_id" in values:
                    owner = conn.execute(text("""SELECT j.company_id FROM Applications a
                        JOIN Jobs j ON j.job_id = a.job_id WHERE a.application_id=:id"""),
                        {"id": values["application_id"]}).scalar_one_or_none()
                else:
                    owner = conn.execute(text("SELECT company_id FROM Jobs WHERE job_id=:id"),
                                         {"id": values["job_id"]}).scalar_one_or_none()
                if owner != company_id:
                    raise HTTPException(403, "You can access recruitment results only for your company's jobs.")
        return
    elif role == "tpo" and route in TPO_ROUTES:
        return
    else:
        raise HTTPException(403, "You do not have access to this resource")

    if "student_id" in values:
        try:
            owned = int(values["student_id"]) == account["student_id"]
        except (TypeError, ValueError):
            owned = False
        if not owned:
            raise HTTPException(403, "You can only access your own student profile")
    if "interview_id" in values:
        with engine.connect() as conn:
            owner = conn.execute(text("SELECT student_id FROM Interviews WHERE interview_id = :id"),
                                 {"id": values["interview_id"]}).scalar()
        if owner != account["student_id"]:
            raise HTTPException(403, "You can only access your own interviews")


async def authorize(request: Request):
    route = (request.method, request.scope["route"].path)
    if route in {("GET", "/"), ("GET", "/health"), ("POST", "/auth/login"), ("POST", "/auth/signup")}:
        return
    account = await run_in_threadpool(authenticate, request)
    request.state.account = account
    sources = [dict(request.query_params), request.path_params]
    values = dict(request.query_params)
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        form = dict(await request.form())
        sources.append(form)
        values.update(form)
    elif await request.body():
        # FastAPI accepts JSON without Content-Type and with application/*+json.
        # Inspect these too, so they cannot bypass the ownership check.
        try:
            body = await request.json()
        except ValueError:
            raise HTTPException(400, "Invalid JSON")
        if isinstance(body, dict):
            sources.append(body)
            values.update(body)
    values.update(request.path_params)
    # Check every supplied identity, including query IDs on multipart endpoints.
    # A body field must never mask a different student ID used by the endpoint.
    if account["role"] == "student":
        for source in sources:
            if "student_id" in source and str(source["student_id"]) != str(account["student_id"]):
                raise HTTPException(403, "You can only access your own student profile")
    await run_in_threadpool(check_access, account, route, values)
