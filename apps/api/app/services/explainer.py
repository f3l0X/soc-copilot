"""Alert Explainer — turns a raw log/alert into a structured explanation
suitable for a junior SOC analyst.
"""
from __future__ import annotations

from app.schemas.alerts import ExplainResponse
from app.services.llm import LLMAdapter, get_llm

SYSTEM_PROMPT = """Eres un analista SOC senior que explica alertas a juniors.
Para cada log o alerta:
- Resume QUÉ está ocurriendo en lenguaje claro y conciso (2-3 frases).
- Asigna risk_level entre: low, medium, high, critical.
- Identifica técnicas MITRE ATT&CK aplicables (formato T#### o T####.###).
  Si no hay coincidencia clara, devuelve lista vacía.
- Da un reasoning didáctico: por qué es sospechoso, qué indicadores observas,
  qué contexto debería verificar el analista. 4-6 frases.

Sé honesto: si el log es benigno o ambiguo, dilo. No inventes técnicas MITRE."""

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "risk_level": {
            "type": "string",
            "enum": ["low", "medium", "high", "critical"],
        },
        "mitre_techniques": {
            "type": "array",
            "items": {"type": "string"},
        },
        "reasoning": {"type": "string"},
    },
    "required": ["summary", "risk_level", "mitre_techniques", "reasoning"],
    "propertyOrdering": ["summary", "risk_level", "mitre_techniques", "reasoning"],
}


def explain(
    log: str,
    source: str | None = None,
    llm: LLMAdapter | None = None,
) -> ExplainResponse:
    llm = llm or get_llm()
    user_prompt = f"Fuente: {source or 'desconocida'}\n\nLog/Alerta:\n{log}"
    data = llm.generate_json(
        user_prompt,
        schema=RESPONSE_SCHEMA,
        system=SYSTEM_PROMPT,
        temperature=0.2,
    )
    return ExplainResponse(**data)
