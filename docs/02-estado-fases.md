# Estado del proyecto y fases completadas

## Estado general

El proyecto se encuentra al cierre de la fase 2. Ya existe una version local ejecutable con Docker Compose, backend FastAPI, frontend Next.js, PostgreSQL para persistencia y ChromaDB preparado para la fase 3.

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

Estado: pendiente de iniciar.

Base ya disponible:

- Servicio ChromaDB en Docker Compose.
- Configuracion `CHROMA_HOST` y `CHROMA_PORT`.
- Endpoint `POST /api/chat` creado como stub.
- Esquemas `ChatRequest` y `ChatResponse`.

Trabajo esperado:

- Ingesta de conocimiento MITRE, OWASP u otras fuentes aprobadas.
- Generacion de embeddings con Gemini.
- Persistencia de documentos/vectorizaciones en ChromaDB.
- Recuperacion de contexto relevante por consulta.
- Implementacion real del endpoint `/api/chat`.
- UI de chat en frontend.

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

