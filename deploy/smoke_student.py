"""Live isolated student flow; removes only its generated test account and profile."""
import sys, uuid, secrets
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"backend"))
import httpx
import database
from azure.identity import AzureCliCredential
from sqlalchemy import text
database.credential=AzureCliCredential(process_timeout=120)
email="deployment-smoke-"+uuid.uuid4().hex+"@example.invalid"
password=secrets.token_urlsafe(24)
profile=dict(name="Deployment Test",branch="CSE",cgpa=8,backlogs=0,phone="0000000000",skills=["Python"],college="Deployment test",roll_number=uuid.uuid4().hex[:16],graduation_year=2027)
base="https://campusplacement-cbd4c7asdgguhhb7.uaenorth-01.azurewebsites.net/api"
try:
 with httpx.Client(base_url=base,timeout=60) as client:
  response=client.post("/auth/signup",json=dict(profile,email=email,password=password,role="student"))
  assert response.status_code==201, ("signup",response.status_code,response.text[:200])
  print("Student signup passed",flush=True)
  response=client.post("/auth/login",json=dict(email=email,password=password));response.raise_for_status()
  client.headers["Authorization"]="Bearer "+response.json()["token"]
  response=client.get("/students/me");response.raise_for_status()
  assert response.json()["email"]==email
  profile.update(skills=["Python","React"],achievements="Deployment persistence check")
  client.put("/students/me",json=profile).raise_for_status()
  response=client.get("/students/me");response.raise_for_status()
  assert set(response.json()["skills"])=={"Python","React"}
  assert response.json()["achievements"]==profile["achievements"]
  client.get("/jobs").raise_for_status()
  client.get("/knowledge/policies").raise_for_status()
  client.post("/auth/logout").raise_for_status()
  assert client.get("/students/me").status_code==401
  print("Login, profile save/reload, jobs, policies and logout passed",flush=True)
finally:
 with database.engine.begin() as c:
  account=c.execute(text("SELECT account_id,student_id FROM PortalAccounts WHERE email=:email"),{"email":email}).mappings().first()
  if account:
   c.execute(text("DELETE FROM PortalSessions WHERE account_id=:id"),{"id":account["account_id"]})
   c.execute(text("DELETE FROM PortalAccounts WHERE account_id=:id"),{"id":account["account_id"]})
   for table in ("PortalStudentDetails","StudentSkills","Students"):
    c.execute(text(f"DELETE FROM {table} WHERE student_id=:id"),{"id":account["student_id"]})
 print("Temporary smoke-test data removed",flush=True)
