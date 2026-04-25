"""LLM adapter — keep call sites provider-agnostic.

Phase 0: stub. Phase 1 wires google-genai. Future: swap by reading provider
from settings (Gemini / Anthropic / OpenAI / Ollama).
"""
from abc import ABC, abstractmethod


class LLMAdapter(ABC):
    @abstractmethod
    def generate(self, prompt: str, *, system: str | None = None) -> str: ...

    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]: ...


class StubAdapter(LLMAdapter):
    def generate(self, prompt: str, *, system: str | None = None) -> str:
        return "(stub) LLM not wired yet"

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [[0.0] for _ in texts]


def get_llm() -> LLMAdapter:
    return StubAdapter()
