"""Run from any directory after building frontend with VITE_API_BASE_URL=/api."""
from pathlib import Path
import zipfile
root = Path(__file__).resolve().parents[1]
backend = root / "backend"
dist = root / "frontend" / "dist"
if not (dist / "index.html").is_file():
    raise SystemExit("Build the frontend first.")
output = Path(__file__).parent / "campusplacement.zip"
with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
    for path in backend.glob("*.py"):
        if not path.name.startswith("test_"):
            archive.write(path, path.name)
    archive.write(backend / "requirements.txt", "requirements.txt")
    for path in dist.rglob("*"):
        if path.is_file():
            archive.write(path, "static/" + path.relative_to(dist).as_posix())
print(f"Prepared {output.name}; credentials and local environments are excluded.")
