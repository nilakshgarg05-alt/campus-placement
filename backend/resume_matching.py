"""Explainable resume evidence and job targeting; no invented companies or skills."""
import re
from fastapi import HTTPException
from sqlalchemy import text, select
from profiles import read_profile
from knowledge import documents


def mentioned(skill, content):
    # Token boundaries avoid Java matching JavaScript, C matching React, etc.
    return re.search(r"(?<![\w+#])" + re.escape(skill.strip()) + r"(?![\w+#])", content, re.I) is not None


def job_context(conn, job_id):
    row = conn.execute(text("""SELECT j.*, c.company_name FROM Jobs j
        JOIN Companies c ON c.company_id=j.company_id WHERE j.job_id=:id"""), {"id":job_id}).mappings().first()
    if not row:
        raise HTTPException(404, "This job is no longer available")
    job = dict(row)
    job["required_skills"] = list(conn.execute(text("SELECT skill FROM JobSkills WHERE job_id=:id ORDER BY skill"), {"id":job_id}).scalars())
    job["policies"] = [{"document_id":r["document_id"], "title":r["title"], "revision":r["revision"], "content":r["content"][:8000]}
        for r in conn.execute(select(documents).where(documents.c.job_id==job_id, documents.c.active==True)).mappings()][:5]
    return job


def fit(job, profile, content):
    required = list(dict.fromkeys(s.strip() for s in job["required_skills"] if s.strip()))
    matched = [s for s in required if mentioned(s, content)]
    missing = [s for s in required if s not in matched]
    blockers = []
    if float(profile["cgpa"]) < float(job["min_cgpa"] or 0):
        blockers.append(f"Minimum CGPA: {job['min_cgpa']}")
    if profile["backlogs"] > (job["max_backlogs"] or 0):
        blockers.append(f"Maximum backlogs: {job['max_backlogs']}")
    branches = {s.strip().casefold() for s in (job["eligible_branches"] or "").split(",") if s.strip()}
    if branches and not branches.intersection({"all", "any", "*"}) and profile["branch"].strip().casefold() not in branches:
        blockers.append(f"Eligible branches: {job['eligible_branches']}")
    saved_not_shown = [s for s in missing if s.casefold() in {v.casefold() for v in profile["skills"]}]
    return {"job_id":job["job_id"], "company_name":job["company_name"], "job_title":job["job_title"],
        "matched_skills":matched,"missing_skills":missing,"saved_skills_missing_from_resume":saved_not_shown,
        "coverage":round(len(matched)/len(required)*100) if required else None,
        "eligible":not blockers,"eligibility_blockers":blockers,
        "next_steps":[f"Add a truthful project or experience example showing {s}." for s in saved_not_shown]
            + [f"Develop and demonstrate {s} before claiming it." for s in missing if s not in saved_not_shown]}


def recommendations(conn, student_id, resume_text=None):
    profile=read_profile(conn,student_id)
    if resume_text is None:
        resume_text=conn.execute(text("SELECT TOP 1 resume_text FROM Resumes WHERE student_id=:id ORDER BY resume_id DESC"),{"id":student_id}).scalar()
    if not resume_text:
        return {"has_resume":False,"recommendations":[],"other_jobs":[],"method":"Upload a resume to find matching posted jobs."}
    jobs=[]
    job_ids = conn.execute(text("SELECT job_id FROM Jobs")).scalars().all()
    for job_id in job_ids:
        jobs.append(fit(job_context(conn,job_id),profile,resume_text))
    jobs.sort(key=lambda j:(-int(j["eligible"]),-(j["coverage"] or 0),j["company_name"],j["job_id"]))
    return {"has_resume":True,"recommendations":[j for j in jobs if j["eligible"] and j["matched_skills"]],
        "other_jobs":[j for j in jobs if not j["eligible"] or not j["matched_skills"]],
        "method":"Required-skill mentions in your latest uploaded resume, checked against current posted jobs. Academic eligibility uses your saved profile. Keyword coverage is not a selection probability; additional job policies still apply."}
