"""Next Step Recommender — given an alert (raw log or stored explanation),
suggest concrete actions a SOC analyst should take, with rationale.
"""
from __future__ import annotations

from app.schemas.alerts import RecommendResponse
from app.services.llm import LLMAdapter, get_llm

SYSTEM_PROMPT = """Eres un analista SOC senior. A partir de una alerta y su
explicación, propone acciones concretas que un analista junior debe ejecutar.

Para cada acción incluye:
- title: nombre corto y accionable (ej. "Bloquear IP en firewall perimetral")
- detail: pasos o comandos específicos (ej. queries SIEM, comandos shell, URLs)
- rationale: por qué esta acción ayuda — modo aprendizaje para el junior

Asigna priority entre: low, medium, high, critical.
learning_notes: párrafo (3-5 frases) que enseñe al junior el patrón general
de respuesta para este tipo de incidente.

Sé práctico: 3-6 acciones máximo, ordenadas por urgencia. Si el evento es
benigno, devuelve una sola acción de tipo "verificar y archivar"."""

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "actions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "detail": {"type": "string"},
                    "rationale": {"type": "string"},
                },
                "required": ["title", "detail", "rationale"],
                "propertyOrdering": ["title", "detail", "rationale"],
            },
        },
        "priority": {
            "type": "string",
            "enum": ["low", "medium", "high", "critical"],
        },
        "learning_notes": {"type": "string"},
    },
    "required": ["actions", "priority", "learning_notes"],
    "propertyOrdering": ["actions", "priority", "learning_notes"],
}


def recommend(
    log: str,
    source: str | None = None,
    explanation: str | None = None,
    risk_level: str | None = None,
    llm: LLMAdapter | None = None,
) -> RecommendResponse:
    llm = llm or get_llm()
    parts = [f"Fuente: {source or 'desconocida'}"]
    if explanation:
        parts.append(f"Explicación previa: {explanation}")
    if risk_level:
        parts.append(f"Riesgo evaluado: {risk_level}")
    parts.append(f"Log/Alerta:\n{log}")
    user_prompt = "\n\n".join(parts)

    data = llm.generate_json(
        user_prompt,
        schema=RESPONSE_SCHEMA,
        system=SYSTEM_PROMPT,
        temperature=0.2,
    )
    return RecommendResponse(**data)
