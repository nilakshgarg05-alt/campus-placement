import json
from fastapi import APIRouter, HTTPException, Request
from pydantic import Field
from sqlalchemy import select, text
from company_access import recruiter_company
from sqlalchemy.exc import IntegrityError
from auth import accounts, sessions, verify_password
from database import engine
from signup import Credentials, StaffFields, staff_details

router = APIRouter(prefix="/auth", tags=["Account profile"])


@router.put("/profile")
def update_staff_profile(data: StaffFields, request: Request):
    account = request.state.account
    with engine.begin() as conn:
        row = conn.execute(select(staff_details).where(staff_details.c.account_id == account["account_id"])).mappings().first()
        details = json.loads(row["details"]) if row else {}
        details.update(data.model_dump())
        details.update(email=account["email"], role=account["role"])
        if account["role"] == "recruiter":
            company = recruiter_company(conn, account)
            if data.organization != company["company_name"]:
                raise HTTPException(403, "Your company is fixed at registration and cannot be changed.")
            conn.execute(text("UPDATE Companies SET recruiter_name=:name, recruiter_email=:email WHERE company_id=:id"),
                         {"name": data.name, "email": account["email"], "id": company["company_id"]})
            details["company_id"] = company["company_id"]
        conn.execute(staff_details.delete().where(staff_details.c.account_id == account["account_id"]))
        conn.execute(staff_details.insert().values(account_id=account["account_id"], details=json.dumps(details)))
    return {"email": account["email"], "role": account["role"], "profile": details}


class EmailCorrection(Credentials):
    # Credentials supplies normalized email validation; password confirms ownership.
    password: str = Field(min_length=1, max_length=128)


@router.put("/email")
def correct_email(data: EmailCorrection, request: Request):
    account = request.state.account
    from campus_email import is_student_email, MESSAGE
    if account["role"] == "student" and not is_student_email(data.email):
        raise HTTPException(422, MESSAGE)
    try:
        with engine.begin() as conn:
            current = conn.execute(select(accounts).where(accounts.c.account_id == account["account_id"])).mappings().one()
            if not verify_password(data.password, current["password_hash"]):
                raise HTTPException(400, "Current password is incorrect")
            if conn.execute(select(accounts.c.account_id).where(accounts.c.email == data.email,
                    accounts.c.account_id != account["account_id"])).first():
                raise HTTPException(409, "This email is already in use")
            existing_student = conn.execute(text("SELECT student_id FROM Students WHERE LOWER(email)=:email"),
                                            {"email": data.email}).scalars().all()
            if any(student_id != current["student_id"] for student_id in existing_student):
                raise HTTPException(409, "This email belongs to an existing student profile")
            if current["role"] == "student":
                conn.execute(text("UPDATE Students SET email=:email WHERE student_id=:id"),
                             {"email": data.email, "id": current["student_id"]})
            else:
                row = conn.execute(select(staff_details).where(staff_details.c.account_id == account["account_id"])).mappings().first()
                details = json.loads(row["details"]) if row else {}
                if current["role"] == "recruiter":
                    # Keep the account's company contact consistent with its corrected login.
                    if details.get("company_id"):
                        conn.execute(text("UPDATE Companies SET recruiter_email=:email WHERE company_id=:id"),
                                     {"email": data.email, "id": details["company_id"]})
                details["email"] = data.email
                conn.execute(staff_details.delete().where(staff_details.c.account_id == account["account_id"]))
                conn.execute(staff_details.insert().values(account_id=account["account_id"], details=json.dumps(details)))
            conn.execute(accounts.update().where(accounts.c.account_id == account["account_id"]).values(email=data.email))
            conn.execute(sessions.delete().where(sessions.c.account_id == account["account_id"]))
    except IntegrityError as exc:
        raise HTTPException(409, "This email is already in use") from exc
    return {"message": "Email updated. Sign in again using your new email."}
