"""Transactional creation of new accounts and role-specific profiles."""
import json
import os
import re
import secrets
import uuid
from typing import Annotated, Literal, Union

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import Column, Integer, MetaData, String, Table, UnicodeText, select, text
from sqlalchemy.exc import IntegrityError

from auth import accounts, hash_password
from database import engine
from profiles import ProfileUpdate, save_details

signup_metadata = MetaData()
staff_details = Table("PortalStaffDetails", signup_metadata,
    Column("account_id", String(36), primary_key=True),
    Column("details", UnicodeText, nullable=False))
router = APIRouter(prefix="/auth", tags=["Registration"])


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    email: str = Field(max_length=254)
    password: str = Field(min_length=12, max_length=128)

    @field_validator("email")
    @classmethod
    def email_address(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address")
        return value


class StudentSignup(ProfileUpdate, Credentials):
    phone: str = Field(min_length=1, max_length=20)
    role: Literal["student"]
    college: str = Field(min_length=1, max_length=200)
    roll_number: str = Field(min_length=1, max_length=50)
    graduation_year: int = Field(ge=1950, le=2100)

    @field_validator("college", "roll_number", mode="before")
    @classmethod
    def trim_required(cls, value):
        return value.strip() if isinstance(value, str) else value


class StaffFields(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=1, max_length=20)
    organization: str = Field(min_length=1, max_length=200)
    designation: str = Field(min_length=1, max_length=100)
    website: str = Field(default="", max_length=500)
    department: str = Field(default="", max_length=100)

    @field_validator("name", "phone", "organization", "designation", mode="before")
    @classmethod
    def trim_required(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("website")
    @classmethod
    def website_url(cls, value):
        if value and not value.startswith(("https://", "http://")):
            raise ValueError("Website must start with https:// or http://")
        return value


class StaffSignup(StaffFields, Credentials):
    role: Literal["recruiter", "tpo"]
    invitation_code: str = Field(min_length=1, max_length=200)


Signup = Annotated[Union[StudentSignup, StaffSignup], Field(discriminator="role")]


@router.post("/signup", status_code=201)
def signup(data: Signup):
    if data.role != "student":
        expected = os.getenv(f"{data.role.upper()}_SIGNUP_CODE", "")
        if not expected:
            raise HTTPException(503, "Staff registration requires an invitation. Contact your campus administrator.")
        if not secrets.compare_digest(data.invitation_code.encode(), expected.encode()):
            raise HTTPException(403, "Invalid invitation code for this role")
    password_hash = hash_password(data.password)
    account_id = str(uuid.uuid4())
    try:
        with engine.begin() as conn:
            if conn.execute(select(accounts.c.account_id).where(accounts.c.email == data.email)).first():
                raise HTTPException(409, "This email already has an account. Please sign in or contact your placement team.")
            student_id = None
            if data.role == "student":
                if conn.execute(text("SELECT student_id FROM Students WHERE LOWER(email) = :email"), {"email": data.email}).first():
                    raise HTTPException(409, "A student record already exists for this email. Contact your placement team to activate it.")
                # Reflect the existing table so SQLAlchemy returns identity values correctly on Azure SQL.
                students = Table("Students", MetaData(), autoload_with=conn)
                values = data.model_dump(include={"name", "email", "branch", "cgpa", "backlogs", "phone"})
                student_id = conn.execute(students.insert().values(**values).returning(students.c.student_id)).scalar_one()
                if data.skills:
                    conn.execute(text("INSERT INTO StudentSkills (student_id, skill) VALUES (:id, :skill)"),
                                 [{"id": student_id, "skill": skill} for skill in data.skills])
                save_details(conn, student_id, data.model_dump())
            conn.execute(accounts.insert().values(account_id=account_id, email=data.email,
                password_hash=password_hash, role=data.role, student_id=student_id))
            if data.role != "student":
                details = data.model_dump(exclude={"password", "invitation_code"})
                if data.role == "recruiter":
                    companies = Table("Companies", MetaData(), autoload_with=conn)
                    details["company_id"] = conn.execute(companies.insert().values(
                        company_name=data.organization, recruiter_email=data.email, recruiter_name=data.name
                    ).returning(companies.c.company_id)).scalar_one()
                conn.execute(staff_details.insert().values(account_id=account_id, details=json.dumps(details)))
    except IntegrityError as exc:
        raise HTTPException(409, "Registration conflicts with an existing record. Contact your placement team.") from exc
    return {"message": "Account created. You can now sign in.", "role": data.role}
