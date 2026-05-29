# Tests y CI

## Visión general

| Suite | Archivo | Requiere DB | Duración | Cuándo se ejecuta |
|-------|---------|-------------|----------|-------------------|
| Unit smoke | `tests/test_smoke.py` | no (fakes + dependency_overrides) | ~3 s | siempre |
| Unit auth | `tests/test_auth.py` | no | ~2 s | siempre |
| Unit BYO LLM | `tests/test_byo_llm.py` | no | ~2 s | siempre |
| Unit logging | `tests/test_logging.py` | no | ~1 s | siempre |
| Unit migrations | `tests/test_migrations.py` | sí (Postgres real) | ~3 s | siempre que haya DB |
| Unit register security | `tests/test_register_security.py` | no | ~1 s | siempre |
| E2E auth + ownership | `tests/test_e2e.py` | sí (Postgres real) | ~5 s | sólo con `RUN_E2E=1` |
| E2E cuotas BYO | `tests/test_e2e_quota.py` | sí (Postgres real) | ~3 s | sólo con `RUN_E2E=1` |
| E2E stats / dashboard | `tests/test_stats.py` | sí (Postgres real) | ~3 s | sólo con `RUN_E2E=1` |
| E2E group chat | `tests/test_groupchat.py` | sí (Postgres real) | ~3 s | sólo con `RUN_E2E=1` |

Cobertura funcional: rutas de validación, sanitización de errores LLM,
prompt injection, rate limit, allowlist de modelos, auth completa
(incluyendo lockout, honeypot, email verification, check-email
timing-safe), ownership, RBAC dinámico, BYO Gemini key cifrada con
Fernet, cuota diaria por usuario, dashboard analítico y chat grupal
con snapshot de identidad tras borrar al autor.

## Suite unit (sin DB)

`test_smoke.py`:

- Health, root.
- Service-level con `FakeExplainLLM`, `FakeRecommendLLM`, `FakeChatLLM`.
- Validation matrix parametrizada (whitespace, oversize, role inválido,
  modelo fuera de allowlist…).
- LLM error sanitization: inyecta `ProviderFailingLLM` /
  `ResponseFailingLLM` con strings tipo `AIzaSyXXX`/quota/internal y
  asserta que ninguno aparece en el body.
- Rate limit: `RATE_LIMIT_REQUESTS=3` → cuarta llamada devuelve 429.
- Rate limit deshabilitado: 5/5 pasan (sin 429).
- Prompt-injection: capturan el prompt enviado al fake LLM y verifican
  que los logs van envueltos en `BEGIN/END_UNTRUSTED_LOG`.
- Chat con KB vacío y poblado vía `_FakeRetriever`.

Bypass de auth para que estos tests no necesiten DB:

```python
@pytest.fixture(autouse=True)
def _bypass_auth():
    app.dependency_overrides[get_current_user] = _fake_user
    yield
    app.dependency_overrides.pop(get_current_user, None)
```

`_fake_user` es un `User` admin sintético sin tocar la DB.

`test_auth.py`:

- Hash bcrypt round-trip (verify positivo y negativo, colisiones de
  salt).
- JWT issue/decode round-trip.
- Rechazo de tokens manipulados (firma corrupta), expirados, y firmados
  con secret distinto.
- HTTP gates: parametrizado sobre todos los endpoints protegidos,
  asserta `401` sin token.
- Public endpoints siguen abiertos.

## Suite E2E (con Postgres real)

`test_e2e.py`:

- Skip a nivel de módulo si `RUN_E2E != "1"`.
- `_prepare_db` per-test (autouse): `init_db()` + `DELETE FROM
  recommendations/alerts/users`. Cada test arranca con DB limpia.
- `test_first_user_becomes_admin_and_full_flow`: register/login con
  cookie httpOnly, check de SameSite=Lax, /me, segundo registro
  analyst, logout invalida.
- `test_ownership_isolation_between_users`: dos analysts y un admin.
  Cada analyst sólo ve sus propias alertas; intentos de leer las
  ajenas devuelven 404 (no 403); admin ve todas. Inyecta `FakeLLM`
  global vía `monkeypatch.setattr(llm_module, "_singleton", ...)`.

Para correr local contra el Postgres del compose:

```bash
cd "D:/Evolve/Proyecto Blue Team/soc-copilot/infra"

docker run --rm --network soc-copilot_default \
  -v "$(pwd)/../apps/api/app:/code/app" \
  -v "$(pwd)/../apps/api/scripts:/code/scripts" \
  -v "$(pwd)/../apps/api/tests:/code/tests" \
  -e GEMINI_API_KEY=dummy \
  -e RUN_E2E=1 \
  -e POSTGRES_USER=soc \
  -e POSTGRES_PASSWORD=change_me_in_prod \
  -e POSTGRES_DB=soc_copilot \
  -e POSTGRES_HOST=postgres \
  -e POSTGRES_PORT=5432 \
  -e JWT_SECRET=local-test-secret \
  -w /code soc-copilot-api:latest pytest -q tests/test_e2e.py
```

## Lint

### Backend (ruff)

Configuración en `apps/api/ruff.toml`:

- `target-version = "py312"`
- `line-length = 100`
- Rules: `E, F, W, I, B, UP, RUF` (`E501` ignorado por usar la longitud
  declarada arriba).
- `__init__.py` exime `F401` (re-exports comunes).

Comando local:

```bash
docker compose exec api ruff check app tests
```

### Frontend (ESLint 9 flat config)

Configuración en `apps/web/eslint.config.mjs`:

```js
import { FlatCompat } from "@eslint/eslintrc";
const compat = new FlatCompat({ baseDirectory: __dirname });
const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
];
export default config;
```

Sustituye al deprecado `next lint`. `npm run lint` → `eslint .`.

```bash
docker compose exec web npm run lint
```

### TypeScript

```bash
docker compose exec web npx tsc --noEmit
```

Output esperado: `EXIT=0`.

## CI (GitHub Actions)

Hay **dos workflows**: `ci.yml` (en cada push y PR, rápido, sin E2E) y
`e2e.yml` (en push a `main` y `workflow_dispatch`, suite completa con
Postgres real + Playwright).

### `ci.yml` — 3 jobs

**`api-lint-test`** (con `services.postgres: postgres:16-alpine`):

- `actions/setup-python@v5` con Python 3.12.
- `pip install -r requirements.txt`.
- `ruff check apps/api`.
- `alembic upgrade head` contra el Postgres del servicio.
- `pytest --ignore=tests/test_e2e.py -v` con
  `GEMINI_API_KEY=dummy_for_ci_no_real_calls` (los módulos E2E que
  hacen skip por `RUN_E2E != 1` no corren aquí).

**`web-lint-build`**:

- `actions/setup-node@v4` con **Node 22** (misma versión que el runtime Docker).
- `npm ci --no-audit --no-fund`.
- `npm audit --audit-level=high` con `continue-on-error: true`
  (**informativo**, no bloquea el merge; los avisos de deps transitivas
  no deben frenar trabajo no relacionado).
- `npm run lint`.
- `npm run build` con `NEXT_TELEMETRY_DISABLED=1`.

**`infra-validate`**:

- `docker compose -f infra/docker-compose.yml config -q` (dev).
- `docker compose -f infra/docker-compose.prod.example.yml config -q`
  (prod example, con `PUBLIC_DOMAIN`/`ACME_EMAIL` stub).

### `e2e.yml` — 2 jobs

**`api-e2e`** (con `services.postgres`):

- `alembic upgrade head` + `alembic check` (guarda contra drift entre
  modelos y migraciones).
- `pytest tests/test_e2e.py tests/test_migrations.py -v` con `RUN_E2E=1`.

**`e2e-frontend`** (Playwright):

- Node 22, levanta el stack completo con `docker compose up -d --build`,
  espera health de API y Next, siembra un admin vía `/api/auth/register`,
  instala Chromium y corre `npm run e2e`. Sube el `playwright-report` y
  los logs de compose como artefactos si falla.

Para mergear en `main` deben pasar los jobs de `ci.yml`; `e2e.yml`
corre además en cada push a `main`.

## Cómo añadir tests nuevos

### Pyramid recomendado

1. **Service-level con fakes** (90% de los casos). Sustituye el LLM via
   `app.services.llm._singleton` o pasa `llm=FakeLLM()` directamente al
   servicio. Sin DB, sin red.
2. **HTTP-level con TestClient** + `dependency_overrides`. Para validar
   schemas, errores, status codes. Ya existe el bypass de auth en
   `test_smoke.py`.
3. **E2E con Postgres real** sólo si la lógica depende de DB
   (transacciones, ownership, cascade deletes). Añadir al
   `test_e2e.py` y proteger con `RUN_E2E=1`.

### Patrón fake LLM

```python
class FakeLLM(LLMAdapter):
    def generate_json(self, prompt, *, schema, system=None,
                      temperature=0.2, model=None):
        return {...}  # schema-compliant fake response

    def generate_text(self, prompt, *, system=None,
                      temperature=0.2, model=None):
        return "fake reply"

    def embed(self, texts):
        return [[0.0] * 8 for _ in texts]
```

Las firmas con `model=None` son obligatorias desde fase 3 (selector de
modelo).

### Patrón override de dependencia auth

```python
from app.middleware.auth import get_current_user
from app.models import User, UserRole

def _fake_user():
    return User(id=1, email="t@e.com", hashed_password="x",
                role=UserRole.ADMIN)

app.dependency_overrides[get_current_user] = _fake_user
```

Usar siempre dentro de fixture autouse para que se restaure entre tests.

## Verificación pre-PR (lista mínima)

```bash
cd "D:/Evolve/Proyecto Blue Team/soc-copilot/infra"
docker compose exec api ruff check app tests
docker compose exec api pytest -q
docker compose exec web npm run lint
docker compose exec web npx tsc --noEmit
docker compose exec web npm run build
```

Si todo pasa, abrir PR. CI lo validará otra vez en la nube.
