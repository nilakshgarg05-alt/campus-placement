"""Versioned placement knowledge and deterministic BM25 passage retrieval.

Azure SQL stores source text and its chunks; Foundry generates answers from the
retrieved evidence. No external search index or embedding service is required.
"""
import json
import math
import re
import uuid
from collections import Counter
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Boolean, Column, DateTime, Integer, MetaData, String, Table, Unicode, UnicodeText, select, text
from database import engine

metadata = MetaData()
documents = Table("PlacementKnowledge", metadata,
    Column("document_id", String(36), primary_key=True),
    Column("family_id", String(36), nullable=False, index=True),
    Column("kind", String(20), nullable=False),
    Column("job_id", Integer, nullable=True, index=True),
    Column("owner_id", String(36), nullable=False),
    Column("title", Unicode(200), nullable=False),
    Column("filename", Unicode(200), nullable=False),
    Column("content", UnicodeText, nullable=False),
    Column("chunks", UnicodeText, nullable=False),
    Column("revision", Integer, nullable=False),
    Column("active", Boolean, nullable=False),
    Column("updated_at", DateTime, nullable=False))
router = APIRouter(prefix="/knowledge", tags=["Placement knowledge"])


def chunk_text(content, size=1200, overlap=180):
    return [content[start:start + size] for start in range(0, len(content), size - overlap)]


class Policy(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=120000)

    @field_validator("title", "content", mode="before")
    @classmethod
    def trim(cls, value):
        return value.strip() if isinstance(value, str) else value


def public_document(row):
    result = {key: value for key, value in row.items() if key not in {"chunks", "owner_id"}}
    result["updated_at"] = row["updated_at"].replace(tzinfo=timezone.utc).isoformat()
    return result


def save_document(conn, account, kind, title, content, filename="", previous=None):
    document_id = str(uuid.uuid4())
    values = dict(document_id=document_id, family_id=previous["family_id"] if previous else document_id,
        kind=kind, job_id=None, owner_id=account["account_id"], title=title, content=content,
        filename=filename, chunks=json.dumps(chunk_text(content)), revision=previous["revision"] + 1 if previous else 1,
        active=kind == "campus", updated_at=datetime.now(timezone.utc).replace(tzinfo=None))
    conn.execute(documents.insert().values(**values))
    return public_document(values)


@router.get("/policies")
def policies(request: Request):
    query = select(documents).where(documents.c.kind == "campus")
    if request.state.account["role"] != "tpo":
        query = query.where(documents.c.active == True)
    with engine.connect() as conn:
        rows = conn.execute(query.order_by(documents.c.updated_at.desc())).mappings().all()
    return {"policies": [public_document(row) for row in rows]}


@router.post("/policies", status_code=201)
def publish_policy(data: Policy, request: Request):
    with engine.begin() as conn:
        return save_document(conn, request.state.account, "campus", data.title, data.content)


@router.put("/policies/{document_id}")
def revise_policy(document_id: str, data: Policy, request: Request):
    with engine.begin() as conn:
        row = conn.execute(select(documents).where(documents.c.document_id == document_id,
            documents.c.kind == "campus")).mappings().first()
        if not row:
            raise HTTPException(404, "Campus policy not found")
        updated = conn.execute(documents.update().where(documents.c.document_id == document_id,
            documents.c.active == True).values(active=False))
        if not updated.rowcount:
            raise HTTPException(409, "This policy version is no longer active. Refresh and edit the current version.")
        return save_document(conn, request.state.account, "campus", data.title, data.content, previous=row)


@router.delete("/policies/{document_id}")
def archive_policy(document_id: str):
    with engine.begin() as conn:
        result = conn.execute(documents.update().where(documents.c.document_id == document_id,
            documents.c.kind == "campus", documents.c.active == True).values(active=False))
        if not result.rowcount:
            raise HTTPException(404, "Active campus policy not found")
    return {"message": "Policy archived. It will no longer be used for new answers."}


@router.post("/files", status_code=201)
async def index_file(request: Request, kind: Literal["campus", "job"] = Form(...),
                     title: str = Form(...), file: UploadFile = File(...)):
    role = request.state.account["role"]
    if (kind == "campus" and role != "tpo") or (kind == "job" and role not in {"recruiter", "tpo"}):
        raise HTTPException(403, "You cannot publish this type of knowledge")
    from main import _extract_document_text, _safe_filename, MAX_DOCUMENT_BYTES
    payload = await file.read(MAX_DOCUMENT_BYTES + 1)
    if len(payload) > MAX_DOCUMENT_BYTES:
        raise HTTPException(413, "Policy files must be 10 MB or smaller")
    filename = _safe_filename(file.filename or "document")
    content = _extract_document_text(filename, payload, truncate=False)
    if not title.strip() or len(title.strip()) > 200:
        raise HTTPException(422, "Enter a title between 1 and 200 characters")
    with engine.begin() as conn:
        return save_document(conn, request.state.account, kind, title.strip(), content, filename)


def attach_job_documents(conn, ids, job_id, account_id):
    for document_id in dict.fromkeys(ids):
        updated = conn.execute(documents.update().where(documents.c.document_id == document_id,
            documents.c.kind == "job", documents.c.owner_id == account_id,
            documents.c.job_id.is_(None), documents.c.active == False).values(job_id=job_id, active=True))
        if updated.rowcount != 1:
            raise HTTPException(409, "A requirements document is unavailable or belongs to another account. Upload it again.")


@router.get("/jobs/{job_id}")
def job_documents(job_id: int):
    with engine.connect() as conn:
        if not conn.execute(text("SELECT job_id FROM Jobs WHERE job_id=:id"), {"id": job_id}).first():
            raise HTTPException(404, "Job not found")
        rows = conn.execute(select(documents).where(documents.c.job_id == job_id, documents.c.active == True)).mappings().all()
    return {"documents": [public_document(row) for row in rows]}


STOP_WORDS = set("a an the is are was were be to of for in on at by and or from with this that it i me my we you your what how when which can could should would do does about tell please according related need want know".split())


def tokens(value):
    words = [word.rstrip(".") for word in re.findall(r"[a-z0-9+#.]+", value.lower()) if word not in STOP_WORDS and len(word) > 1]
    return [word[:-3] + "y" if word.endswith("ies") else word[:-1] if word.endswith("s") and len(word)>3 else word for word in words]


def rank_passages(question, passages):
    query = set(tokens(question))
    term_lists = [tokens(item["title"] + " " + item["excerpt"]) for item in passages]
    if not term_lists or not query:
        return []
    df = Counter(term for terms in term_lists for term in set(terms))
    average = sum(map(len, term_lists)) / len(term_lists) or 1
    scored = []
    for passage, terms in zip(passages, term_lists):
        counts = Counter(terms)
        score = 0
        for term in query:
            frequency = counts[term]
            if frequency:
                inverse = math.log(1 + (len(term_lists) - df[term] + .5) / (df[term] + .5))
                score += inverse * frequency * 2.5 / (frequency + 1.5 * (.25 + .75 * len(terms) / average))
        if score > 0:
            scored.append({**passage, "retrieval_score": round(score, 4)})
    return sorted(scored, key=lambda item: item["retrieval_score"], reverse=True)


def retrieve(question, job_id=None):
    passages = []
    with engine.connect() as conn:
        jobs = [dict(row._mapping) for row in conn.execute(text("""SELECT j.job_id, j.job_title, j.job_description,
            j.min_cgpa, j.max_backlogs, j.eligible_branches, c.company_name
            FROM Jobs j JOIN Companies c ON j.company_id=c.company_id"""))]
        if job_id is not None and not any(job["job_id"] == job_id for job in jobs):
            raise HTTPException(404, "Selected job not found")
        job_ids = {job["job_id"] for job in jobs}
        rows = conn.execute(select(documents).where(documents.c.active == True)).mappings().all()
        for row in rows:
            if row["kind"] == "job" and (row["job_id"] not in job_ids or (job_id and row["job_id"] != job_id)):
                continue
            for index, excerpt in enumerate(json.loads(row["chunks"])):
                passages.append({"document_id": row["document_id"], "title": row["title"], "kind": row["kind"],
                    "job_id": row["job_id"], "revision": row["revision"], "updated_at": row["updated_at"].isoformat(),
                    "chunk": index + 1, "excerpt": excerpt})
        for job in jobs:
            if job_id and job["job_id"] != job_id:
                continue
            skills = list(conn.execute(text("SELECT skill FROM JobSkills WHERE job_id=:id"), {"id": job["job_id"]}).scalars())
            excerpt = (f"{job['company_name']} - {job['job_title']}\nMinimum CGPA: {job['min_cgpa']}\n"
                f"Maximum backlogs: {job['max_backlogs']}\nEligible branches: {job['eligible_branches']}\n"
                f"Required skills: {', '.join(skills)}\nJob description: {job['job_description'] or ''}")
            passages.append({"document_id": f"job-{job['job_id']}", "title": f"{job['company_name']} - {job['job_title']}",
                "kind": "job_posting", "job_id": job["job_id"], "revision": None, "chunk": 1, "excerpt": excerpt[:6000]})
    ranked = rank_passages(question, passages)
    # Reserve space for both campus rules and job requirements rather than letting
    # one long document crowd the other source type out of the prompt.
    campus = [item for item in ranked if item["kind"] == "campus"][:4]
    job_sources = [item for item in ranked if item["kind"] != "campus"][:4]
    if job_id:
        posting = next(item for item in passages if item["kind"] == "job_posting" and item["job_id"] == job_id)
        if not any(item["document_id"] == posting["document_id"] for item in job_sources):
            job_sources = [posting] + job_sources[:3]
    sources = campus + job_sources
    for index, source in enumerate(sources, 1):
        source["citation"] = f"S{index}"
    return sources, jobs
