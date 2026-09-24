"""Isolated API regressions. No Azure calls or production database writes.

Run: python -m unittest -v test_portal
Requires httpx (the FastAPI TestClient dependency).
"""
import unittest
import json
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient
from fastapi import HTTPException
from sqlalchemy import create_engine, event, text
from sqlalchemy.pool import StaticPool

import auth
import main
import profiles
import signup
import account_profiles
import knowledge
import os


class PortalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.password_hash = auth.hash_password("a-long-test-password")

    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        # SQL Server uses + for string concatenation; SQLite uses ||.
        @event.listens_for(self.engine, "before_cursor_execute", retval=True)
        def concat_sqlite(conn, cursor, statement, parameters, context, executemany):
            if "REPLACE(j.eligible_branches" in statement:
                statement = statement.replace(" + ", " || ")
            if "SELECT TOP 1" in statement:
                statement = statement.replace("SELECT TOP 1", "SELECT", 1).rstrip() + " LIMIT 1"
            return statement, parameters
        knowledge.metadata.create_all(self.engine)
        auth.metadata.create_all(self.engine)
        profiles.details_metadata.create_all(self.engine)
        signup.signup_metadata.create_all(self.engine)
        with self.engine.begin() as conn:
            for ddl in [
                "CREATE TABLE Students (student_id INTEGER PRIMARY KEY, name TEXT, email TEXT, branch TEXT, cgpa REAL, backlogs INTEGER, phone TEXT)",
                "CREATE TABLE StudentSkills (student_id INTEGER, skill TEXT CHECK(skill != 'FAIL_TRANSACTION'))",
                "CREATE TABLE Companies (company_id INTEGER PRIMARY KEY, company_name TEXT, recruiter_email TEXT, recruiter_name TEXT)",
                "CREATE TABLE Jobs (job_id INTEGER PRIMARY KEY, company_id INTEGER, job_title TEXT, min_cgpa REAL, max_backlogs INTEGER, eligible_branches TEXT, job_description TEXT)",
                "CREATE TABLE JobSkills (job_id INTEGER, skill TEXT)",
                "CREATE TABLE Interviews (interview_id INTEGER PRIMARY KEY, student_id INTEGER)",
                "CREATE TABLE Applications (application_id INTEGER PRIMARY KEY, student_id INTEGER, job_id INTEGER, status TEXT, applied_at TEXT)",
                "CREATE TABLE StudentProjects (student_id INTEGER, project_title TEXT, project_description TEXT, technologies TEXT, project_link TEXT)",
                "CREATE TABLE StudentCertifications (student_id INTEGER, certification_name TEXT, issuing_organization TEXT, issue_year INTEGER)",
                "CREATE TABLE Resumes (resume_id INTEGER PRIMARY KEY, student_id INTEGER, ai_analysis TEXT, resume_score REAL, filename TEXT, blob_path TEXT, resume_text TEXT)",
            ]:
                conn.execute(text(ddl))
            conn.execute(text("INSERT INTO Students VALUES (1, 'Alice', 'alice@chitkara.edu.in', 'CSE', 8, 0, ''), (2, 'Bob', 'bob@chitkara.edu.in', 'CSE', 7, 0, '')"))
            conn.execute(text("INSERT INTO StudentSkills VALUES (1, 'Python'), (2, 'Java')"))
            conn.execute(text("INSERT INTO Companies (company_id, company_name) VALUES (1, 'Acme')"))
            conn.execute(text("INSERT INTO Jobs VALUES (1, 1, 'Engineer', 7, 0, 'CSE, IT', 'Build things')"))
            conn.execute(text("INSERT INTO JobSkills VALUES (1, 'Python'), (1, 'React')"))
            conn.execute(text("INSERT INTO Interviews VALUES (10, 1), (20, 2)"))
            conn.execute(text("INSERT INTO Applications VALUES (1, 1, 1, 'Applied', '2026-09-22')"))
            for account_id, role, student_id in [("alice", "student", 1), ("bob", "student", 2), ("recruiter", "recruiter", None), ("tpo", "tpo", None)]:
                conn.execute(auth.accounts.insert().values(account_id=account_id, email=f"{account_id}@chitkara.edu.in",
                    password_hash=self.password_hash, role=role, student_id=student_id))
                conn.execute(auth.sessions.insert().values(token_hash=auth.token_hash(account_id),
                    account_id=account_id, expires_at=auth.now() + timedelta(hours=1)))
            conn.execute(signup.staff_details.insert().values(account_id="recruiter", details=json.dumps({"company_id":1,"organization":"Acme"})))
        self.patches = [patch.object(module, "engine", self.engine) for module in (auth, profiles, main, signup, account_profiles, knowledge)]
        for item in self.patches:
            item.start()
        self.client = TestClient(main.app, raise_server_exceptions=False)
        self.alice = {"Authorization": "Bearer alice"}
        self.recruiter = {"Authorization": "Bearer recruiter"}

    def tearDown(self):
        self.client.close()
        for item in self.patches:
            item.stop()
        self.engine.dispose()

    def profile(self, **changes):
        return {"name": "Alice Updated", "branch": "CSE", "cgpa": 9.1, "backlogs": 0,
                "phone": "9000000000", "skills": ["Python", "React"], **changes}

    def test_signup_cors_supports_both_local_frontend_addresses_and_ports(self):
        for host in ("localhost", "127.0.0.1"):
            for port in (5173, 5174):
                origin = f"http://{host}:{port}"
                headers = {"Origin": origin, "Access-Control-Request-Method": "POST",
                           "Access-Control-Request-Headers": "content-type"}
                response = self.client.options("/auth/signup", headers=headers)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.headers["access-control-allow-origin"], origin)
                response = self.client.post("/auth/signup", headers={"Origin": origin}, json={})
                self.assertEqual(response.status_code, 422)
                self.assertEqual(response.headers["access-control-allow-origin"], origin)

    def test_login_logout_expiry_and_invalid_password(self):
        self.assertEqual(self.client.get("/students/me").status_code, 401)
        self.assertEqual(self.client.post("/auth/login", json={"email": "alice@chitkara.edu.in", "password": "wrong"}).status_code, 401)
        result = self.client.post("/auth/login", json={"email": " ALICE@chitkara.edu.in ", "password": "a-long-test-password"})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertNotIn("password_hash", result.json()["account"])
        headers = {"Authorization": "Bearer " + result.json()["token"]}
        self.assertEqual(self.client.get("/auth/me", headers=headers).json()["student_id"], 1)
        self.assertEqual(self.client.post("/auth/logout", headers=headers).status_code, 200)
        self.assertEqual(self.client.get("/auth/me", headers=headers).status_code, 401)
        with self.engine.begin() as conn:
            conn.execute(auth.sessions.update().values(expires_at=auth.now() - timedelta(seconds=1)))
        self.assertEqual(self.client.get("/students/me", headers=self.alice).status_code, 401)

    def test_failed_passwords_lock_account_and_cannot_assign_role(self):
        for _ in range(5):
            response = self.client.post("/auth/login", json={"email": "alice@chitkara.edu.in", "password": "bad"})
            self.assertEqual(response.status_code, 401)
        self.assertEqual(self.client.post("/auth/login", json={"email": "alice@chitkara.edu.in", "password": "a-long-test-password", "role": "tpo"}).status_code, 401)

    def test_student_cannot_read_or_modify_other_student_or_staff_resources(self):
        for path in ["/students", "/students/2/applications", "/eligibility/2/1", "/readiness/2/1", "/company-preparation/2/1", "/jobs/1/matches", "/jobs/1/eligible-students", "/jobs/1/applications", "/tpo/student-status", "/companies"]:
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path, headers=self.alice).status_code, 403)
        self.assertEqual(self.client.put("/students/2", json=self.profile(), headers=self.alice).status_code, 403)
        for path in ["/applications", "/interview/start", "/resume/generate", "/resume/generate-pdf", "/placement-assistant"]:
            with self.subTest(path=path):
                response = self.client.post(path, headers=self.alice, json={"student_id": 2, "job_id": 1, "question": "Hello"})
                self.assertEqual(response.status_code, 403)
        self.assertEqual(self.client.put("/applications/1/status", json={"status": "Selected"}, headers=self.alice).status_code, 403)
        self.assertEqual(self.client.put("/students/me", json=self.profile(), headers=self.recruiter).status_code, 403)

    def test_interview_and_document_ownership_including_multipart_masking(self):
        self.assertEqual(self.client.post("/interview/answer", headers=self.alice,
            json={"interview_id": 20, "question_id": 1, "answer": "test"}).status_code, 403)
        self.assertEqual(self.client.post("/interview/finish/20", headers=self.alice).status_code, 403)
        for scope, student_id in [("student", 2), ("recruiter", 1), ("tpo", 1)]:
            self.assertEqual(self.client.get(f"/documents?scope={scope}&student_id={student_id}", headers=self.alice).status_code, 403)
        with patch.object(main, "upload_blob") as blob:
            response = self.client.post("/documents/upload", headers=self.alice,
                data={"scope": "student", "student_id": "2"}, files={"file": ("note.txt", b"Private")})
            self.assertEqual(response.status_code, 403)
            response = self.client.post("/resume/analyze?student_id=2", headers=self.alice,
                data={"student_id": "1"}, files={"file": ("resume.pdf", b"test", "application/pdf")})
            self.assertEqual(response.status_code, 403)
            blob.assert_not_called()
            response = self.client.post("/documents/upload", headers=self.alice,
                data={"scope": "student", "student_id": "1"}, files={"file": ("note.txt", b"My notes")})
            self.assertEqual(response.status_code, 200, response.text)
            self.assertIn("documents/student/1/", blob.call_args.args[2])

    def test_content_type_cannot_bypass_body_ownership(self):
        for content_type in [None, "application/vnd.api+json", "application/json; charset=utf-8"]:
            headers = dict(self.alice)
            if content_type:
                headers["Content-Type"] = content_type
            response = self.client.post("/applications", headers=headers,
                content=json.dumps({"student_id": 2, "job_id": 1}))
            self.assertEqual(response.status_code, 403, response.text)
            response = self.client.post("/interview/answer", headers=headers,
                content=json.dumps({"interview_id": 20, "question_id": 1, "answer": "test"}))
            self.assertEqual(response.status_code, 403, response.text)

    def test_saved_profile_changes_matches_readiness_applications_and_ai_context(self):
        before = self.client.get("/jobs/1/matches", headers=self.recruiter).json()
        self.assertEqual(next(item for item in before["matches"] if item["student_id"] == 1)["skill_match"], 50)
        response = self.client.put("/students/me", headers=self.alice, json=self.profile(skills=[" Python ", "React", "react"]))
        self.assertEqual(response.status_code, 200, response.text)
        saved = self.client.get("/students/me", headers=self.alice).json()
        self.assertEqual(saved["name"], "Alice Updated")
        self.assertEqual(saved["skills"], ["Python", "React"])
        self.assertEqual(saved["email"], "alice@chitkara.edu.in")
        bob = self.client.get("/students/me", headers={"Authorization": "Bearer bob"}).json()
        self.assertEqual(bob["name"], "Bob")
        self.assertEqual(bob["skills"], ["Java"])
        matches = self.client.get("/jobs/1/matches", headers=self.recruiter).json()["matches"]
        self.assertEqual(matches[0]["name"], "Alice Updated")
        self.assertEqual(matches[0]["skill_match"], 100)
        readiness = self.client.get("/readiness/1/1", headers=self.alice).json()
        self.assertEqual(readiness["skill_match_percentage"], 100)
        applications = self.client.get("/jobs/1/applications", headers=self.recruiter).json()["applications"]
        self.assertEqual(applications[0]["cgpa"], 9.1)
        self.assertEqual(applications[0]["skills"], ["Python", "React"])
        with patch.object(main, "call_grounded_foundry", return_value=SimpleNamespace(output_text=json.dumps({"answer":"Advice [S1]", "citations":["S1"], "supported":True}))) as ai:
            self.assertEqual(self.client.post("/placement-assistant", headers=self.alice,
                json={"student_id": 1, "question": "What React skills are required for this job?"}).status_code, 200)
            self.assertIn("Alice Updated", ai.call_args.args[0])
            self.assertIn("React", ai.call_args.args[0])
        self.client.put("/students/me", headers=self.alice, json=self.profile(cgpa=5))
        self.assertFalse(self.client.get("/eligibility/1/1", headers=self.alice).json()["eligible"])
        self.assertEqual(self.client.post("/applications", headers=self.alice, json={"student_id": 1, "job_id": 1}).status_code, 400)
        self.assertNotIn(1, [item["student_id"] for item in self.client.get("/jobs/1/matches", headers=self.recruiter).json()["matches"]])

    def test_validation_skill_removal_and_atomic_rollback(self):
        for changes in [{"cgpa": 11}, {"backlogs": -1}, {"backlogs": 1.5}, {"name": "  "}, {"skills": ["x" * 101]}, {"skills": ["x"] * 51}]:
            self.assertEqual(self.client.put("/students/me", headers=self.alice, json=self.profile(**changes)).status_code, 422)
        response = self.client.put("/students/me", headers=self.alice, json=self.profile(skills=["FAIL_TRANSACTION"]))
        self.assertEqual(response.status_code, 500)
        profile = self.client.get("/students/me", headers=self.alice).json()
        self.assertEqual(profile["name"], "Alice")
        self.assertEqual(profile["skills"], ["Python"])
        self.assertEqual(self.client.put("/students/me", headers=self.alice, json=self.profile(skills=[])).status_code, 200)
        self.assertEqual(self.client.get("/students/me", headers=self.alice).json()["skills"], [])

    def test_preparation_resume_generation_and_pdf_use_current_profile(self):
        self.client.put("/students/me", headers=self.alice, json=self.profile(skills=["React"]))
        with patch.object(main, "call_foundry", return_value=SimpleNamespace(output_text="# Alice Updated\n\nReact")) as ai:
            response = self.client.get("/company-preparation/1/1", headers=self.alice)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertIn("Alice Updated", ai.call_args.args[0])
            self.assertIn("['React']", ai.call_args.args[0])
            response = self.client.post("/resume/generate", headers=self.alice, json={"student_id": 1})
            self.assertEqual(response.status_code, 200, response.text)
            self.assertIn("TECHNICAL SKILLS\n['React']", ai.call_args.args[0])
            self.assertIn("CGPA: 9.1", ai.call_args.args[0])
            response = self.client.post("/resume/generate-pdf", headers=self.alice, json={"student_id": 1})
            self.assertEqual(response.status_code, 200, response.text[:200])
            self.assertEqual(response.headers["content-type"], "application/pdf")
            self.assertTrue(response.content.startswith(b"%PDF"))

    def signup_payload(self, **changes):
        return {**self.profile(), "role": "student", "email": "new@chitkara.edu.in",
                "password": "new-password-1234", "college": "Example Institute", "roll_number": "CS101",
                "graduation_year": 2027, "achievements": "Won campus hackathon", "projects": "Built a React portal",
                "certifications": "Cloud fundamentals", "github": "https://github.com/example", **changes}

    def test_student_email_restriction_covers_signup_login_sessions_and_email_changes(self):
        for email in ["outsider@gmail.com", "fake@chitkara.edu.in.evil.test", "fake@sub.chitkara.edu.in", "fake@chitkara.edu", "a@@chitkara.edu.in"]:
            with self.subTest(email=email):
                response=self.client.post("/auth/signup",json=self.signup_payload(email=email))
                self.assertEqual(response.status_code,422,response.text)
        response=self.client.post("/auth/signup",json=self.signup_payload(email=" New3354.BEAI24@CHITKARA.EDU.IN "))
        self.assertEqual(response.status_code,201,response.text)
        response=self.client.post("/auth/login",json={"email":"new3354.beai24@chitkara.edu.in","password":self.signup_payload()["password"]})
        self.assertEqual(response.status_code,200,response.text)
        response=self.client.put("/auth/email",headers=self.alice,json={"email":"outsider@gmail.com","password":"a-long-test-password"})
        self.assertEqual(response.status_code,422)
        with self.engine.begin() as conn:
            conn.execute(auth.accounts.update().where(auth.accounts.c.account_id=="alice").values(email="old@gmail.com"))
            conn.execute(auth.accounts.update().where(auth.accounts.c.account_id=="recruiter").values(email="hr@company.example"))
        self.assertEqual(self.client.post("/auth/login",json={"email":"old@gmail.com","password":"a-long-test-password"}).status_code,403)
        self.assertEqual(self.client.get("/auth/me",headers=self.alice).status_code,401)
        self.assertEqual(self.client.post("/auth/login",json={"email":"hr@company.example","password":"a-long-test-password"}).status_code,200)

    def test_student_signup_creates_owned_profile_and_persists_extended_details(self):
        response = self.client.post("/auth/signup", json=self.signup_payload())
        self.assertEqual(response.status_code, 201, response.text)
        response = self.client.post("/auth/login", json={"email": "new@chitkara.edu.in", "password": "new-password-1234"})
        self.assertEqual(response.status_code, 200, response.text)
        student_id = response.json()["account"]["student_id"]
        headers = {"Authorization": "Bearer " + response.json()["token"]}
        saved = self.client.get("/students/me", headers=headers).json()
        self.assertEqual(saved["achievements"], "Won campus hackathon")
        self.assertEqual(saved["skills"], ["Python", "React"])
        self.assertNotIn("password", saved)
        self.assertEqual(self.client.get("/students/1/applications", headers=headers).status_code, 403)
        response = self.client.put("/students/me", headers=headers, json=self.profile(achievements="Won national hackathon"))
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["college"], "Example Institute")
        matches = self.client.get("/jobs/1/matches", headers=self.recruiter).json()["matches"]
        candidate = next(item for item in matches if item["student_id"] == student_id)
        self.assertEqual(candidate["profile_details"]["achievements"], "Won national hackathon")
        with patch.object(main, "call_foundry", return_value=SimpleNamespace(output_text="Resume")) as ai:
            self.client.post("/resume/generate", headers=headers, json={"student_id": student_id})
            self.assertIn("Won national hackathon", ai.call_args.args[0])

    def test_signup_validation_existing_profiles_and_atomic_creation(self):
        for changes in [{"cgpa": 11}, {"password": "short"}, {"email": "bad"}, {"college": " "},
                        {"student_id": 1}, {"github": "javascript:alert(1)"}, {"graduation_year": 5000}]:
            response = self.client.post("/auth/signup", json=self.signup_payload(**changes))
            self.assertEqual(response.status_code, 422, response.text)
        self.assertEqual(self.client.post("/auth/signup", json=self.signup_payload(email=" ALICE@chitkara.edu.in ")).status_code, 409)
        with self.engine.begin() as conn:
            conn.execute(auth.accounts.delete().where(auth.accounts.c.account_id == "bob"))
        self.assertEqual(self.client.post("/auth/signup", json=self.signup_payload(email="bob@chitkara.edu.in")).status_code, 409)
        self.assertEqual(self.client.post("/auth/signup", json=self.signup_payload(skills=["FAIL_TRANSACTION"])).status_code, 409)
        with self.engine.connect() as conn:
            self.assertEqual(conn.execute(text("SELECT COUNT(*) FROM Students")).scalar(), 2)
        self.assertEqual(self.client.post("/auth/signup", json=self.signup_payload()).status_code, 201)
        self.assertEqual(self.client.post("/auth/signup", json=self.signup_payload()).status_code, 409)

    def test_staff_signup_requires_role_invitation_and_saves_professional_details(self):
        for role in ["recruiter", "tpo"]:
            payload = {"role": role, "name": "New Staff", "email": f"new-{role}@chitkara.edu.in",
                "password": "staff-password-1234", "phone": "9000000000", "organization": "New Organization",
                "designation": "Coordinator", "department": "Placement", "website": "https://example.test",
                "invitation_code": "incorrect"}
            with patch.dict(os.environ, {f"{role.upper()}_SIGNUP_CODE": "verified-invite"}):
                self.assertEqual(self.client.post("/auth/signup", json=payload).status_code, 403)
                payload["invitation_code"] = "verified-invite"
                response = self.client.post("/auth/signup", json=payload)
                self.assertEqual(response.status_code, 201, response.text)
            response = self.client.post("/auth/login", json={"email": payload["email"], "password": payload["password"]})
            headers = {"Authorization": "Bearer " + response.json()["token"]}
            account = self.client.get("/auth/me", headers=headers).json()
            self.assertEqual(account["role"], role)
            self.assertEqual(account["profile"]["organization"], "New Organization")
            self.assertNotIn("invitation_code", account["profile"])
            self.assertNotIn("password", account["profile"])
            if role == "recruiter":
                companies = self.client.get("/companies", headers=headers).json()
                self.assertTrue(any(company["recruiter_email"] == payload["email"] for company in companies))

    def test_recruiter_company_is_immutable_and_job_requests_cannot_impersonate(self):
        payload = {"job_title":"Developer","min_cgpa":7,"max_backlogs":0,
                   "eligible_branches":"CSE","job_description":"Build","skills":["React"]}
        with self.engine.begin() as conn:
            conn.execute(text("INSERT INTO Companies (company_id, company_name, recruiter_email) VALUES (2, 'Other', 'other@chitkara.edu.in')"))
        response = self.client.post("/recruiter/jobs", headers=self.recruiter, json={**payload,"company_id":2})
        self.assertEqual(response.status_code, 403, response.text)
        with self.engine.connect() as conn:
            self.assertEqual(conn.execute(text("SELECT COUNT(*) FROM Jobs")).scalar(), 1)
        response = self.client.post("/recruiter/jobs", headers=self.recruiter, json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        with self.engine.connect() as conn:
            self.assertEqual(conn.execute(text("SELECT company_id FROM Jobs WHERE job_id=:id"), {"id":response.json()["job_id"]}).scalar(), 1)
        profile = {"name":"Recruiter","organization":"Other","designation":"Manager","phone":"12345"}
        self.assertEqual(self.client.put("/auth/profile", headers=self.recruiter, json=profile).status_code, 403)
        self.assertEqual(self.client.get("/auth/me", headers=self.recruiter).json()["profile"]["organization"], "Acme")
        # A login email correction must never acquire a different company's identity.
        response = self.client.put("/auth/email", headers=self.recruiter, json={"email":"other@chitkara.edu.in","password":"a-long-test-password"})
        self.assertEqual(response.status_code, 200)
        with self.engine.connect() as conn:
            details = json.loads(conn.execute(signup.staff_details.select().where(signup.staff_details.c.account_id == "recruiter")).mappings().one()["details"])
            self.assertEqual(details["company_id"], 1)

    def test_administrator_provisioning_preserves_company_association(self):
        import manage_accounts
        args = ["manage_accounts.py", "--role", "recruiter", "--email", "recruiter@chitkara.edu.in", "--reset-password", "--company-id"]
        with patch.object(manage_accounts, "engine", self.engine), patch("getpass.getpass", return_value="a-long-test-password"):
            with patch("sys.argv", args + ["2"]), self.assertRaises(SystemExit):
                manage_accounts.main()
            with self.engine.begin() as conn:
                conn.execute(signup.staff_details.delete())
            with patch("sys.argv", args + ["1"]):
                manage_accounts.main()
            with self.engine.connect() as conn:
                details = json.loads(conn.execute(signup.staff_details.select()).mappings().one()["details"])
                self.assertEqual(details["company_id"], 1)
                self.assertEqual(details["organization"], "Acme")

    def test_recruiter_lists_and_results_are_scoped_to_registered_company(self):
        with self.engine.begin() as conn:
            conn.execute(text("INSERT INTO Companies (company_id, company_name) VALUES (2, 'Other')"))
            conn.execute(text("INSERT INTO Jobs VALUES (2, 2, 'Other role', 7, 0, 'CSE', 'Other company job')"))
            conn.execute(text("INSERT INTO Applications VALUES (2, 1, 2, 'Applied', '2026-09-22')"))
        response = self.client.get("/jobs?company_id=2", headers=self.recruiter)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual([job["job_id"] for job in response.json()], [1])
        for headers in (self.alice, {"Authorization":"Bearer tpo"}):
            self.assertEqual(len(self.client.get("/jobs", headers=headers).json()), 2)
        response = self.client.get("/jobs/1/matches", headers=self.recruiter)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(response.json()["matches"])
        for path, method in [("/jobs/2/matches", "GET"), ("/jobs/2/eligible-students", "GET"),
                             ("/jobs/2/ai-matches", "GET"), ("/ai/recruiter-match/2", "POST"),
                             ("/jobs/2/applications", "GET"), ("/applications/2/status", "PUT")]:
            with self.subTest(path=path):
                response = self.client.request(method, path, headers=self.recruiter, json={"status":"Selected", "job_id":1})
                self.assertEqual(response.status_code, 403, response.text)
        self.assertEqual(self.client.get("/jobs/2/matches", headers={"Authorization":"Bearer tpo"}).status_code, 200)
        with self.engine.connect() as conn:
            self.assertEqual(conn.execute(text("SELECT status FROM Applications WHERE application_id=2")).scalar(), "Applied")

    def test_unlinked_recruiter_cannot_self_assign_company(self):
        with self.engine.begin() as conn:
            conn.execute(signup.staff_details.delete())
        payload = {"company_id":1,"job_title":"Developer","min_cgpa":7,"max_backlogs":0,
                   "eligible_branches":"CSE","job_description":"Build","skills":[]}
        self.assertEqual(self.client.post("/recruiter/jobs", headers=self.recruiter, json=payload).status_code, 403)
        self.assertIsNone(self.client.get("/auth/me", headers=self.recruiter).json()["profile"]["company_id"])
        self.assertEqual(self.client.put("/auth/profile", headers=self.recruiter, json={"name":"R","organization":"Acme","designation":"Manager","phone":"123"}).status_code,403)

    def test_staff_profiles_edit_only_their_own_details_and_sync_company(self):
        payload = {"name": "Corrected Recruiter", "organization": "Acme", "designation": "Hiring Manager",
                   "phone": "12345", "website": "https://example.test", "department": "People"}
        response = self.client.put("/auth/profile", headers=self.recruiter, json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.get("/auth/me", headers=self.recruiter).json()["profile"]["name"], payload["name"])
        companies = self.client.get("/companies", headers=self.recruiter).json()
        self.assertTrue(any(item["company_name"] == "Acme" for item in companies))
        response = self.client.put("/auth/profile", headers={"Authorization": "Bearer tpo"}, json={**payload, "name": "Corrected TPO"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.get("/auth/me", headers=self.recruiter).json()["profile"]["name"], payload["name"])
        self.assertEqual(self.client.put("/auth/profile", headers=self.alice, json=payload).status_code, 403)
        self.assertEqual(self.client.put("/auth/profile", headers=self.recruiter, json={**payload,"company_id":1}).status_code, 422)
        self.assertEqual(self.client.put("/auth/profile", headers=self.recruiter, json={**payload,"role":"tpo"}).status_code, 422)

    def test_email_corrections_require_password_update_identity_and_revoke_sessions(self):
        response = self.client.put("/auth/email", headers=self.alice, json={"email":"fixed@chitkara.edu.in","password":"wrong"})
        self.assertEqual(response.status_code, 400)
        response = self.client.put("/auth/email", headers=self.alice, json={"email":"bob@chitkara.edu.in","password":"a-long-test-password"})
        self.assertEqual(response.status_code, 409)
        for account_id in ("alice", "recruiter", "tpo"):
            email = f"fixed-{account_id}@chitkara.edu.in"
            response = self.client.put("/auth/email", headers={"Authorization":f"Bearer {account_id}"},
                json={"email":email,"password":"a-long-test-password"})
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(self.client.get("/auth/me", headers={"Authorization":f"Bearer {account_id}"}).status_code, 401)
            response = self.client.post("/auth/login", json={"email":email,"password":"a-long-test-password"})
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()["account"]["email"], email)
        with self.engine.connect() as conn:
            self.assertEqual(conn.execute(text("SELECT email FROM Students WHERE student_id=1")).scalar(), "fixed-alice@chitkara.edu.in")

    def test_tpo_can_review_documents_and_resumes_but_other_roles_cannot(self):
        blobs = {}
        def upload(payload, container, name):
            blobs[(container,name)] = payload
        def download(container,name):
            return blobs[(container,name)]
        def listing(container,prefix):
            return [name for stored_container,name in blobs if stored_container == container and name.startswith(prefix)]
        tpo = {"Authorization":"Bearer tpo"}
        with patch.object(main,"upload_blob",side_effect=upload), patch.object(main,"download_blob",side_effect=download), patch.object(main,"list_blob_names",side_effect=listing):
            for headers,scope in [(self.alice,"student"),(self.recruiter,"recruiter")]:
                response = self.client.post("/documents/upload", headers=headers,
                    data={"scope":scope, **({"student_id":1} if scope=="student" else {})}, files={"file":(f"{scope}.txt",b"Uploaded content")})
                if scope == "recruiter":
                    self.assertEqual(response.status_code, 403)
                    legacy_id="11111111-1111-4111-8111-111111111111"
                    prefix=f"documents/recruiter/shared/{legacy_id}"
                    blobs[(main.DOCUMENT_CONTAINER,prefix+"/metadata.json")] = json.dumps({"document_id":legacy_id,"filename":"recruiter.txt","scope":"recruiter","student_id":None}).encode()
                    blobs[(main.DOCUMENT_CONTAINER,prefix+"/content.txt")] = b"Legacy recruiter content"
                    blobs[(main.DOCUMENT_CONTAINER,prefix+"/source.txt")] = b"Legacy recruiter content"
                else:
                    self.assertEqual(response.status_code, 200, response.text)
            with self.engine.begin() as conn:
                conn.execute(text("INSERT INTO Resumes (resume_id,student_id,filename,blob_path,resume_text) VALUES (1,1,'resume.pdf','1/resume.pdf','Resume text')"))
            blobs[("resumes","1/resume.pdf")] = b"%PDF-test"
            response = self.client.get("/tpo/documents", headers=tpo)
            self.assertEqual(response.status_code, 200, response.text)
            items=response.json()["documents"]
            self.assertEqual(len(items),3)
            self.assertEqual({item["scope"] for item in items},{"student","recruiter"})
            for item in items:
                if item["kind"] == "resume":
                    url="/tpo/resumes/1"
                    query=""
                else:
                    url=f"/tpo/documents/{item['document_id']}"
                    query=f"?scope={item['scope']}" + ("&student_id=1" if item["scope"]=="student" else "")
                self.assertEqual(self.client.get(url+query,headers=tpo).status_code,200)
                downloaded=self.client.get(url+"/download"+query,headers=tpo)
                self.assertEqual(downloaded.status_code,200)
                self.assertIn("attachment",downloaded.headers["content-disposition"])
                for headers in (self.alice,self.recruiter):
                    self.assertEqual(self.client.get(url+query,headers=headers).status_code,403)
                    self.assertEqual(self.client.get(url+"/download"+query,headers=headers).status_code,403)
            for headers in (self.alice,self.recruiter):
                self.assertEqual(self.client.get("/tpo/documents",headers=headers).status_code,403)
            own=self.client.get("/documents?scope=student&student_id=1",headers=self.alice).json()["documents"]
            self.assertEqual(len(own),1)
            self.assertEqual(own[0]["uploaded_by"],"alice@chitkara.edu.in")

    def test_campus_policy_versions_archiving_and_role_permissions(self):
        tpo={"Authorization":"Bearer tpo"}
        payload={"title":"Attendance policy","content":"Minimum placement attendance is 75 percent."}
        for headers in (self.alice,self.recruiter):
            self.assertEqual(self.client.post("/knowledge/policies",headers=headers,json=payload).status_code,403)
        created=self.client.post("/knowledge/policies",headers=tpo,json=payload)
        self.assertEqual(created.status_code,201,created.text)
        policy=created.json()
        sources,_=knowledge.retrieve("attendance policy")
        self.assertTrue(any("75 percent" in source["excerpt"] for source in sources))
        updated=self.client.put(f"/knowledge/policies/{policy['document_id']}",headers=tpo,json={**payload,"content":"Minimum placement attendance is 85 percent."})
        self.assertEqual(updated.status_code,200,updated.text)
        self.assertEqual(updated.json()["revision"],2)
        self.assertEqual(self.client.put(f"/knowledge/policies/{policy['document_id']}",headers=tpo,json=payload).status_code,409)
        sources,_=knowledge.retrieve("attendance policy")
        self.assertFalse(any("75 percent" in source["excerpt"] for source in sources))
        self.assertTrue(any("85 percent" in source["excerpt"] for source in sources))
        self.assertEqual(len(self.client.get("/knowledge/policies",headers=self.alice).json()["policies"]),1)
        self.assertEqual(len(self.client.get("/knowledge/policies",headers=tpo).json()["policies"]),2)
        self.assertEqual(self.client.delete(f"/knowledge/policies/{updated.json()['document_id']}",headers=tpo).status_code,200)
        self.assertEqual(knowledge.retrieve("attendance")[0],[])

    def test_job_requirement_drafts_publish_atomically_with_job_and_scope(self):
        response=self.client.post("/knowledge/files",headers=self.recruiter,data={"kind":"job","title":"Selection stages"},files={"file":("requirements.txt",b"Selection includes an aptitude round and a technical interview.")})
        self.assertEqual(response.status_code,201,response.text)
        draft=response.json()
        self.assertEqual(knowledge.retrieve("aptitude")[0],[])
        payload={"company_id":1,"job_title":"New Developer","min_cgpa":7,"max_backlogs":0,"eligible_branches":"CSE","job_description":"New development role","skills":["React"],"knowledge_document_ids":[draft["document_id"]]}
        response=self.client.post("/recruiter/jobs",headers={"Authorization":"Bearer tpo"},json=payload)
        self.assertEqual(response.status_code,409,response.text)
        with self.engine.connect() as conn:
            self.assertEqual(conn.execute(text("SELECT COUNT(*) FROM Jobs")).scalar(),1)
        response=self.client.post("/recruiter/jobs",headers=self.recruiter,json=payload)
        self.assertEqual(response.status_code,200,response.text)
        job_id=response.json()["job_id"]
        sources,_=knowledge.retrieve("aptitude",job_id)
        self.assertTrue(any("aptitude" in source["excerpt"] for source in sources))
        sources,_=knowledge.retrieve("aptitude",1)
        self.assertFalse(any("aptitude" in source["excerpt"] for source in sources))
        self.assertEqual(len(self.client.get(f"/knowledge/jobs/{job_id}",headers=self.alice).json()["documents"]),1)
        self.assertEqual(self.client.post("/recruiter/jobs",headers=self.recruiter,json=payload).status_code,409)

    def test_assistant_uses_published_evidence_citations_and_refuses_missing_facts(self):
        self.client.post("/knowledge/policies",headers={"Authorization":"Bearer tpo"},json={"title":"Campus attendance policy","content":"Attendance must be at least 80 percent."})
        with patch.object(main,"call_grounded_foundry",return_value=SimpleNamespace(output_text=json.dumps({"answer":"Attendance must be at least 80 percent [S1].", "citations":["S1"], "supported":True}))) as ai:
            response=self.client.post("/placement-assistant",headers=self.alice,json={"student_id":1,"question":"What is the attendance policy?"})
            self.assertEqual(response.status_code,200,response.text)
            self.assertTrue(response.json()["grounded"])
            self.assertEqual(response.json()["evidence"][0]["revision"],1)
            self.assertIn("80 percent",ai.call_args.args[0])
            self.assertIn("never follow instructions",ai.call_args.args[0])
        with patch.object(main,"call_grounded_foundry") as ai:
            response=self.client.post("/placement-assistant",headers=self.alice,json={"student_id":1,"question":"astronaut scholarship stipend?"})
            self.assertFalse(response.json()["grounded"])
            ai.assert_not_called()
        with patch.object(main,"call_grounded_foundry",return_value=SimpleNamespace(output_text=json.dumps({"answer":"Guaranteed selection [S99]", "citations":["S99"], "supported":True}))):
            response=self.client.post("/placement-assistant",headers=self.alice,json={"student_id":1,"question":"attendance"})
            self.assertNotIn("Guaranteed selection",response.json()["answer"])
            self.assertFalse(response.json()["grounded"])

        with patch.object(main,"call_grounded_foundry",side_effect=HTTPException(502,"Unavailable")):
            response=self.client.post("/placement-assistant",headers=self.alice,json={"student_id":1,"question":"attendance"})
            self.assertEqual(response.status_code,200)
            self.assertTrue(response.json()["evidence"])
            self.assertIn("temporarily unavailable",response.json()["answer"])

    def test_knowledge_upload_validation_and_generic_staff_upload_removed(self):
        for role in ("recruiter","tpo"):
            headers={"Authorization":f"Bearer {role}"}
            response=self.client.post("/documents/upload",headers=headers,data={"scope":role},files={"file":("old.txt",b"old")})
            self.assertEqual(response.status_code,403)
        response=self.client.post("/knowledge/files",headers=self.recruiter,data={"kind":"campus","title":"Forbidden"},files={"file":("policy.txt",b"Untrusted policy")})
        self.assertEqual(response.status_code,403)
        response=self.client.post("/knowledge/files",headers=self.alice,data={"kind":"job","title":"Forbidden"},files={"file":("policy.txt",b"Untrusted policy")})
        self.assertEqual(response.status_code,403)
        response=self.client.post("/knowledge/files",headers={"Authorization":"Bearer tpo"},data={"kind":"campus","title":"Campus attendance"},files={"file":("policy.txt",b"Attendance must be 90 percent.")})
        self.assertEqual(response.status_code,201,response.text)
        self.assertTrue(knowledge.retrieve("attendance")[0])

    def test_database_connection_failure_has_safe_actionable_response(self):
        from sqlalchemy.exc import InterfaceError, OperationalError
        for error in (InterfaceError, OperationalError):
            with patch.object(auth.engine, "begin", side_effect=error("secret SQL", {}, Exception("private connection details"))):
                response = self.client.post("/auth/login", json={"email":"test@chitkara.edu.in", "password":"test-password"})
            self.assertEqual(response.status_code, 503)
            self.assertIn("database is temporarily unavailable", response.json()["detail"])
            self.assertNotIn("private", response.text)
            self.assertNotIn("secret", response.text)
            self.assertEqual(response.headers["Retry-After"], "30")

    def test_local_database_firewall_error_has_actionable_response(self):
        from sqlalchemy.exc import ProgrammingError
        with patch.object(auth.engine,"begin",side_effect=ProgrammingError("",{},Exception("40615 private server details"))):
            response=self.client.post("/auth/login",json={"email":"test@chitkara.edu.in","password":"test"})
        self.assertEqual(response.status_code,503)
        self.assertIn("current network",response.json()["detail"])
        self.assertNotIn("private",response.text)

    def test_resume_upload_returns_and_persists_own_job_recommendations(self):
        from io import BytesIO
        from reportlab.pdfgen import canvas
        pdf=BytesIO();page=canvas.Canvas(pdf);page.drawString(72,700,"Python projects and web development");page.save()
        with patch.object(main,"upload_blob"), patch.object(main,"call_foundry",return_value=SimpleNamespace(output_text="Resume Score: 75/100")):
            response=self.client.post("/resume/analyze?student_id=1",headers=self.alice,files={"file":("cv.pdf",pdf.getvalue(),"application/pdf")})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()["recommendations"][0]["matched_skills"],["Python"])
        refreshed=self.client.get("/resume/recommendations",headers=self.alice).json()
        self.assertEqual(refreshed["recommendations"],response.json()["recommendations"])
        self.assertFalse(self.client.get("/resume/recommendations",headers={"Authorization":"Bearer bob"}).json()["has_resume"])

    def test_resume_recommendations_use_uploaded_evidence_and_current_eligibility(self):
        with self.engine.begin() as conn:
            conn.execute(text("INSERT INTO Resumes (student_id,resume_text) VALUES (1,'Python project with JavaScript'), (2,'React')"))
            conn.execute(text("INSERT INTO JobSkills VALUES (1,'Java')"))
        result=self.client.get("/resume/recommendations",headers=self.alice)
        self.assertEqual(result.status_code,200,result.text)
        job=result.json()["recommendations"][0]
        self.assertEqual(job["matched_skills"],["Python"])
        self.assertIn("Java",job["missing_skills"])
        self.client.put("/students/me",headers=self.alice,json=self.profile(cgpa=6,skills=["Python","React"]))
        result=self.client.get("/resume/recommendations",headers=self.alice).json()
        self.assertEqual(result["recommendations"],[])
        job=result["other_jobs"][0]
        self.assertFalse(job["eligible"])
        self.assertEqual(job["saved_skills_missing_from_resume"],["React"])
        self.assertEqual(self.client.get("/resume/recommendations?student_id=2",headers=self.alice).status_code,403)
        self.assertEqual(self.client.get("/resume/recommendations",headers=self.recruiter).status_code,403)

    def test_targeted_resume_includes_selected_published_job_policies(self):
        with self.engine.begin() as conn:
            doc=knowledge.save_document(conn,{"account_id":"recruiter"},"job","Interview rounds","Bring a portfolio of backend projects.")
            knowledge.attach_job_documents(conn,[doc["document_id"]],1,"recruiter")
            knowledge.save_document(conn,{"account_id":"recruiter"},"job","Unpublished draft","DRAFT MUST NOT APPEAR")
            old=knowledge.save_document(conn,{"account_id":"recruiter"},"job","Old policy","ARCHIVED MUST NOT APPEAR")
            knowledge.attach_job_documents(conn,[old["document_id"]],1,"recruiter")
            conn.execute(knowledge.documents.update().where(knowledge.documents.c.document_id==old["document_id"]).values(active=False))
        with patch.object(main,"call_foundry",return_value=SimpleNamespace(output_text="# Alice\nPython projects")) as ai:
            response=self.client.post("/resume/generate",headers=self.alice,json={"student_id":1,"job_id":1})
            self.assertEqual(response.status_code,200,response.text)
            prompt=ai.call_args.args[0]
            self.assertIn("Acme",prompt)
            self.assertIn("Bring a portfolio",prompt)
            self.assertNotIn("DRAFT MUST NOT APPEAR",prompt)
            self.assertNotIn("ARCHIVED MUST NOT APPEAR",prompt)
            self.assertIn("A job requirement",prompt)
            self.assertEqual(response.json()["target_fit"]["missing_skills"],["React"])
            ai.reset_mock()
            response=self.client.post("/resume/generate",headers=self.alice,json={"student_id":1,"job_id":999})
            self.assertEqual(response.status_code,404)
            ai.assert_not_called()

    def test_resume_pdf_exports_preview_without_second_ai_generation(self):
        from io import BytesIO
        from pypdf import PdfReader
        with patch.object(main,"call_foundry") as ai:
            response=self.client.post("/resume/generate-pdf",headers=self.alice,json={"student_id":1,"job_id":1,"resume_text":"# Alice\nUnique reviewed wording"})
            self.assertEqual(response.status_code,200,response.text[:150])
            ai.assert_not_called()
            content="".join(page.extract_text() for page in PdfReader(BytesIO(response.content)).pages)
            self.assertIn("Unique reviewed wording",content)

    def test_every_business_route_requires_authentication(self):
        # OpenAPI includes router endpoints even on FastAPI versions with lazy included routers.
        for path, methods in main.app.openapi()["paths"].items():
            for method in methods:
                if path in {"/", "/health", "/auth/login", "/auth/signup"}:
                    continue
                resolved = path
                for parameter in ("student_id", "job_id", "application_id", "company_id", "interview_id"):
                    resolved = resolved.replace("{" + parameter + "}", "1")
                with self.subTest(path=path, method=method):
                    self.assertEqual(self.client.request(method, resolved).status_code, 401)


if __name__ == "__main__":
    unittest.main()
