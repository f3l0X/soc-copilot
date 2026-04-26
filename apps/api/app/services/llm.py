"""LLM adapter — keep call sites provider-agnostic.

Currently wires Gemini via google-genai. Swappable to Claude/OpenAI/Ollama
by adding a sibling adapter and selecting via settings.
"""
from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from typing import Any

from google import genai
from google.genai import types

from app.config import get_settings

logger = logging.getLogger(__name__)


class LLMError(RuntimeError):
    """Base error for LLM provider failures."""


class LLMProviderError(LLMError):
    """The provider rejected the request (network, quota, auth)."""


class LLMResponseError(LLMError):
    """The provider replied but the payload could not be parsed/validated."""


class LLMAdapter(ABC):
    @abstractmethod
    def generate_json(
        self,
        prompt: str,
        *,
        schema: dict[str, Any],
        system: str | None = None,
        temperature: float = 0.2,
    ) -> dict[str, Any]: ...

    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]: ...


class GeminiAdapter(LLMAdapter):
    def __init__(self) -> None:
        settings = get_settings()
        if not settings.gemini_api_key or settings.gemini_api_key == "replace_me":
            raise LLMProviderError("GEMINI_API_KEY is not configured")
        self._client = genai.Client(api_key=settings.gemini_api_key)
        self._chat_model = settings.gemini_chat_model
        self._embed_model = settings.gemini_embed_model

    def generate_json(
        self,
        prompt: str,
        *,
        schema: dict[str, Any],
        system: str | None = None,
        temperature: float = 0.2,
    ) -> dict[str, Any]:
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=schema,
            system_instruction=system,
            temperature=temperature,
        )
        try:
            response = self._client.models.generate_content(
                model=self._chat_model, contents=prompt, config=config
            )
        except Exception as exc:
            logger.exception("Gemini provider call failed")
            raise LLMProviderError(str(exc)) from exc

        try:
            return json.loads(response.text)
        except (TypeError, ValueError) as exc:
            logger.exception("Gemini returned non-JSON payload: %r", response.text)
            raise LLMResponseError("non-json reply") from exc

    def embed(self, texts: list[str]) -> list[list[float]]:
        try:
            response = self._client.models.embed_content(
                model=self._embed_model, contents=texts
            )
        except Exception as exc:
            logger.exception("Gemini embed call failed")
            raise LLMProviderError(str(exc)) from exc
        return [e.values for e in response.embeddings]


_singleton: LLMAdapter | None = None


def get_llm() -> LLMAdapter:
    global _singleton
    if _singleton is None:
        _singleton = GeminiAdapter()
    return _singleton
