# SOC Copilot

> Asistente con IA para analistas SOC, integrado con el SIEM Wazuh.
> Máster en Ciberseguridad & IA · Práctica 3 «Del prototipo al producto».

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Stack](https://img.shields.io/badge/stack-FastAPI%20%2B%20Next.js%20%2B%20Postgres%20%2B%20ChromaDB-blue)
![SIEM](https://img.shields.io/badge/SIEM-Wazuh%204.12-informational)

**Producción:** <https://soc-copilot.duckdns.org>

SOC Copilot ayuda a un equipo SOC a gestionar las alertas de su SIEM: las
recibe de Wazuh, las reparte entre los analistas según su nivel (L1, L2,
Instructor), las explica con IA y deja trazabilidad de cada decisión. La IA
**no sustituye** al analista: propone hipótesis, riesgo y técnicas MITRE
ATT&CK; la decisión siempre es humana.

---

## Índice

1. [Qué hace](#1-qué-hace)
2. [Arquitectura](#2-arquitectura)
3. [Requisitos previos](#3-requisitos-previos)
4. [Instalación paso a paso](#4-instalación-paso-a-paso)
5. [Primer acceso y usuarios de prueba](#5-primer-acceso-y-usuarios-de-prueba)
6. [Probar el SIEM sin tener Wazuh](#6-probar-el-siem-sin-tener-wazuh)
7. [Uso básico](#7-uso-básico)
8. [Pruebas automáticas](#8-pruebas-automáticas)
9. [Estructura del proyecto](#9-estructura-del-proyecto)
10. [Problemas frecuentes](#10-problemas-frecuentes)
11. [Seguridad y secretos](#11-seguridad-y-secretos)
12. [Producción y conexión con un Wazuh real](#12-producción-y-conexión-con-un-wazuh-real)
13. [Documentación y licencia](#13-documentación-y-licencia)

---

## 1. Qué hace

| Módulo | Qué hace |
|---|---|
| **SIEM · Alertas Wazuh** | Recibe las alertas de Wazuh (webhook autenticado) y las organiza en colas: Nuevas, Mis alertas, Asignadas, Escaladas, Cerradas y Para revisar |
| **Ciclo de vida de la alerta** | Nueva → Asignada → Escalada → Resuelta / Falso positivo. Para analizar, escalar o cerrar hay que tener la alerta asignada. Cierre masivo con una única resolución |
| **Niveles SOC** | L1 coge alertas nuevas y escala las graves; L2 investiga las escaladas; el Instructor valora las decisiones (Correcta, Mejorable, Incorrecta) |
| **Alert Explainer** | Analiza una alerta o un log con IA: resumen, riesgo, técnica MITRE ATT&CK y razonamiento |
| **Logs** | Analiza archivos de log y envía su contenido al Alert Explainer |
| **Siguiente paso** | Recomendaciones de respuesta para una alerta analizada |
| **Chat IA con RAG** | Conversación con citas sobre MITRE ATT&CK y OWASP Top 10 |
| **Informe de incidente** | Genera un informe en PDF desde el chat o desde una alerta |
| **Chat grupal** | Canal compartido por todo el equipo |
| **Dashboard e Histórico** | Métricas, cobertura MITRE y trazabilidad de decisiones |
| **Administración** | Usuarios, roles, aprobación de niveles, permisos, auditoría e integraciones |
| **Cuenta** | Registro con fortaleza de contraseña, MFA/TOTP obligatorio, recuperación de contraseña |

Interfaz en **español, inglés y francés**, con tema claro y oscuro.

---

## 2. Arquitectura

```text
  Navegador ──HTTPS──► Caddy 2 (proxy, TLS, logs de acceso)
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
        web · Next.js          api · FastAPI ──► Google Gemini (IA)
                                 │   │   ▲
                                 │   │   └── webhook ◄── Wazuh (SIEM)
                                 │   └────── ChromaDB (base de conocimiento)
                                 └────────── PostgreSQL 16
```

| Componente | Tecnología |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Alembic |
| Frontend | Next.js 15, React 19, Tailwind, Recharts |
| Base de datos | PostgreSQL 16 |
| Base de conocimiento (RAG) | ChromaDB 0.5 |
| IA | Google Gemini (`gemini-3.5-flash-lite` por defecto) |
| SIEM | Wazuh 4.12 (opcional; incluye un simulador) |
| Proxy (producción) | Caddy 2 |

En local, **todo corre en Docker**: no hace falta instalar Python,
PostgreSQL ni Wazuh.

---

## 3. Requisitos previos

| Necesitas | Para qué | Cómo comprobarlo |
|---|---|---|
| **Docker Desktop** (Windows/macOS) o Docker Engine + Compose v2 (Linux) | Levantar todos los servicios | `docker compose version` |
| **Git** | Descargar el repositorio | `git --version` |
| **Clave de API de Gemini** (gratuita) | Análisis con IA, chat e informes | Se crea en <https://aistudio.google.com/app/apikey> |
| **App de autenticación** en el móvil (Google Authenticator, Microsoft Authenticator, Authy…) | El MFA es obligatorio | — |
| Node.js 20 o superior *(opcional)* | Solo para pasar los tests del frontend | `node -v` |

Unos **4 GB de RAM libres** para Docker y unos 5 GB de disco.

> **Windows:** clona el proyecto en una ruta **sencilla del disco C:**
> (por ejemplo `C:\dev\soc-copilot`), **sin espacios ni símbolos como `&`**
> y **fuera de OneDrive**. Las rutas con `&`, los discos externos y las
> carpetas sincronizadas hacen fallar a Docker y a npm.

---

## 4. Instalación paso a paso

Los comandos sirven en **PowerShell** (Windows) y en **bash** (Linux/macOS);
donde cambian, se indican los dos. Se ejecutan desde la **raíz del
repositorio**.

### 4.1 Descargar el código

```bash
git clone https://github.com/f3l0X/soc-copilot.git
cd soc-copilot
```

### 4.2 Crear el archivo `.env`

Copia la plantilla:

```powershell
# PowerShell
Copy-Item .env.example .env
```

```bash
# bash
cp .env.example .env
```

### 4.3 Rellenar las variables obligatorias

Abre `.env` y rellena estas variables. Las tres claves secretas se
**generan en tu equipo** con los comandos de debajo; no las copies de
ningún sitio.

| Variable | Qué poner |
|---|---|
| `GEMINI_API_KEY` | Tu clave de Gemini |
| `JWT_SECRET` | Una cadena aleatoria larga (comando abajo) |
| `APP_ENCRYPTION_KEY` | Una clave Fernet (comando abajo). **Imprescindible para el MFA** |
| `WAZUH_WEBHOOK_TOKEN` | Un token aleatorio (comando abajo). Lo usan Wazuh y el simulador |
| `POSTGRES_PASSWORD` | Cualquier contraseña para la base de datos local |

El resto de variables ya traen valores válidos para local
(`APP_ENV=development`, `MFA_REQUIRED=true`,
`GEMINI_CHAT_MODEL=gemini-3.5-flash-lite`, `WAZUH_MIN_RULE_LEVEL=7`…).

**Generar las claves** con el Python que ya trae el contenedor de la API
(sirve igual en Windows, macOS y Linux; no hace falta instalar nada).
`run --rm --no-deps` lanza un contenedor temporal solo para generar la
clave: no arranca el resto de servicios y se borra al terminar. La primera
vez, Docker construye antes la imagen de la API (unos minutos).

```bash
# JWT_SECRET → copia el resultado en el .env
docker compose -f infra/docker-compose.yml --env-file .env run --rm --no-deps api python -c "import secrets; print(secrets.token_hex(32))"

# WAZUH_WEBHOOK_TOKEN → vuelve a ejecutar el mismo comando y copia el nuevo resultado
docker compose -f infra/docker-compose.yml --env-file .env run --rm --no-deps api python -c "import secrets; print(secrets.token_hex(32))"

# APP_ENCRYPTION_KEY (clave Fernet)
docker compose -f infra/docker-compose.yml --env-file .env run --rm --no-deps api python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Usa un valor **distinto** para `JWT_SECRET` y para `WAZUH_WEBHOOK_TOKEN`.

> No cambies `APP_ENCRYPTION_KEY` una vez que los usuarios hayan activado
> el MFA: los secretos guardados dejarían de poder leerse.

### 4.4 Arrancar

Con Docker Desktop abierto (*Engine running*):

```bash
docker compose -f infra/docker-compose.yml --env-file .env up -d --build
```

La primera vez tarda **5-10 minutos** (descarga y construye las imágenes).
Las migraciones de la base de datos se aplican solas al arrancar la API.

### 4.5 Comprobar que todo funciona

```bash
docker compose -f infra/docker-compose.yml --env-file .env ps
docker compose -f infra/docker-compose.yml --env-file .env exec api alembic current
```

- Los servicios `postgres`, `chroma`, `api` y `web` deben estar **Up**, y
  `postgres`, `api` y `web` además **(healthy)**. `web` puede tardar unos
  30 segundos más.
- `alembic current` debe terminar en **`0011_alert_reviews (head)`**.

| Dirección | Qué es |
|---|---|
| <http://localhost:13500> | La aplicación |
| <http://localhost:8080/api/health> | Debe responder `{"status":"ok"}` |
| <http://localhost:8080/docs> | Documentación interactiva de la API (Swagger) |

### 4.6 Cargar la base de conocimiento del chat *(opcional)*

Para que el Chat IA cite MITRE ATT&CK y OWASP (unos 5 minutos, usa cuota
de Gemini):

```bash
docker compose -f infra/docker-compose.yml --env-file .env exec api python -m scripts.ingest_kb
```

Sin este paso el chat funciona, pero sin citas («KB no disponible»).

---

## 5. Primer acceso y usuarios de prueba

### 5.1 Crear el administrador

1. Abre <http://localhost:13500> y pulsa **Regístrate**.
   **El primer usuario que se registra es el administrador.**
2. Inicia sesión. Aparece **«Activa la verificación en dos pasos»** con un
   código QR: escanéalo con la app de autenticación y escribe el código de
   6 dígitos.
3. Guarda los **10 códigos de recuperación** que aparecen (solo se
   muestran una vez).

A partir de ahí, cada inicio de sesión pide contraseña y código.

> Si no hay correo configurado (lo normal en local), los enlaces de
> verificación y de recuperación de contraseña aparecen **en la propia
> pantalla**, en un recuadro amarillo («Modo desarrollo»).

### 5.2 Crear los usuarios de prueba

Para ver las diferencias por nivel hacen falta tres cuentas más. Usa
siempre **datos ficticios**:

| Usuario | Nivel al registrarse | Contraseña |
|---|---|---|
| `admin@example.com` | — (primer usuario: administrador) | La que elijas |
| `l1@example.com` | Analista L1 | La que elijas |
| `l2@example.com` | Analista L2 | La que elijas |
| `instructor@example.com` | Instructor | La que elijas |

1. Registra cada cuenta desde la página de registro, eligiendo su nivel.
2. Los niveles L2 e Instructor **necesitan la aprobación de un
   administrador**: hasta entonces, la cuenta funciona como L1. Entra como
   administrador, ve a **Admin** y aprueba el nivel de cada una.
3. Cada cuenta activa su propio MFA en su primer inicio de sesión.

Las contraseñas deben tener al menos 10 caracteres, con mayúsculas,
minúsculas, números y símbolos.

---

## 6. Probar el SIEM sin tener Wazuh

No hace falta instalar Wazuh para probar el producto. El repositorio
incluye un **simulador** que envía alertas con el mismo formato y por el
mismo webhook que usa Wazuh:

```bash
docker compose -f infra/docker-compose.yml --env-file .env exec api python integrations/wazuh/wazuh_simulator.py --count 8 --interval 1
```

- Cada alerta enviada debe responder `'created': 1`.
- Las de **nivel inferior a 7** responden `'below_threshold': 1`: se
  descartan a propósito.
- Las alertas aparecen en **SIEM · Alertas Wazuh** en un máximo de 15
  segundos (la página se refresca sola).
- Prueba de duplicados: lanza dos veces el mismo comando con
  `--seed 42 --count 5`; la segunda vez todas responden `'duplicates': 1`.

> **Integración simulada.** En local, las alertas del SIEM proceden de este
> simulador. En producción proceden de un Wazuh 4.12 real (sección 12).

---

## 7. Uso básico

El recorrido completo de una alerta, con las cuentas del apartado 5:

1. **L1** (`l1@example.com`) → **SIEM · Alertas Wazuh**, cola **Nuevas** →
   **Asignármela** en una alerta. Se abre en la página **Alertas**,
   marcada como «Asignada a: Ti».
2. **Analizar**: la IA devuelve resumen, riesgo, MITRE y razonamiento.
3. Si el riesgo es bajo o medio, el L1 puede **Resolver** o **Marcar falso
   positivo** con una resolución. Si es alto o crítico, debe **Escalar** con
   una nota.
4. **L2** (`l2@example.com`) → cola **Escaladas** → **Asignármela** → la
   investiga y la cierra. También puede reabrir alertas cerradas.
5. **Instructor** (`instructor@example.com`) → cola **Para revisar** →
   valora la decisión como Correcta, Mejorable o Incorrecta, con un
   comentario. El analista lo ve en su alerta.
6. Para cerrar muchas alertas a la vez (por ejemplo, tras una actualización
   del sistema): marca sus casillas en la tabla → **Resolver** → una única
   resolución.

Cada paso queda en el **historial** de la alerta y en la **auditoría**
(Admin).

---

## 8. Pruebas automáticas

### Backend

```bash
# Estilo y errores → "All checks passed!"
docker compose -f infra/docker-compose.yml --env-file .env exec api ruff check app tests

# Tests unitarios y de integración → "... passed" y ningún "failed"
docker compose -f infra/docker-compose.yml --env-file .env exec api pytest -q --ignore=tests/test_e2e.py

# Modelos y migraciones coherentes → "No new upgrade operations detected."
docker compose -f infra/docker-compose.yml --env-file .env exec api alembic check
```

> ⚠️ Los **tests de punta a punta borran todos los usuarios y alertas**.
> Ejecútalos solo en local y al final:
>
> ```bash
> docker compose -f infra/docker-compose.yml --env-file .env exec -e RUN_E2E=1 -e MFA_REQUIRED=false api pytest tests/test_e2e.py tests/test_e2e_wazuh.py tests/test_e2e_mfa.py tests/test_e2e_password_reset.py -v
> ```

### Frontend

```bash
cd apps/web
npm ci
npx tsc --noEmit
npm run lint
npm run build
```

### Integración continua

Cada Pull Request ejecuta en GitHub Actions:

- **CI**: lint y tests de la API, lint y build de la web, validación del
  compose.
- **E2E**: levanta la aplicación completa con Docker, comprueba que modelos
  y migraciones coinciden y ejecuta los tests de punta a punta de la API y
  de la web (Playwright).

---

## 9. Estructura del proyecto

```text
soc-copilot/
├── apps/
│   ├── api/                  # Backend FastAPI
│   │   ├── app/
│   │   │   ├── routers/      # Endpoints (alerts, auth, mfa, integrations…)
│   │   │   ├── services/     # Lógica (alert_workflow, explainer, llm, wazuh…)
│   │   │   ├── schemas/      # Validación de entradas y salidas (Pydantic)
│   │   │   ├── models.py     # Tablas de la base de datos
│   │   │   └── config.py     # Configuración desde variables de entorno
│   │   ├── alembic/versions/ # Migraciones 0001 a 0011
│   │   ├── scripts/          # Ingesta de la base de conocimiento, etc.
│   │   └── tests/            # Tests de la API
│   └── web/                  # Frontend Next.js
│       ├── src/app/          # Páginas (siem, alerts, logs, chat, admin…)
│       ├── src/components/   # Componentes (AppShell, AlertWorkflowPanel…)
│       ├── src/lib/          # Cliente de la API, i18n, autenticación
│       └── e2e/              # Tests de Playwright
├── infra/
│   ├── docker-compose.yml    # Entorno local
│   └── caddy/Caddyfile       # Proxy de producción
├── integrations/wazuh/       # Integración con Wazuh y simulador
├── scripts/deploy.sh         # Despliegue en producción
├── docs/                     # Documentación detallada
└── .env.example              # Plantilla de configuración (sin secretos)
```

---

## 10. Problemas frecuentes

| Lo que ves | Solución |
|---|---|
| `port is already allocated` (13500, 8080, 55432 u 8001) | Otro contenedor usa el puerto: `docker ps`, y para el antiguo con `docker compose -p <proyecto> down` |
| Error **502 «AI provider error»** | `GEMINI_API_KEY` vacía o inválida, o el modelo no está disponible para tu clave. Usa los modelos 3.x del `.env.example` y recrea la API: `up -d --force-recreate api`. Comprueba también el modelo elegido en **Settings** |
| Error 503 al mostrar el QR del MFA | Falta `APP_ENCRYPTION_KEY` en `.env` (apartado 4.3) |
| «Código incorrecto» con un código bueno | Activa la hora automática en el móvil y en el equipo |
| El simulador responde 401 o 503 | Falta `WAZUH_WEBHOOK_TOKEN` o la API no se recreó tras ponerlo: `up -d --force-recreate api` |
| No puedo analizar una alerta del SIEM | Hay que **asignársela** primero (botón *Asignármela*) |
| La API no arranca: `Refusing to start with insecure configuration` | En local, deja `APP_ENV=development` |
| `npm install` falla en Windows | Ruta con `&`, espacios o dentro de OneDrive: mueve el proyecto (apartado 3) |
| `mkdir /run/desktop/mnt/host/e: file exists` al arrancar | Docker Desktop no puede montar un disco externo o USB: cierra Docker Desktop, ejecuta `wsl --shutdown`, vuelve a abrirlo o mueve el proyecto a `C:` |
| *«MFA secret unreadable»* | Ha cambiado `APP_ENCRYPTION_KEY` después de activar el MFA: vuelve a poner la clave anterior, o resetea el MFA del usuario (comando abajo) |
| No deja entrar tras varios intentos | Tras 4 fallos (contraseña o código) la cuenta se bloquea 15 minutos; espera, o reinicia la API en local: `restart api` |
| Error 429 al iniciar sesión | Más de 5 intentos por minuto desde la misma IP: espera un minuto |
| Un usuario ha perdido el móvil del MFA | Que use un código de recuperación, o que un administrador pulse **Reset MFA** en **Admin → Usuarios** |
| **El administrador** ha perdido el móvil y los códigos | Resetea su MFA desde la base de datos (comando abajo) y vuelve a iniciar sesión: pedirá un QR nuevo |
| Error 429 «Daily AI call quota exhausted» | Agotadas las llamadas diarias con la clave compartida: cada usuario puede poner su propia clave de Gemini en **Settings**, o un administrador pulsa **Reset cuota** en **Admin** |
| El chat dice «KB no disponible» | No se ha cargado la base de conocimiento (apartado 4.6) |
| El enlace de recuperación dice «inválido o caducado» | Caduca a los 30 minutos y solo vale una vez: pide uno nuevo |
| La web sigue con el aspecto antiguo | Caché del navegador: `Ctrl + F5` o una ventana de incógnito |

**Resetear el MFA de un usuario** (en local). Entra en la base de datos:

```bash
docker compose -f infra/docker-compose.yml --env-file .env exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

y, en el prompt `soc_copilot=#`, ejecuta (cambiando el email) y sal con `\q`:

```sql
UPDATE users SET mfa_enabled = false, mfa_secret_ciphertext = NULL,
  mfa_recovery_codes = NULL, mfa_last_used_step = NULL
WHERE email = 'admin@example.com';
```

**Ver qué está fallando:** los logs suelen indicar la causa exacta.

```bash
docker compose -f infra/docker-compose.yml --env-file .env logs --tail 80 api
docker compose -f infra/docker-compose.yml --env-file .env logs --tail 80 web
```

**Empezar de cero** (⚠️ borra la base de datos local):

```bash
docker compose -f infra/docker-compose.yml --env-file .env down -v
docker compose -f infra/docker-compose.yml --env-file .env up -d --build
```

---

## 11. Seguridad y secretos

- **Ningún secreto está en el repositorio.** El `.env` está en
  `.gitignore`; `.env.example` solo tiene valores de ejemplo. Cada
  instalación genera sus propias claves (apartado 4.3).
- **MFA/TOTP obligatorio**, códigos de un solo uso y secretos cifrados con
  Fernet. En producción, la API se niega a arrancar con
  `MFA_REQUIRED=false` o claves de ejemplo.
- **Reglas por nivel comprobadas en la API**, no solo en la interfaz
  (respuestas 403 y 409).
- **Webhook de Wazuh autenticado** con un token de 256 bits; alertas
  deduplicadas.
- **Dependencias revisadas** con `npm audit` (0 vulnerabilidades conocidas
  en las dependencias de producción de la web).
- **Auditoría** de cada acción e historial por alerta.

Detalle en [docs/security.md](docs/security.md).

---

## 12. Producción y conexión con un Wazuh real

- **Despliegue:** `sudo -u soc bash scripts/deploy.sh` en el servidor, con
  copia de seguridad previa de la base de datos si hay migraciones. Detalle
  en [docs/operations.md](docs/operations.md).
- **Wazuh real:** instalar el script `integrations/wazuh/custom-soccopilot.py`
  en el manager de Wazuh y añadir el bloque `<integration>` de
  `integrations/wazuh/ossec-integration.xml` con la URL del webhook y el
  mismo `WAZUH_WEBHOOK_TOKEN`. Detalle en
  [docs/13-integracion-wazuh.md](docs/13-integracion-wazuh.md).

---

## 13. Documentación y licencia

| Para… | Lee |
|---|---|
| Manual de usuario | [docs/10-manual-usuario.md](docs/10-manual-usuario.md) |
| Arquitectura | [docs/03-arquitectura.md](docs/03-arquitectura.md) |
| Referencia de la API | [docs/06-api-reference.md](docs/06-api-reference.md) |
| Integración con Wazuh | [docs/13-integracion-wazuh.md](docs/13-integracion-wazuh.md) |
| Seguridad | [docs/security.md](docs/security.md) |
| Operación en producción | [docs/operations.md](docs/operations.md) |
| Cambios | [docs/12-changelog.md](docs/12-changelog.md) |

Repositorio: <https://github.com/f3l0X/soc-copilot>

Licencia **MIT**: ver [LICENSE](LICENSE).
