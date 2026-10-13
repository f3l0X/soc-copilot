# SOC Copilot — Handoff para otra IA

> Documento autocontenido. Pégalo entero al inicio de una conversación
> con otra IA para darle todo el contexto del proyecto sin que tenga
> que leer el repo. Snapshot: **2026-05-26**.

---

## 1. Contexto académico

- **Asignatura:** Práctica 1 — Ciberseguridad con IA, Módulo de
  Ciberseguridad Avanzada (Curso 2026).
- **Línea elegida:** Blue Team.
- **Producto:** *SOC Copilot* — asistente con IA para analistas SOC
  junior.
- **Equipo:** 4 personas → la rúbrica exige "alcance completo"
  (modularidad, documentación, funcionalidades diferenciadas por
  miembro).
- **Fechas:** inicio 2026-04-25, entrega 2026-05-25.
- **Entregables exigidos:** web dashboard funcional, repo GitHub,
  deploy en Hetzner Cloud, informe PDF profesional, demo oral de 10
  min.
- **Rúbrica:** 30 % funcionalidad · 20 % informe · 15 % UX dashboard ·
  15 % deploy Hetzner · 10 % calidad repo · 10 % roadmap Práctica 2.

---

## 2. Qué hace el producto

Cinco capacidades sobre la misma base auth / RBAC:

1. **Alert Explainer** (`POST /api/explain`, UI `/alerts`): se pega un
   log, devuelve `summary`, `risk_level` (low / medium / high /
   critical), `mitre_techniques` (T####), `reasoning` didáctico
   adaptado al **nivel SOC** del usuario (L1 / L2 / Instructor).
2. **Next Step Recommender** (`POST /api/recommend`, UI `/respond`):
   recomendaciones accionables sobre una alerta ya analizada. Dos
   modos: por `alert_id` (persiste) o por `log` directo (no persiste).
   Regla anti-destrucción: acciones drásticas llevan prefijo
   `[REQUIERE APROBACIÓN HUMANA]`.
3. **Chat IA con RAG** (`POST /api/chat`, UI `/chat`): conversación
   con citas verificables sobre MITRE ATT&CK Enterprise + OWASP Top
   10 2025. ~707 docs en ChromaDB.
4. **Dashboard analítico + panel admin** (`/dashboard`, `/admin`):
   KPIs, distribución por riesgo, serie temporal 30 d, top técnicas
   MITRE, gestión de usuarios, RBAC dinámico (matriz editable),
   auditoría inmutable, toggle de registro público en runtime, BYO
   Gemini key por usuario.
5. **Chat grupal del equipo** (`/groupchat`): canal único compartido
   por todos los usuarios autenticados, polling ligero. Pensado para
   coordinar guardias y triage en directo.

Además, **analizador de logs 100 % cliente** en `/logs` con filtros
de red (IP / puerto / MAC / protocolo / auth-fail / 4xx-5xx /
ventana temporal), paginación y selección que viaja a
`/alerts?import=true` por `sessionStorage`. No gasta cuota Gemini ni
toca el server; solo viajan al backend las líneas que el analista
selecciona.

---

## 3. Stack y arquitectura

```
                 ┌─────────────────┐
                 │     Caddy 2     │  TLS automático (Let's Encrypt)
                 │  HTTP/2 + HTTP/3│  HSTS preload, security headers
                 └────────┬────────┘
            /api/* │            │ /*
                   ▼            ▼
          ┌─────────────┐  ┌─────────────┐
          │  FastAPI    │  │  Next.js 15 │
          │  Uvicorn    │  │ (standalone)│
          └──┬───┬───┬──┘  └─────────────┘
             │   │   └─── ChromaDB 0.5.23 (RAG MITRE+OWASP, ~707 docs)
             │   └─────── Gemini API (chat + embeddings) + SMTP Gmail
             └─────────── Postgres 16 (users, alerts, recs, audit,
                          role_permissions, app_settings,
                          group_messages)
```

| Capa | Tecnología |
|------|------------|
| Backend | FastAPI 0.115 + Uvicorn 0.32, Python 3.12, Pydantic v2 |
| ORM + migraciones | SQLAlchemy 2 + Alembic 1.14 |
| DB | PostgreSQL 16-alpine |
| Vector store | ChromaDB 0.5.23, embeddings `gemini-embedding-001` (3072d) |
| LLM | Gemini `2.5-flash-lite` / `2.5-flash` / `2.0-flash-lite` (allowlist server-side) |
| Auth | PyJWT HS256 + bcrypt + cookie httpOnly + claim `pv` para invalidar sesiones |
| Cripto per-user | Fernet (`APP_ENCRYPTION_KEY`) para BYO Gemini key |
| Email | `smtplib` stdlib sobre Gmail App Password (STARTTLS 587) |
| Frontend | Next.js 15.5 + React 19 + TS 5.9 + Tailwind 3.4 + Recharts |
| Reverse proxy | Caddy 2 |
| Hosting | Hetzner CPX22 (3 vCPU / 4 GB / 80 GB NVMe, Nuremberg, ~8,5 €/mes con backups) |
| Dominio | DuckDNS `soc-copilot.duckdns.org` |
| CI | GitHub Actions: `ci.yml` (ruff `apps/api` + pytest unit + web lint/build + `npm audit` informativo + compose validate) y `e2e.yml` (pytest E2E con Postgres + Playwright frontend) |

Repo monorepo: `apps/api`, `apps/web`, `infra`, `docs`, `scripts`.

---

## 4. Modelo de datos

```
USERS ─< ALERTS ─< RECOMMENDATIONS
USERS ─< AUDIT_LOGS
USERS ─< GROUP_MESSAGES
USERS ─< APP_SETTINGS (updated_by)
ROLE_PERMISSIONS (matriz role × permission_key, solo deviaciones)
```

**Migraciones Alembic (5):** `0001_initial_schema`,
`0002_auth_hardening`, `0003_level_approval`, `0004_app_settings`,
`0005_group_messages`. `init_db()` ejecuta `alembic upgrade head` en
Postgres y hace `alembic stamp head` sobre DBs legacy creadas con
`create_all`. SQLite solo en tests unit.

**Claves no obvias:**

- `users.password_version` se bumpea en reset password o cambio de
  rol; el JWT lleva `pv` y el middleware rechaza tokens stale →
  invalida sesiones sin necesidad de blacklist.
- `users.level` (L1 / L2 / Instructor) es **ortogonal al RBAC**: solo
  modula tono del Copilot, no autoriza nada. El usuario solicita un
  nivel al registrarse, queda fijado en L1 hasta que un admin lo
  apruebe (`level_approved=true`). Bootstrap admin se auto-aprueba
  como Instructor.
- `users.gemini_api_key_ciphertext` cifrado con Fernet
  (`APP_ENCRYPTION_KEY`). Solo se exponen los últimos 4 caracteres
  (`gemini_key_last4`). Rotar `APP_ENCRYPTION_KEY` invalida todas
  las BYO keys (los usuarios deben reintroducirlas; mientras tanto
  caen al uso de la key compartida con cuota).
- `users.server_llm_calls_today` + `server_llm_quota_date`: contador
  diario de llamadas a la clave compartida. Se resetea al rollover
  UTC o por admin. Usuarios con BYO key no se contabilizan.
- `users.failed_login_attempts` + `locked_until`: tras N fallos
  (`AUTH_LOCKOUT_THRESHOLD`, default 4), bloqueo de
  `AUTH_LOCKOUT_MINUTES` (default 15). Mensaje al usuario opaco e
  idéntico al de credenciales malas — no se filtra estado.
- `alerts.user_id` nullable: alertas pre-fase-4 quedan sin owner y
  solo las ve admin. Ownership: analyst ve las suyas, admin ve todo,
  404 a no-owner (no 403, para no leak existencia).
- `recommendations.alert_id` con `ON DELETE CASCADE`.
- `audit_logs` append-only, `actor_id` con `ON DELETE SET NULL`.
- `app_settings`: key/value de flags mutables en runtime. La fila
  gana al valor del `.env` cuando existe. Única clave hoy:
  `public_registration_enabled`.
- `group_messages.user_id` nullable con `ON DELETE SET NULL`; el
  snapshot de `user_email` y `user_name` se persiste en el momento
  del envío para que el historial siga siendo legible aunque la
  cuenta del autor se borre después.
- `role_permissions` guarda solo **desviaciones** sobre la registry
  estática en `services/permissions.py`. Permission
  `permissions.manage` marcada `locked=True` para evitar lockout.

---

## 5. Endpoints (resumen)

| Método | Path | Auth / Permiso | Notas |
|--------|------|----------------|-------|
| GET | `/api/health` | público | smoke |
| GET | `/api/llm/models` | público | allowlist + default |
| GET | `/api/kb/status` | público | conteo MITRE/OWASP |
| POST | `/api/auth/register` | público | primer usuario = admin; honeypot `website`; verificación email SMTP; rate-limit por IP + por email |
| GET | `/api/auth/check-email` | público (10/min/IP) | tiempo normalizado anti-enumeración |
| POST | `/api/auth/verify-email` | público | activa la cuenta desde el link SMTP; token single-use |
| POST | `/api/auth/login` | público | set-cookie httpOnly, normalización de tiempos, lockout tras N fallos |
| POST | `/api/auth/logout` | público | clear-cookie |
| GET / PUT | `/api/auth/me` | sesión | edita name/last_name/email; `level` solo lo aceptan admins |
| GET / PUT / DELETE | `/api/auth/me/llm` | sesión | BYO Gemini key (validada con ping antes de cifrar) + modelo preferido |
| POST | `/api/explain` | sesión + rate-limit | persiste con user_id, prompt adaptado al nivel SOC |
| POST | `/api/recommend` | sesión + rate-limit | `alert_id` o `log` |
| POST | `/api/chat` | sesión + rate-limit | RAG sobre `soc_kb` |
| GET / POST | `/api/groupchat` | sesión | canal único del equipo (`content` 1–2000) |
| GET | `/api/groupchat/poll?after_id=N` | sesión | polling incremental, hasta 100 mensajes |
| GET | `/api/alerts` | sesión | paginado, ownership |
| GET | `/api/alerts/{id}` | sesión | con recommendations anidadas |
| GET | `/api/stats` | sesión | KPIs dashboard, cache 60 s |
| GET | `/api/admin/users` | `users.list` | listado completo |
| POST | `/api/admin/users` | `users.create` | crear con rol explícito |
| PUT | `/api/admin/users/{id}/password` | `users.update_password` | bumpea `password_version` |
| PUT | `/api/admin/users/{id}/role` | `users.update_role` | bumpea `password_version` |
| PUT | `/api/admin/users/{id}/level` | `users.update_role` | aprueba seniority L1/L2/Instructor |
| POST | `/api/admin/users/{id}/reset-llm-quota` | `users.update_role` | resetea contador diario sin esperar al rollover UTC |
| DELETE | `/api/admin/users/{id}` | `users.delete` | bloquea último admin / self |
| GET | `/api/admin/audit` | `audit.view` | append-only, filtros action/actor |
| GET / PUT | `/api/admin/permissions` | `permissions.manage` | matriz role × key, bulk con diff |
| GET | `/api/admin/settings` | `permissions.manage` | flags mutables en runtime |
| PUT | `/api/admin/settings/public-registration` | `permissions.manage` | toggle de registro público sin reiniciar |

Detalle completo en `docs/06-api-reference.md`.

---

## 6. Hardening aplicado (lo que está hecho)

- Allowlist server-side de modelos LLM + override por request validado
  en Pydantic y en el adapter (defense in depth).
- Delimitadores `BEGIN/END_UNTRUSTED_LOG` y `BEGIN/END_UNTRUSTED_KB`
  contra prompt injection y RAG poisoning. System prompt instruye al
  modelo a tratar ambos bloques como dato.
- Recommender con regla anti-acciones-destructivas (prefijo "REQUIERE
  APROBACIÓN HUMANA").
- `LLMProviderError` / `LLMResponseError` → 502 genéricos al cliente,
  detalle solo en logs internos (no se filtra modelo / quota / stack).
- Sanitización redundante anti prompt injection en Explainer.
- Rate limit in-memory por IP, sliding window con threading lock, lee
  XFF detrás de Caddy (`trusted_proxies static private_ranges`).
  Buckets extra: `/auth/check-email` (10/min/IP) y `/auth/register`
  (3/h/email).
- **Brute-force lockout**: N fallos consecutivos → cuenta bloqueada
  N min. Mensaje opaco e idéntico al de credenciales malas.
- **Honeypot** en `/auth/register` (campo `website` invisible para
  humanos): si llega rellenado, 201 falso y se audita como
  `auth.register_honeypot` sin persistir nada.
- **Email verification** opcional (`AUTH_REQUIRE_EMAIL_VERIFICATION`):
  token single-use con TTL configurable, link enviado por SMTP
  Gmail. Si SMTP falla en producción el registro NO se aborta, el
  admin puede reenviar o marcar verificado.
- **ReDoS**: cap de wildcard en regex.
- **Timing attack**: normalización de tiempos en `/auth/login` y
  `/auth/check-email`.
- JWT invalidable por bump de `password_version` (claim `pv`).
- Audit log inmutable con diff JSON para todas las acciones admin
  (create / delete / role / level / password / permissions /
  settings).
- bcrypt + cookie httpOnly + SameSite=Lax (Strict en prod) + Secure si
  `COOKIE_SECURE=true` (forzado en producción).
- **BYO Gemini key cifrada con Fernet** (`APP_ENCRYPTION_KEY`); solo
  se exponen los últimos 4 caracteres. La key se valida con un ping
  a Gemini **antes** de persistirse.
- `APP_ENV=production` valida que no haya secretos por defecto y se
  niega a arrancar si los encuentra. Swagger + OpenAPI ocultos en
  prod.
- Política de contraseñas unificada (registro + reseteo admin):
  ≥ 10 chars, mayúscula, minúscula, dígito, símbolo, zxcvbn ≥ 2.
- Same-origin guard (`enforce_same_origin`) en endpoints sensibles
  (`/auth/register`, `/auth/login`, `/auth/verify-email`).
- VPS hardening: SSH key-only en **puerto 2222**, `PermitRootLogin no`,
  `AllowUsers soc`, UFW 2222/80/443, fail2ban (jail sshd),
  unattended-upgrades, swap 2 GB.
- Backups Postgres **cifrados con age** vía systemd timer
  (`soc-copilot-backup.timer` @03:30 → `pg_dump | gzip | age`), retención
  7 diarias + 4 semanales en VPS + offsite rclone opcional + copia
  offline en Windows. Restore en `docs/ops/restore-postgres.md`.
- Caddy: HTTPS auto, HTTP/3, HSTS preload, X-Content-Type-Options,
  X-Frame-Options, Referrer-Policy, Permissions-Policy.

---

## 7. Estado por fases

| Fase | Hito | Estado |
|------|------|--------|
| 0 | Setup repo + Docker Compose | ✅ |
| 1 | Alert Explainer | ✅ |
| 2 | Next Step Recommender + Postgres + Alembic | ✅ |
| 3 | RAG + Chat IA (MITRE + OWASP en Chroma) | ✅ |
| 4 | Auth JWT cookie + RBAC + E2E | ✅ |
| 4.5 | Dashboard analítico (`/dashboard` + `/api/stats`) | ✅ |
| 5 | Hetzner + DuckDNS + Caddy + backups + SMTP + toggle registro | ✅ |
| Post-5 | BYO LLM key, niveles SOC, lockout, honeypot, email verif, chat grupal | ✅ |
| 6 | Informe PDF + demo 10 min | ⏳ en curso |

**Producción operativa en https://soc-copilot.duckdns.org desde
2026-05-18.**

Snapshot de calidad sobre `main` (2026-05-26):

- Inventario de tests: 104 funciones en 10 archivos.
  - Unit (sin `RUN_E2E`): 86 (`test_smoke` 31, `test_register_security`
    19, `test_byo_llm` 18, `test_auth` 12, `test_logging` 3,
    `test_migrations` 3).
  - E2E con Postgres real (`RUN_E2E=1`): 18 (`test_e2e` 8,
    `test_groupchat` 5, `test_stats` 4, `test_e2e_quota` 1).
- `ruff check apps/api`: clean.
- ESLint flat config: 0 errors / 0 warnings.
- `npm audit --audit-level=high`: 0 critical, 0 high (2 moderate
  aceptados, ver `docs/security.md`).
- `tsc --noEmit`: clean.
- `next build`: 13 páginas compiladas (incluyendo `/dashboard`,
  `/groupchat`, `/settings/llm`, `/verify`).
- GitHub Actions: `ci.yml` (push/PR) + `e2e.yml` (main).

---

## 8. Qué queda

**Fase 6 (deadline 2026-05-25, ya vencido — entrega/demo inminente):**

- Informe PDF profesional según rúbrica (portada, índice, resumen
  ejecutivo, problema, arquitectura, evidencias fase a fase, guía
  deploy, manual de uso, conclusiones, roadmap Práctica 2 con ≥ 5
  funcionalidades).
- Demo oral 10 min con stack en Hetzner; plan B con capturas/video.
- Entregar URL pública + URL repo + PDF en campus virtual.

---

## 9. Decisiones de diseño no obvias (para entender el código)

- **Provider-agnostic LLM**: `LLMAdapter` abstracto, hoy solo
  `GeminiAdapter`. Añadir Claude / OpenAI / Ollama = escribir un
  sibling.
- **BYO key + cuota compartida combinadas**: el adapter resuelve en
  cada llamada qué clave usar (BYO descifrada o servidor). Si toca
  la del servidor, incrementa contador y aplica `SERVER_LLM_DAILY_QUOTA`.
  Si toca BYO, no se contabiliza.
- **`init_db()` con bridge Alembic**: detecta DBs legacy creadas con
  `create_all` y las marca con `alembic stamp head` para migrar sin
  pérdida.
- **`recommend` con dos modos** por diseño: el modo `log` sirve para
  preview sin polucionar el histórico.
- **Nivel SOC ≠ rol RBAC**: la seniority es ortogonal a la
  autorización; solo modula tono y profundidad. Un analyst Instructor
  ve la misma UI que un analyst L1; lo que cambia es el system prompt.
- **Shell de navegación** (`<AppShell>`, Sidebar colapsable + Topbar +
  FloatingActions) montado en `app/layout.tsx`; decide qué renderizar
  según ruta y sesión: en `/login` o sin usuario solo pinta el contenido.
- **Cross-tab auth sync** con eventos `storage` y `focus` → logout en
  una pestaña echa al resto sin polling.
- **Permission registry estática + tabla con desviaciones** evita seed
  inicial y permite reset trivial: borrar la tabla.
- **`/logs` 100 % cliente** porque el parser de logs no debe gastar
  cuota Gemini ni tocar el server; solo viajan al backend las líneas
  que el analista selecciona.
- **Chat grupal con snapshot de identidad**: persistimos `user_email`
  y `user_name` al enviar, además del FK. Si el autor se borra
  después, el mensaje sigue legible con `user_id=null` y los campos
  snapshot intactos. `ON DELETE SET NULL` garantiza el invariante.
- **Toggle de registro persistido en BD** (no en `.env`) para que la
  apertura/cierre durante una demo no requiera redeploy ni SSH.

---

## 10. Roadmap para Práctica 2 (≥ 5 exige la rúbrica)

Documentado en `docs/roadmap.md`. Las 10 propuestas actuales:

1. Integración con SIEM real (Wazuh / Elastic / Splunk).
2. Multi-tenant + RBAC ampliado (workspaces, roles custom, scoping).
3. Modelo fine-tuned para pre-clasificar logs antes de Gemini.
4. Feedback loop del analista (útil / no útil → fine-tune incremental).
5. Multi-LLM con A/B (Claude + OpenAI + Ollama local, métrica calidad).
6. Export PDF firmado de informes de incidente (timeline + IOCs).
7. Threat intel (MISP / OpenCTI) para enriquecer IPs / hashes /
   dominios.
8. Escalabilidad: rate limit en Redis, Celery, réplica Postgres.
9. Hardening: 2FA, password reset self-service, secrets manager.
10. Observabilidad: OpenTelemetry + Prometheus + Grafana + alerting.

---

## 11. Cómo arrancar el proyecto en local

```bash
git clone git@github.com:f3l0X/soc-copilot.git
cd soc-copilot
cp .env.example .env       # rellenar GEMINI_API_KEY + APP_ENCRYPTION_KEY + secretos
docker compose -f infra/docker-compose.yml --env-file .env up -d --build
docker compose -f infra/docker-compose.yml --env-file .env \
  exec api python -m scripts.ingest_kb     # ~5 min, puebla Chroma
```

Generar `APP_ENCRYPTION_KEY` (necesaria si vas a probar BYO key):

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Abrir http://localhost:13500. Primer registro = admin automático
(auto-verificado y promovido a Instructor). Detalle en
`docs/01-instalacion-local.md`.

---

## 12. Archivos clave para una IA que llegue nueva

- `docs/02-estado-fases.md` — historia completa fase a fase.
- `docs/03-arquitectura.md` — código componente por componente.
- `docs/06-api-reference.md` — endpoints con request/response.
- `docs/09-diagramas.md` — ER detallado, casos de uso, secuencias.
- `docs/10-manual-usuario.md` — guía de uso (analista + admin).
- `docs/11-modulo-auditoria.md` — eventos auditables y semántica.
- `docs/operations.md` + `docs/RUNBOOK.md` — runbook prod (Hetzner,
  Caddy, backups, troubleshooting, BYO key, rotación de claves).
- `docs/security.md` + `docs/vulnerability_report.md` — postura de
  seguridad.
- `docs/roadmap.md` — fases, riesgos, mejoras Práctica 2.
- `docs/12-changelog.md` — cambios visibles para el usuario, en
  orden inverso.
- `apps/api/app/services/*.py` — lógica de negocio (`llm`,
  `explainer`, `recommender`, `chat`, `rag`, `auth`, `audit`,
  `permissions`, `settings`, `email`, `secrets`, `password`,
  `security`, `stats`, `audience`).
- `apps/api/app/routers/*.py` — 11 routers (`auth`, `admin`,
  `alerts`, `chat`, `explain`, `groupchat`, `health`, `kb`, `llm`,
  `recommend`, `stats`).
- `apps/api/alembic/versions/` — 5 migraciones.
- `apps/api/tests/` — 9 archivos de tests (4 unit + 4 E2E + 1
  migrations).
- `infra/docker-compose.prod.example.yml` — referencia deploy.
- `apps/web/src/app/` — 13 rutas (`alerts`, `admin`, `chat`,
  `dashboard`, `groupchat`, `history`, `login`, `logs`, `profile`,
  `respond`, `settings/llm`, `verify`, home).
