# Instalación local

> La **instalación paso a paso desde cero** está en el
> [README](../README.md#4-instalación-paso-a-paso) de la raíz del
> repositorio, que es la única guía mantenida. Este documento solo resume
> los puertos y los comandos más usados en el día a día.

## Puertos usados

| Servicio | URL local | Puerto host |
|----------|-----------|-------------|
| Frontend Next.js | <http://localhost:13500> | 13500 |
| API FastAPI | <http://localhost:8080> | 8080 |
| Swagger API | <http://localhost:8080/docs> | 8080 |
| PostgreSQL | localhost:55432 | 55432 |
| ChromaDB | <http://localhost:8001> | 8001 |

> Nota Windows: 5432 (Postgres por defecto) y 3000 (Next por defecto) suelen
> estar en el rango excluido por Hyper-V en Windows 11. Por eso usamos
> 55432 y 13500.

## Comandos útiles

Desde la raíz del repositorio. Para abreviar, en PowerShell puedes definir
`$dc = "docker compose -f infra/docker-compose.yml --env-file .env"` y
usar `Invoke-Expression "$dc ps"`, o escribir el comando completo.

| Acción | Comando |
|--------|---------|
| Arrancar / reconstruir | `docker compose -f infra/docker-compose.yml --env-file .env up -d --build` |
| Ver el estado | `docker compose -f infra/docker-compose.yml --env-file .env ps` |
| Parar | `docker compose -f infra/docker-compose.yml --env-file .env down` |
| Parar y **borrar** la base de datos y la KB | `docker compose -f infra/docker-compose.yml --env-file .env down -v` |
| Logs de la API / de la web | `docker compose -f infra/docker-compose.yml --env-file .env logs -f api` (o `web`) |
| Versión de la base de datos | `docker compose -f infra/docker-compose.yml --env-file .env exec api alembic current` (debe ser `0011_alert_reviews`) |
| Tests de la API | `docker compose -f infra/docker-compose.yml --env-file .env exec api pytest -q --ignore=tests/test_e2e.py` |
| Lint de la API | `docker compose -f infra/docker-compose.yml --env-file .env exec api ruff check app tests` |
| Alertas de prueba (simulador de Wazuh) | `docker compose -f infra/docker-compose.yml --env-file .env exec api python integrations/wazuh/wazuh_simulator.py --count 8 --interval 1` |
| Cargar la base de conocimiento | `docker compose -f infra/docker-compose.yml --env-file .env exec api python -m scripts.ingest_kb` |
| Estado de la KB | `curl http://localhost:8080/api/kb/status` |

## Prueba rápida (smoke manual)

1. Inicia sesión en <http://localhost:13500/login> (con MFA).
2. Lanza el simulador de Wazuh (tabla de arriba) y abre **SIEM → Alertas
   Wazuh**: deben aparecer alertas en la cola **Nuevas**.
3. **Asignármela** en una alerta → **Analizar**: resumen, riesgo, MITRE y
   razonamiento.
4. Ciérrala o escálala desde el panel **Gestión de la alerta** y comprueba
   el historial.
5. Abre `/chat` y pregunta por una técnica MITRE: si la KB está cargada,
   la respuesta cita IDs como `mitre:T1110`.

Si algo falla, consulta el apartado **Problemas frecuentes** del
[README](../README.md#10-problemas-frecuentes).
