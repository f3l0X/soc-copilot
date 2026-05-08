# Documentacion del proyecto SOC Copilot

Este paquete contiene el estado del proyecto al cierre del **ciclo de
hardening post-fase-4** (admin avanzado, perfil, analizador de logs,
auditoría, RBAC dinámico) y la informacion necesaria para que cualquier
miembro del equipo pueda ejecutarlo y mantenerlo localmente.

## Orden recomendado de lectura

| # | Documento | Para qué |
|---|-----------|----------|
| 01 | [Instalacion local](01-instalacion-local.md) | Levantar el stack desde cero en Windows/macOS/Linux |
| 02 | [Estado del proyecto y fases](02-estado-fases.md) | Qué está hecho y qué viene |
| 03 | [Arquitectura tecnica](03-arquitectura.md) | Cómo encajan backend, frontend, DB y Chroma |
| 04 | [Guia de trabajo del equipo](04-guia-equipo.md) | Convenciones, reparto de tareas, validación pre-entrega |
| 05 | [Solucion de problemas](05-solucion-problemas.md) | Errores comunes y cómo desbloquearlos |
| 06 | [Referencia de API](06-api-reference.md) | Todos los endpoints, schemas, auth y rate limit |
| 07 | [Tests y CI](07-testing.md) | Suites unit / E2E, fixtures, GitHub Actions |
| 08 | [Ingesta RAG (Chroma + MITRE + OWASP)](08-rag-ingestion.md) | Cómo poblar y mantener la base de conocimiento |
| 09 | [Diagramas del sistema](09-diagramas.md) | ER, despliegue, secuencia (login/explain/chat/reset/logs), casos de uso, ciclo de vida, pipeline KB, resolución RBAC |
| 10 | [Manual de usuario](10-manual-usuario.md) | Guía para analista/admin: módulos, flujo de trabajo, cuotas, troubleshooting |
| —  | [Estado de seguridad y mitigaciones](security.md) | Threats activas y residuales |
| —  | [Reporte de Vulnerabilidades](vulnerability_report.md) | Informe de la auditoría y parches de remediación |
| —  | [Roadmap](roadmap.md) | Plan por fases hasta entrega 25-mayo-2026 |

## Resumen rapido

SOC Copilot es una aplicacion para analistas SOC junior. El backend FastAPI
analiza alertas con Gemini, persiste resultados en PostgreSQL, indexa MITRE
ATT&CK y OWASP Top 10 en ChromaDB para RAG, y expone una API protegida con
JWT en cookie httpOnly invalidable por `password_version`. El frontend
Next.js sirve dashboard, explainer, recommender, analizador de logs con
filtros (IP/puerto/MAC/protocolo/tiempo), histórico, chat con citas, panel
de administración (usuarios, roles, matriz de permisos editable, auditoría)
y página de perfil de usuario.

Fases 0–4 y 4.5 (Dashboard) cerradas + ciclo de hardening admin completado. Fase 5 (despliegue Hetzner) y fase 6 (informe + demo) pendientes según roadmap.
