"""Smoke tests that don't hit the real LLM."""
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.alerts import ExplainResponse
from app.services import explainer
from app.services.llm import LLMAdapter

client = TestClient(app)


class FakeLLM(LLMAdapter):
    def generate_json(self, prompt, *, schema, system=None, temperature=0.2):
        return {
            "summary": "fake summary",
            "risk_level": "medium",
            "mitre_techniques": ["T1110"],
            "reasoning": "fake reasoning",
        }

    def embed(self, texts):
        return [[0.0] * 8 for _ in texts]


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_root():
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["name"] == "soc-copilot-api"


def test_explain_with_fake_llm():
    result = explainer.explain("dummy log", source="test", llm=FakeLLM())
    assert isinstance(result, ExplainResponse)
    assert result.risk_level == "medium"
    assert "T1110" in result.mitre_techniques


def test_explain_validation_empty_log():
    r = client.post("/api/explain", json={"log": ""})
    assert r.status_code == 422


def test_explain_validation_oversize():
    r = client.post("/api/explain", json={"log": "x" * 25_000})
    assert r.status_code == 422


def test_explain_missing_field():
    r = client.post("/api/explain", json={})
    assert r.status_code == 422
