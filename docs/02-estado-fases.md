# Estado del proyecto y fases completadas

## Estado general

El proyecto se encuentra al cierre de la fase 3. Ya existe una version local ejecutable con Docker Compose, backend FastAPI, frontend Next.js, PostgreSQL para persistencia y ChromaDB con base de conocimiento RAG (MITRE ATT&CK + OWASP Top 10) en uso.

## Fase 0: base del proyecto

Estado: completada.

Incluye:

- Estructura de monorepo con `apps/api`, `apps/web`, `infra` y `docs`.
- Dockerfiles para backend y frontend.
- `infra/docker-compose.yml` con servicios `postgres`, `chroma`, `api` y `web`.
- Configuracion inicial de CI en GitHub Actions.
- Variables de entorno documentadas en `.env.example`.

## Fase 1: Alert Explainer

Estado: completada.

Incluye:

- Endpoint `POST /api/explain`.
- Servicio backend `app/services/explainer.py`.
- Adaptador LLM provider-agnostic en `app/services/llm.py`.
- Integracion actual con Gemini mediante `google-genai`.
- Esquemas Pydantic para request/response.
- UI en `/alerts` para pegar logs, elegir ejemplos y recibir explicacion.

Salida generada:

- Resumen en lenguaje claro.
- Nivel de riesgo: `low`, `medium`, `high` o `critical`.
- Tecnicas MITRE ATT&CK cuando aplican.
- Razonamiento didactico para analista junior.

## Fase 2: Next Step Recommender y persistencia

Estado: completada.

Incluye:

- Endpoint `POST /api/recommend`.
- Servicio backend `app/services/recommender.py`.
- Modelos SQLAlchemy `Alert` y `Recommendation`.
- Persistencia en PostgreSQL.
- Creacion automatica de tablas al arrancar la API.
- Endpoint `GET /api/alerts` para historico.
- Endpoint `GET /api/alerts/{id}` para detalle de alerta con recomendaciones.
- UI en `/respond` para generar acciones recomendadas.
- UI en `/history` para consultar alertas persistidas.

Salida generada:

- Lista de acciones concretas.
- Prioridad de respuesta.
- Razonamiento de cada accion.
- Notas de aprendizaje para el analista junior.

## Fase 3: RAG + Chat IA

Estado: completada.

Incluye:

- Script idempotente `apps/api/scripts/ingest_kb.py` que descarga el bundle STIX de MITRE ATT&CK Enterprise, extrae todas las tecnicas vigentes y las combina con la lista hardcodeada de OWASP Top 10 2021. Embeddings con Gemini en lotes con backoff exponencial.
- Coleccion ChromaDB `soc_kb` con 691 docs MITRE + 10 docs OWASP (701 total).
- Servicio `app/services/rag.py` con `Retriever` y diagnostico `kb_status`.
- Servicio `app/services/chat.py` que orquesta retrieval + LLM aplicando los mismos delimitadores `BEGIN/END_UNTRUSTED_KB` y `BEGIN/END_UNTRUSTED_LOG` de la fase 2 contra prompt injection.
- Endpoint `POST /api/chat` con sanitizacion de errores (502 generico) y rate limit por IP.
- Endpoint `GET /api/kb/status` para inspeccionar la base de conocimiento.
- UI `/chat` en frontend con conversacion, contexto opcional de log y pildoras de fuentes citables (link directo a MITRE/OWASP).

Salida generada:

- Respuesta conversacional con citas MITRE T#### / OWASP A##:2021.
- Lista de fuentes (`sources`) con los IDs de los documentos KB recuperados.

## Fases posteriores

Fase 4:

- Pulido de UI.
- Autenticacion.
- Tests minimos ampliados.

Fase 5:

- Despliegue en Hetzner.
- Dominio.
- HTTPS con Caddy.
- CI/CD.

Fase 6:

- Informe final.
- Presentacion de 10 minutos.

