"""Smoke tests that don't hit the real LLM or DB."""
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.alerts import ExplainResponse, RecommendResponse
from app.services import explainer, recommender
from app.services.llm import LLMAdapter


class FakeExplainLLM(LLMAdapter):
    def generate_json(self, prompt, *, schema, system=None, temperature=0.2):
        return {
            "summary": "fake summary",
            "risk_level": "medium",
            "mitre_techniques": ["T1110"],
            "reasoning": "fake reasoning",
        }

    def embed(self, texts):
        return [[0.0] * 8 for _ in texts]


class FakeRecommendLLM(LLMAdapter):
    def generate_json(self, prompt, *, schema, system=None, temperature=0.2):
        return {
            "actions": [
                {"title": "Block IP", "detail": "iptables -A INPUT -s X -j DROP", "rationale": "stops attacker"},
                {"title": "Check accounts", "detail": "audit auth.log", "rationale": "find compromise"},
            ],
            "priority": "high",
            "learning_notes": "Brute force responses always start with containment.",
        }

    def embed(self, texts):
        return [[0.0] * 8 for _ in texts]


client = TestClient(app)


# ─── Health / wiring ────────────────────────────────────────────────────────


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_root():
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["name"] == "soc-copilot-api"


# ─── Service-level (no HTTP, no DB) ─────────────────────────────────────────


def test_explain_with_fake_llm():
    result = explainer.explain("dummy log", source="test", llm=FakeExplainLLM())
    assert isinstance(result, ExplainResponse)
    assert result.risk_level == "medium"
    assert "T1110" in result.mitre_techniques


def test_recommend_with_fake_llm():
    result = recommender.recommend("dummy log", llm=FakeRecommendLLM())
    assert isinstance(result, RecommendResponse)
    assert result.priority == "high"
    assert len(result.actions) == 2


# ─── HTTP validation paths (no LLM, no DB needed since 422 fires before) ────


def test_explain_validation_empty_log():
    r = client.post("/api/explain", json={"log": ""})
    assert r.status_code == 422


def test_explain_validation_whitespace_only():
    r = client.post("/api/explain", json={"log": "   \n\t"})
    assert r.status_code == 422


def test_explain_validation_oversize():
    r = client.post("/api/explain", json={"log": "x" * 25_000})
    assert r.status_code == 422


def test_explain_missing_field():
    r = client.post("/api/explain", json={})
    assert r.status_code == 422
