import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
import web

class WebDeploymentTests(unittest.TestCase):
    def test_website_routes_and_api_authentication(self):
        static = Path(__file__).resolve().parents[1] / "frontend" / "dist"
        self.assertTrue((static / "index.html").is_file(), "Build frontend before deployment tests")
        with patch.object(web, "static", static), TestClient(web.app) as client:
            for route in ["/", "/student", "/recruiter", "/tpo", "/signup/student"]:
                self.assertEqual(client.get(route).status_code, 200)
            self.assertEqual(client.get("/api/health").status_code, 200)
            self.assertEqual(client.get("/api/jobs").status_code, 401)
            self.assertEqual(client.get("/.env").status_code, 404)
            self.assertEqual(client.get("/main.py").status_code, 404)
            self.assertEqual(client.get("/api/nonexistent").status_code, 404)

