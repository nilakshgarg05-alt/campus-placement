# CampusPlacement Azure deployment

Website: https://campusplacement-cbd4c7asdgguhhb7.uaenorth-01.azurewebsites.net

This package serves React at `/` and the FastAPI application at `/api`.
The existing Foundry model stays in Foundry; App Service hosts the website and backend.

From `campusplacement-fixed` in PowerShell:

```powershell
Set-Location frontend
$env:VITE_API_BASE_URL = "/api"
npm.cmd run build
Set-Location ..
python deploy/package.py
az webapp deploy -g Campus-Placement-Assistant -n CampusPlacement --src-path deploy/campusplacement.zip --type zip
```

Azure application settings must include `SCM_DO_BUILD_DURING_DEPLOYMENT=true`,
`DB_SERVER`, `DB_NAME`, `AZURE_STORAGE_ACCOUNT`, `FOUNDRY_PROJECT_ENDPOINT`,
`FOUNDRY_AGENT_NAME`, and the private `RECRUITER_SIGNUP_CODE` and `TPO_SIGNUP_CODE`.
Never include `.env` or credentials in the ZIP. Set the startup command to:

```text
python -m uvicorn web:app --host 0.0.0.0 --port 8000
```

The app identity requires placement database data access, Storage Blob Data Contributor
on the project storage account, and Foundry User on the configured Foundry resource.
The process health endpoint is `/health`; `/api/jobs` must return 401 without login.
Database and AI functionality must be checked separately after identity permissions are configured.

## Deployment status

Code was deployed successfully on 2026-09-23 (India time). Managed identity,
storage/Foundry roles, non-secret application settings, and the startup command are configured.
The owner approved database access and `database-access.sql` has been applied.
The SQL principal uses the managed identity's client ID, not its object ID.
Transfer of staff invitation codes still awaits explicit approval.
The website loading and process health checks do not prove database or AI functionality.

Reference: https://learn.microsoft.com/en-us/azure/app-service/configure-language-python

Live checks: invalid credentials now return HTTP 401 instead of HTTP 500.
Database connection errors now have a safe HTTP 503 response with retry guidance.
