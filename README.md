# SOC Copilot

AI Copilot para Analistas SOC Junior — Práctica 1, Módulo Ciberseguridad Avanzada (Curso 2026).

## Stack

- **Backend:** FastAPI (Python 3.12) + Gemini SDK
- **Frontend:** Next.js 15 + TypeScript + Tailwind
- **DB:** PostgreSQL 16
- **Vector store:** ChromaDB
- **Orquestación:** Docker Compose
- **Despliegue:** Hetzner Cloud + Caddy (HTTPS auto)

## Estructura

```
soc-copilot/
├── apps/
│   ├── api/        FastAPI service
│   └── web/        Next.js dashboard
├── infra/
│   ├── docker-compose.yml
│   ├── caddy/      Reverse proxy config (prod)
│   └── postgres/   Init scripts
├── docs/           Informe PDF, diagramas
└── .github/workflows/   CI
```

## Setup local (Windows 11)

Requisitos previos:
- Docker Desktop con WSL2 activo (virtualización en BIOS habilitada)
- Git

```bash
# 1. Clona el repo
git clone https://github.com/f3l0X/soc-copilot.git
cd soc-copilot

# 2. Copia el .env y pon tu GEMINI_API_KEY
cp .env.example .env
# Edita .env → GEMINI_API_KEY=AIza...
# Obtener una key: https://aistudio.google.com/apikey

# 3. Levanta el stack (primera vez tarda ~3 min para construir imágenes)
cd infra
docker compose up --build -d
docker compose logs -f   # opcional: ver logs en vivo

# 4. Servicios
# Frontend:  http://localhost:13000
# API:       http://localhost:8080
# API docs:  http://localhost:8080/docs
# Postgres:  localhost:55432  (puerto cambiado: 5432–5757 reservados por Windows/Hyper-V)
# Chroma:    http://localhost:8001
```

Para parar: `docker compose down`. Para reiniciar limpio (borra datos): `docker compose down -v`.

## Módulos

| Endpoint | Módulo | Estado |
|----------|--------|--------|
| `POST /api/explain` | Alert Explainer (Gemini + MITRE) | ✅ Fase 1 |
| `POST /api/recommend` | Next Step Recommender | ✅ Fase 2 |
| `GET  /api/alerts` | Lista de alertas persistidas | ✅ Fase 2 |
| `GET  /api/alerts/{id}` | Alerta + sus recomendaciones | ✅ Fase 2 |
| `POST /api/chat` | Chat IA + RAG (MITRE + OWASP) | ✅ Fase 3 |
| `GET  /api/kb/status` | Estado de la base de conocimiento | ✅ Fase 3 |
| `GET  /api/health` | Health check | ✅ |

UI:
- http://localhost:13000/alerts — Alert Explainer
- http://localhost:13000/respond?alert_id=N — Next Step Recommender
- http://localhost:13000/history — Histórico
- http://localhost:13000/chat — Chat IA con citaciones MITRE/OWASP

## Knowledge base (RAG)

`/api/chat` consulta una colección Chroma `soc_kb` poblada con MITRE
ATT&CK Enterprise (todas las técnicas) y OWASP Top 10 2021.

Para ingerir la KB la primera vez (o re-ingerir tras cambios):

```bash
docker compose exec api python -m scripts.ingest_kb           # idempotente, OWASP+MITRE
docker compose exec api python -m scripts.ingest_kb --force   # re-ingerir
docker compose exec api python -m scripts.ingest_kb --owasp-only
```

El script tarda 5–15 min según RPM disponibles del free tier de Gemini
(~700 docs en lotes con backoff exponencial).

## Tests y lint

```bash
# Lint backend
cd apps/api
docker run --rm -v "$PWD/app:/code/app" soc-copilot-api ruff check app

# Tests backend
docker run --rm \
  -v "$PWD/app:/code/app" -v "$PWD/tests:/code/tests" \
  -e GEMINI_API_KEY=dummy \
  -w /code soc-copilot-api pytest -q tests/

# TypeScript typecheck
docker exec soc-copilot-web-1 npx tsc --noEmit
```

CI (GitHub Actions) corre ruff + pytest + `next build` en cada push a `main`.

## Seguridad

- **Errores LLM saneados** — el cliente recibe `AI provider error` o
  `AI response could not be processed` (502); el detalle se loggea
  internamente. Nunca se expone la API key, modelo, ni mensajes de quota.
- **Mitigación prompt injection** — los logs de usuario van envueltos en
  delimitadores `BEGIN_UNTRUSTED_LOG` / `END_UNTRUSTED_LOG` y el system
  prompt instruye al modelo a tratarlos como dato, no instrucciones.
- **Rate limit por IP** — `/api/explain` y `/api/recommend` aplican
  ventana deslizante en memoria. Configurable vía env:

  | Variable | Default | Descripción |
  |----------|---------|-------------|
  | `RATE_LIMIT_ENABLED` | `true` | Activa el limitador |
  | `RATE_LIMIT_REQUESTS` | `20` | Peticiones permitidas por ventana |
  | `RATE_LIMIT_WINDOW_SECONDS` | `60` | Tamaño de la ventana |

  Exceso → `HTTP 429 {"detail":"rate limit exceeded"}`.
- **Validación estricta** — campos obligatorios, longitudes acotadas,
  rechazo de payloads whitespace-only y roles de chat restringidos.

## Despliegue producción

`infra/docker-compose.yml` es **dev-only** (puertos expuestos, hot-reload).
Para Hetzner, copiar `infra/docker-compose.prod.example.yml` y adaptar
dominio/secretos. Usa Caddy 2 como reverse proxy con TLS automático.

## Reparto del equipo

- **P1** Backend Core / LLM adapter
- **P2** RAG / Knowledge (MITRE+OWASP)
- **P3** Backend Servicios / Auth / DB
- **P4** Frontend Dashboard / Alerts / Respond
- **P5** Frontend Chat / DevOps / Hetzner

## Roadmap

Ver [docs/roadmap.md](docs/roadmap.md).
