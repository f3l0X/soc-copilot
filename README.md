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
| `POST /api/recommend` | Next Step Recommender | ⏳ Fase 2 |
| `POST /api/chat` | Chat IA + RAG | ⏳ Fase 3 |
| `GET /api/health` | Health check | ✅ |

UI Alert Explainer: http://localhost:13000/alerts

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

## Reparto del equipo

- **P1** Backend Core / LLM adapter
- **P2** RAG / Knowledge (MITRE+OWASP)
- **P3** Backend Servicios / Auth / DB
- **P4** Frontend Dashboard / Alerts / Respond
- **P5** Frontend Chat / DevOps / Hetzner

## Roadmap

Ver [docs/roadmap.md](docs/roadmap.md).
