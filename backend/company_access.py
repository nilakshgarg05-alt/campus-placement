"""Company identity comes only from the stored registration association."""
import json
from fastapi import HTTPException
from sqlalchemy import select, text


def recruiter_company(conn, account):
    from signup import staff_details
    row = conn.execute(select(staff_details.c.details).where(
        staff_details.c.account_id == account["account_id"])).scalar_one_or_none()
    company_id = json.loads(row).get("company_id") if row else None
    if not company_id:
        raise HTTPException(403, "Your account has no verified company association. Contact your placement administrator.")
    company = conn.execute(text("SELECT company_id, company_name FROM Companies WHERE company_id=:id"),
                           {"id": company_id}).mappings().first()
    if not company:
        raise HTTPException(403, "Your registered company is unavailable. Contact your placement administrator.")
    return company
