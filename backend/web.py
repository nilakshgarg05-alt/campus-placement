"""Production entry point: website at / and authenticated API at /api."""
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from main import app as api

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.mount("/api", api)
static = Path(__file__).parent / "static"
if (static / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=static / "assets"), name="assets")

@app.get("/health")
def health():
    return {"status": "ok", "service": "campus-placement"}

@app.get("/{path:path}")
def website(path: str):
    if path == "favicon.svg" and (static / "favicon.svg").is_file():
        return FileResponse(static / "favicon.svg")
    # Only known browser routes fall back to the SPA; never serve backend files.
    allowed = {"", "student", "recruiter", "tpo", "signup/student", "signup/recruiter", "signup/tpo"}
    if path.strip("/") not in allowed:
        raise HTTPException(404, "Not found")
    if not (static / "index.html").is_file():
        raise HTTPException(503, "Website build is missing")
    return FileResponse(static / "index.html", headers={"Cache-Control": "no-store"})
