# Seguridad — Estado actual

## Mitigaciones aplicadas (Fase 2 hardening)

### Errores LLM no fugan información
- `LLMError` se subclasifica en `LLMProviderError` y `LLMResponseError`.
- Los routers capturan la excepción, llaman a `logger.exception(...)` con
  el detalle real, y devuelven al cliente:
  - `502 AI provider error` cuando falla la llamada al proveedor.
  - `502 AI response could not be processed` cuando la respuesta llegó
    pero no se pudo parsear o validar.
- Nunca se expone `str(exc)` en el body. La API key, el modelo, mensajes
  de quota y stacks quedan únicamente en logs internos.

### Prompt-injection mitigation
- Los logs del usuario son **dato no confiable**. En `services/explainer.py`
  y `services/recommender.py` se envuelven con:
  ```
  BEGIN_UNTRUSTED_LOG
  <log>
  END_UNTRUSTED_LOG
  ```
- Los `SYSTEM_PROMPT` instruyen al modelo a:
  - Tratar todo lo que haya entre delimitadores como dato a analizar,
    nunca como instrucción.
  - Identificar y reportar cualquier intento de "ignora instrucciones
    previas" como posible prompt injection.
- El recommender añade reglas de seguridad: prioriza investigación y
  contención reversible; cualquier acción destructiva debe llevar
  prefijo `[REQUIERE APROBACIÓN HUMANA]`.

### Rate limiting
- `app/middleware/ratelimit.py` implementa una ventana deslizante por IP,
  en memoria, con lock para entornos multi-thread (ASGI workers).
- Aplicado a `/api/explain` y `/api/recommend` vía
  `dependencies=[Depends(rate_limit)]` en el router.
- `/api/health`, `/api/alerts*` y `/api/chat` no están limitados.
- Variables:
  - `RATE_LIMIT_ENABLED` (default `true`)
  - `RATE_LIMIT_REQUESTS` (default `20`)
  - `RATE_LIMIT_WINDOW_SECONDS` (default `60`)
- Limitación: in-memory ⇒ no compartido entre procesos. Para producción
  multi-worker se sustituirá el backing store por Redis (Fase ≥4).

### Validación de entrada
- `ExplainRequest`: log 1..20 000, source max 200, rechazo whitespace.
- `RecommendRequest`: `alert_id ≥ 1` o `log` no vacío (validador de modelo).
- `ChatMessage`: role ∈ {user, assistant, system}; content 1..4000, no
  whitespace.
- `ChatRequest`: 1..30 mensajes; log_context max 20 000.

### Secrets
- `.env` en `.gitignore`. Solo `.env.example` con placeholders se versiona.
- Verificado periódicamente que `git ls-files` no incluya secretos
  (búsqueda por prefijo `AIza`).

## Riesgos pendientes

| Fase | Riesgo |
|------|--------|
| 3 (Chat/RAG) | El endpoint `/api/chat` aún es stub. Cuando se conecte ChromaDB hay que sanitizar también el contenido recuperado (RAG poisoning) y aplicar el mismo patrón de delimitadores. |
| 4 (Auth) | Sin autenticación: cualquiera con acceso al puerto `8080` puede generar coste de Gemini. El rate limit por IP mitiga, pero no sustituye auth. NextAuth + JWT pendiente. |
| 4 (RBAC) | Endpoints `/api/alerts/{id}` no comprueban ownership porque no hay usuarios todavía. |
| 4 (Tests) | Suite es smoke + service-level con fakes; faltan tests E2E con DB real (testcontainers o pytest-postgresql). |
| 5 (Deploy) | Hardening VPS no aplicado; Caddy real, certificados TLS, secrets manager (no `.env`), backups Postgres y rotación de logs son tareas de Fase 5. |
| 5 (Rate limit) | Limitador en memoria → escalar a Redis con `slowapi` o equivalente cuando haya >1 worker. |
| Cross | Reverse proxy en prod: añadir `ProxyHeaders` middleware para que `request.client.host` lea `X-Forwarded-For` del proxy, configurando `forwarded_allow_ips` correctamente. |

## Cosas no verificadas (Fase 2 hardening)

- npm audit reporta 2 moderate por `postcss <8.5.10` **dentro de
  Next.js** (transitive). Nuestro top-level postcss es 8.5.11. El fix
  oficial requiere `npm audit fix --force` que degrada Next a 9.x; se
  acepta el aviso porque el postcss vendored solo procesa CSS del propio
  bundle de Next, no entrada de usuario. Revisar al actualizar Next.
- Comportamiento del rate limiter detrás de proxy: probado solo con
  TestClient (host = "testclient"). En prod necesitará el header trust
  setup mencionado arriba.
- `docker-compose.prod.example.yml` no se ha desplegado todavía; es
  plantilla para Fase 5.
