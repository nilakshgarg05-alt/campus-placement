import json
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text, MetaData, Table, Column, Integer, UnicodeText

from database import engine

details_metadata = MetaData()
student_details = Table("PortalStudentDetails", details_metadata,
    Column("student_id", Integer, primary_key=True, autoincrement=False),
    Column("details", UnicodeText, nullable=False))
DETAIL_FIELDS = {"college", "roll_number", "graduation_year", "achievements", "projects", "certifications", "linkedin", "github", "portfolio"}


def read_details(conn, student_id):
    raw = conn.execute(student_details.select().where(student_details.c.student_id == student_id)).mappings().first()
    return json.loads(raw["details"]) if raw else {}


def save_details(conn, student_id, values):
    existing = read_details(conn, student_id)
    existing.update({key: value for key, value in values.items() if key in DETAIL_FIELDS})
    conn.execute(student_details.delete().where(student_details.c.student_id == student_id))
    conn.execute(student_details.insert().values(student_id=student_id, details=json.dumps(existing)))


router = APIRouter(tags=["Student profile"])


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    branch: str = Field(min_length=1, max_length=50)
    cgpa: float = Field(ge=0, le=10, allow_inf_nan=False)
    backlogs: int = Field(ge=0, le=100)
    phone: str = Field(max_length=20)
    skills: list[str] = Field(max_length=50)

    college: str = Field(default="", max_length=200)
    roll_number: str = Field(default="", max_length=50)
    graduation_year: int | None = Field(default=None, ge=1950, le=2100)
    achievements: str = Field(default="", max_length=5000)
    projects: str = Field(default="", max_length=5000)
    certifications: str = Field(default="", max_length=5000)
    linkedin: str = Field(default="", max_length=500)
    github: str = Field(default="", max_length=500)
    portfolio: str = Field(default="", max_length=500)

    @field_validator("linkedin", "github", "portfolio")
    @classmethod
    def validate_links(cls, value):
        value = value.strip()
        if value and not value.startswith(("https://", "http://")):
            raise ValueError("Profile links must start with https:// or http://")
        return value

    @field_validator("name", "branch", "phone", mode="before")
    @classmethod
    def trim_fields(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("skills")
    @classmethod
    def clean_skills(cls, values):
        skills = {}
        for value in values:
            value = value.strip()
            if not value or len(value) > 100:
                raise ValueError("Each skill must contain 1 to 100 characters")
            skills.setdefault(value.casefold(), value)
        return list(skills.values())


def read_profile(conn, student_id):
    student = conn.execute(text("""SELECT student_id, name, email, branch, cgpa, backlogs, phone
        FROM Students WHERE student_id = :id"""), {"id": student_id}).mappings().first()
    if not student:
        raise HTTPException(404, "Student profile not found")
    result = dict(student)
    result["skills"] = list(conn.execute(text(
        "SELECT skill FROM StudentSkills WHERE student_id = :id ORDER BY skill"), {"id": student_id}).scalars())
    result.update(read_details(conn, student_id))
    return result


@router.get("/students/me")
def my_profile(request: Request):
    with engine.connect() as conn:
        return read_profile(conn, request.state.account["student_id"])


def save_profile(student_id, profile):
    with engine.begin() as conn:
        read_profile(conn, student_id)
        conn.execute(text("""UPDATE Students SET name = :name, branch = :branch,
            cgpa = :cgpa, backlogs = :backlogs, phone = :phone WHERE student_id = :id"""),
            {**profile.model_dump(exclude={"skills"}), "id": student_id})
        conn.execute(text("DELETE FROM StudentSkills WHERE student_id = :id"), {"id": student_id})
        if profile.skills:
            conn.execute(text("INSERT INTO StudentSkills (student_id, skill) VALUES (:id, :skill)"),
                         [{"id": student_id, "skill": skill} for skill in profile.skills])
        save_details(conn, student_id, profile.model_dump(exclude_unset=True))
        return read_profile(conn, student_id)


@router.put("/students/me")
def update_my_profile(profile: ProfileUpdate, request: Request):
    return save_profile(request.state.account["student_id"], profile)
