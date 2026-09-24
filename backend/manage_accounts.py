"""Run locally by a trusted placement administrator; never exposed as an API."""
import json
import argparse
import getpass
import uuid

from sqlalchemy import select, text
from auth import accounts, sessions, metadata, hash_password
from database import engine
from profiles import details_metadata
from signup import signup_metadata, staff_details
from knowledge import metadata as knowledge_metadata


def main():
    parser = argparse.ArgumentParser(description="Initialize login tables and provision verified campus accounts")
    parser.add_argument("--init", action="store_true", help="Create missing portal account and profile tables")
    parser.add_argument("--role", choices=["student", "recruiter", "tpo"])
    parser.add_argument("--student-id", type=int)
    parser.add_argument("--company-id", type=int, help="Administrator-verified company for a new or previously unlinked recruiter")
    parser.add_argument("--email", help="Required for staff; students use the email in their existing profile")
    parser.add_argument("--reset-password", action="store_true")
    args = parser.parse_args()
    if args.init:
        metadata.create_all(engine)
        details_metadata.create_all(engine)
        signup_metadata.create_all(engine)
        knowledge_metadata.create_all(engine)
        print("Portal account and profile tables are ready. Existing placement records are unchanged.")
    if not args.role:
        if not args.init:
            parser.error("Specify --init or --role")
        return
    if args.role == "student" and not args.student_id:
        parser.error("Student accounts require --student-id")
    if args.role != "student" and (not args.email or args.student_id):
        parser.error("Staff accounts require --email and cannot have --student-id")
    if args.company_id is not None and args.role != "recruiter":
        parser.error("Only recruiters can have --company-id")
    password = getpass.getpass("Password (at least 12 characters): ")
    if not 12 <= len(password) <= 128 or password != getpass.getpass("Confirm password: "):
        parser.error("Passwords must match and contain 12 to 128 characters")
    with engine.begin() as conn:
        email = args.email
        if args.role == "student":
            email = conn.execute(text("SELECT email FROM Students WHERE student_id = :id"),
                                 {"id": args.student_id}).scalar()
        if not email or "@" not in email:
            parser.error("A valid existing student email or staff email is required")
        email = email.strip().lower()
        if args.role == "student":
            from campus_email import is_student_email, MESSAGE
            if not is_student_email(email):
                parser.error(MESSAGE)
        existing = conn.execute(select(accounts).where(accounts.c.email == email)).mappings().first()
        company = None
        details = {}
        if args.role == "recruiter":
            stored = conn.execute(select(staff_details.c.details).where(
                staff_details.c.account_id == existing["account_id"])).scalar_one_or_none() if existing else None
            details = json.loads(stored) if stored else {}
            linked_id = details.get("company_id")
            if linked_id and args.company_id is not None and linked_id != args.company_id:
                parser.error("An existing recruiter company association cannot be changed")
            company_id = linked_id or args.company_id
            if not company_id:
                parser.error("Recruiter accounts require an administrator-verified --company-id")
            company = conn.execute(text("SELECT company_id, company_name FROM Companies WHERE company_id=:id"),
                                   {"id": company_id}).mappings().first()
            if not company:
                parser.error("The specified company does not exist")
        if existing:
            if not args.reset_password or existing["role"] != args.role or existing["student_id"] != args.student_id:
                parser.error("Account already exists. Use --reset-password with the original role and student ID")
            conn.execute(accounts.update().where(accounts.c.account_id == existing["account_id"]).values(
                password_hash=hash_password(password), failed_attempts=0, locked_until=None))
            conn.execute(sessions.delete().where(sessions.c.account_id == existing["account_id"]))
        else:
            if args.student_id and conn.execute(select(accounts).where(accounts.c.student_id == args.student_id)).first():
                parser.error("This student already has a login account")
            account_id = str(uuid.uuid4())
            conn.execute(accounts.insert().values(account_id=account_id, email=email,
                password_hash=hash_password(password), role=args.role, student_id=args.student_id))
        if company:
            account_id = existing["account_id"] if existing else account_id
            details.update(company_id=company["company_id"], organization=company["company_name"], email=email, role="recruiter")
            conn.execute(staff_details.delete().where(staff_details.c.account_id == account_id))
            conn.execute(staff_details.insert().values(account_id=account_id, details=json.dumps(details)))
    print(f"Account ready: {email} ({args.role})")


if __name__ == "__main__":
    main()
