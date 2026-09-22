# Campus Placement deployment notes

## Login and account setup (required before deploying this update)

The student, recruiter, and TPO workspaces now require login. All business API routes
require a bearer session. `/`, `/health`, `/auth/login`, and `/auth/signup` are public. `/health/db` requires
a TPO session. Deploy the backend and frontend together.

From `backend`, using the configured Azure SQL administrator identity, run:

```powershell
python manage_accounts.py --init
python manage_accounts.py --role student --student-id 1
python manage_accounts.py --role recruiter --email recruiter@your-campus.edu --company-id 1
python manage_accounts.py --role tpo --email placement@your-campus.edu
```

Replace the example student ID and staff emails with verified campus records. The
student command links the account to that existing `Students.student_id` and uses
its email address. Each command prompts for a password (12–128 characters), without
putting passwords in command history. Provision each student separately after
verifying their identity. New users can instead register at `/signup/student`,
`/signup/recruiter`, or `/signup/tpo`. There are no default passwords or
email-only claims of existing profiles. Deliver credentials through your campus's usual
private process. Existing profiles are preserved; accounts are not automatically
created for them. The initializer creates `PortalAccounts`, `PortalSessions`,
`PortalStudentDetails`, and `PortalStaffDetails`. Run `--init` again when upgrading
from the login-only version; existing tables and data are preserved.

To reset a password, repeat the same command with `--reset-password`; this also
revokes existing sessions. To correct an account email, use My Profile and confirm the current password;
the API updates the linked records consistently. Students
can edit their academic details, skills, achievements, projects, certifications,
and profile links. Email correction is a separate password-confirmed action.

New student signup creates a fresh `Students` record, skills, extended profile,
and login account in one transaction. Existing student emails must use administrator
activation so signup cannot take over an existing profile. New student email
addresses are self-reported; this version does not send verification emails.

Recruiter and TPO signup require separate administrator-issued invitation codes.
Set `RECRUITER_SIGNUP_CODE` and `TPO_SIGNUP_CODE` as backend environment settings,
using different unpredictable values (at least 32 random characters). Share each
code privately with authorized staff for that role and rotate it when necessary.
Staff signup is unavailable until its code is configured. These codes are checked
only on the backend and are not stored in submitted profiles or frontend code.
Recruiter signup creates a company record with the submitted recruiter contact;
TPO signup stores the college, designation, department, and contact details.
Professional details are editable in the staff workspace's My Profile tab.

Sessions expire after eight hours and are revoked on sign-out. Passwords use salted
PBKDF2-SHA256; the database stores hashes of session tokens. Five failed attempts
temporarily lock an account for 15 minutes. Use HTTPS in production. The browser
keeps the session in tab-scoped session storage. Authentication tables must be
created before users can sign in; the API runtime does not need table-creation rights.

Profile and skill updates save atomically into the existing `Students` and
`StudentSkills` tables. Matching, readiness, eligibility, preparation, resume
generation, and the placement assistant read those records on each request.
Recruiter candidate and application views refresh every 30 seconds while visible
and when the window regains focus. Existing application statuses and completed
interviews remain historical records; new calculations use the current profile.
Recruiter/TPO accounts retain the existing campus-wide staff access model.

Local regression checks (use a development Python environment with `httpx`):

```powershell
python -m pip install -r requirements-dev.txt
python -m unittest -v test_portal
```

These tests use isolated SQLite fixtures and stub Azure operations. They cover
ownership, staff role restrictions, sessions, multipart uploads, atomic updates,
validation, and fresh matching/application/AI context. SQL Server string
concatenation is translated for the fixtures; validate deployment against Azure SQL
and Foundry in your staging environment as well.

## Backend (Azure App Service / Linux)

Set these application settings:
- `DB_SERVER`
- `DB_NAME`
- `AZURE_STORAGE_ACCOUNT`
- `DOCUMENTS_CONTAINER` (optional; defaults to `placement-documents`)
- `FOUNDRY_PROJECT_ENDPOINT`
- `FOUNDRY_AGENT_NAME` (usually `campusplacement`)
- `CORS_ORIGINS` (comma-separated frontend origins)

Use this startup command:

`uvicorn main:app --host 0.0.0.0 --port 8000`

The backend exposes:
- `/health` — process health check
- `/health/db` — database connectivity check
- `/documents/upload` and `/documents` — placement document library
- `/document-assistant/query` — answers grounded in selected uploaded documents

The document assistant accepts text-based PDF, DOCX, TXT, MD, CSV, and JSON files up to 10 MB. It stores the original upload, extracted text, and metadata in the configured Blob Storage container. Grant the App Service managed identity Blob Data Contributor access to that account.

The Foundry client is initialized lazily, so a temporary Azure identity/configuration issue does not prevent the FastAPI process from starting.

## Frontend

For local development:

`npm install`

`npm run dev`

For production:

`npm run build`
`npm start`

Set `VITE_API_BASE_URL` before `npm run build` when the API URL differs from the fallback in `src/api.js`.

## Azure identity

The backend uses `DefaultAzureCredential`. On Azure App Service, enable a managed identity and grant it the required permissions on:
- Azure SQL
- Azure Storage
- Microsoft Foundry project/agent

Do not commit `.env` or real credentials.

## Profile corrections and TPO upload review

All roles can edit their own profile from My Profile. Recruiter changes update the
linked Companies contact details. A recruiter's company ID is fixed at registration;
profile edits cannot rename or switch the company. Job creation derives this ID
on the server and rejects a different submitted company ID. The job form shows
the registered company as read-only. Email corrections never establish company ownership.
Legacy accounts without an association cannot post until a trusted administrator
verifies their original company and runs `python manage_accounts.py --role recruiter
--email recruiter@your-campus.edu --company-id 1 --reset-password` (replace the example
email and ID). This command prompts for a new password and revokes old sessions.
It refuses to change an association that already exists.

All roles can correct their account email using their current password. The API
updates the login and linked profile/company email in one transaction and revokes
sessions. Sign in again using the corrected email. Password and role are not changed
by profile edits. Contact changes and TPO organization corrections are self-service;
recruiter company identity remains locked.

TPO has a Student & Recruiter Uploads section, with role/search filters, text
previews, original-file downloads, and a refresh button. It includes existing student
and recruiter document-library uploads and resume uploads recorded in Resumes.
New document uploads record uploader identity and upload time. Legacy recruiter
uploads remain labelled as a shared workspace when no uploader metadata exists.
Students retain access only to their own documents; recruiters cannot access the
TPO review endpoints. Existing document-assistant workspaces keep their access rules.
No new database migration is needed for this update. Existing Azure Blob read access
is required for the TPO library and downloads.

## Campus policy and job requirements RAG

Run `python manage_accounts.py --init` for the new `PlacementKnowledge` table.
The table has been initialized in the configured development database for this update.
Deploy frontend and backend together. No embedding service, Azure AI Search resource,
or new API key is needed: Azure SQL stores versioned extracted text and overlapping
chunks; BM25 lexical retrieval selects relevant passages, and the existing Foundry
client generates the answer from those passages. This does not modify the Foundry
agent's separately configured external knowledge base.

TPO: open Campus Policies to publish text or import a text-based document. Editing
publishes a new version atomically and archives the old one. Archived versions remain
visible to TPO for audit, but are excluded from new retrieval. Generic TPO document
uploads are no longer offered. Existing legacy files are not automatically promoted
to official policy: review and publish their contents in Campus Policies.

Recruiter: attach up to five requirement-policy files in Post Job. Files are indexed
as private drafts first; they become available to students only when the job and its
attachments commit successfully. Failed job creation does not expose draft documents.
Previously uploaded generic recruiter documents are not automatically associated with
jobs. The former recruiter Document Assistant tab and generic staff upload endpoint
are removed; existing TPO upload-review access to legacy documents remains.

Students can choose a job in Placement Assistant or search across jobs. Each answer
shows retrieved source excerpts, policy version, and job scope. Related opportunities
include fresh academic eligibility checks. Additional policy terms must still be
reviewed. Campus and job sources are kept distinct in the prompt. If no relevant
passages are found, the assistant says so. Model output without valid source IDs is
withheld in favor of the retrieved passages. Citation validation checks IDs, not the
semantic truth of every generated sentence; review cited evidence for important rules.
Retrieval is lexical BM25, not semantic embedding search. Scanned PDFs need OCR before
upload; documents over 120,000 extracted characters must be split rather than silently
truncated. Source content is data, and prompts explicitly reject instructions within it.

The previous generic assistant prompt's assumption that all campus information already
exists in an external knowledge base has been removed. Published application-managed
policies and live job records are the evidence supplied for student policy/job answers.
Automated tests use isolated fixtures. A separate live synthetic-policy check verified
that the direct deployment follows the supplied evidence and returns structured citations.
Live generation requires existing Azure credentials and the configured project endpoint.

Policy answers deliberately use the model deployment directly, with no agent file-search
tools: live testing found the legacy agent could substitute an older campus policy.
The deployment is discovered from the existing agent's latest definition. Optionally
set `FOUNDRY_MODEL_DEPLOYMENT` to select it explicitly. The response JSON schema restricts
citation IDs to the retrieved sources. If generation is temporarily unavailable, the
UI still displays retrieved passages and related jobs. Other AI tools retain the existing
Foundry agent configuration.
