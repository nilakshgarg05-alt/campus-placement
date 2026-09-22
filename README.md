# Campus Placement Assistant

A campus placement portal for students, recruiters, and placement officers, built with React, FastAPI, Azure SQL, Blob Storage, and Microsoft Foundry.

**Live deployment:** [Open Campus Placement Assistant](https://campusplacement-cbd4c7asdgguhhb7.uaenorth-01.azurewebsites.net/)

## Features

- Student signup, individual accounts, editable profiles and technical skills.
- Recruiters linked to their registered company, company-specific jobs and candidate matching.
- TPO placement oversight and campus policy management.
- Job requirement documents and policy-grounded placement assistance with source citations.
- Database-backed sessions and backend role/ownership checks.

## Project structure

- `frontend/`: React and Vite website.
- `backend/`: FastAPI API, database access, authentication, and AI integration.
- `deploy/`: Azure packaging scripts and deployment instructions.
- `DEPLOYMENT_NOTES.md`: configuration and account administration details.

## Run locally

Requires Python 3.13, Node.js 20 or newer, Microsoft ODBC Driver 18 for SQL Server, and access to the project's Azure resources. Azure SQL must contain the base placement schema; the account initializer adds portal tables but does not create the entire placement database.

In a terminal at the repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
# Fill in .env with your own Azure resource settings and private staff codes.
# Sign in with an Azure identity permitted to access those resources.
az login
python manage_accounts.py --init
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

In another terminal:

```powershell
cd frontend
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run dev
```

## Checks

```powershell
cd backend
python -m pip install -r requirements-dev.txt
python -m unittest -q test_portal
```

In `frontend`, run `npm.cmd run lint` and `npm.cmd run build`. Deployment route tests (`test_web`) require the frontend build.

## Deploy

See [deployment instructions](deploy/README.md) and [configuration notes](DEPLOYMENT_NOTES.md). The production entry point serves the website at `/` and the API at `/api`. Build with `VITE_API_BASE_URL=/api` before packaging.

Credentials, invitation codes, uploaded documents, database contents, dependencies, and deployment logs are intentionally excluded from this repository. Azure resources and their data must be configured separately.
