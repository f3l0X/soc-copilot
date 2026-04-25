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
- Docker Desktop con WSL2
- Git
- (Opcional) Node 22 y Python 3.12 si quieres correr fuera de Docker

```bash
# 1. Copia y rellena el .env
cp .env.example .env
# Edita .env y pon tu GEMINI_API_KEY

# 2. Levanta el stack
cd infra
docker compose up --build

# 3. Servicios
# Frontend:  http://localhost:3000
# API:       http://localhost:8080
# API docs:  http://localhost:8080/docs
# Postgres:  localhost:5432
# Chroma:    http://localhost:8001
```

## Módulos

| Endpoint | Módulo | Estado |
|----------|--------|--------|
| `POST /api/explain` | Alert Explainer | stub (Fase 1) |
| `POST /api/recommend` | Next Step Recommender | stub (Fase 2) |
| `POST /api/chat` | Chat IA + RAG | stub (Fase 3) |
| `GET /api/health` | Health check | ✅ |

## Reparto del equipo

- **P1** Backend Core / LLM adapter
- **P2** RAG / Knowledge (MITRE+OWASP)
- **P3** Backend Servicios / Auth / DB
- **P4** Frontend Dashboard / Alerts / Respond
- **P5** Frontend Chat / DevOps / Hetzner

## Roadmap

Ver [docs/roadmap.md](docs/roadmap.md).
