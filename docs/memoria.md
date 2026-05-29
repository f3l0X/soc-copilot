# Memoria del Proyecto — SOC Copilot

> **Práctica 1 · Ciberseguridad con IA**
> Máster de Ciberseguridad e IA — Módulo Ciberseguridad Avanzada
> Curso 2025-2026 · Línea Blue Team
>
> **Entrega:** 25 de mayo de 2026
> **Producción:** <https://soc-copilot.duckdns.org>
> **Repositorio:** <https://github.com/f3l0X/soc-copilot>

---

## Portada

**Título del proyecto:** SOC Copilot — IA Copilot para Analistas SOC Junior

**Integrantes:**

| Nombre | Rol principal en el proyecto |
|--------|------------------------------|
| _[Integrante 1]_ | _[rol]_ |
| _[Integrante 2]_ | _[rol]_ |
| _[Integrante 3]_ | _[rol]_ |
| _[Integrante 4]_ | _[rol]_ |
| _[Integrante 5]_ | _[rol]_ |

**Fecha de entrega:** 25 de mayo de 2026
**Tutor/a:** _[nombre del tutor]_

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Descripción del problema y justificación](#2-descripción-del-problema-y-justificación)
3. [Objetivos](#3-objetivos)
4. [Arquitectura técnica](#4-arquitectura-técnica)
5. [Proceso de desarrollo](#5-proceso-de-desarrollo)
6. [Seguridad y hardening](#6-seguridad-y-hardening)
7. [Guía de despliegue](#7-guía-de-despliegue)
8. [Manual de uso](#8-manual-de-uso)
9. [Calidad y pruebas](#9-calidad-y-pruebas)
10. [Conclusiones y lecciones aprendidas](#10-conclusiones-y-lecciones-aprendidas)
11. [Roadmap Práctica 2](#11-roadmap-práctica-2)
12. [Anexos](#12-anexos)

---

## 1. Resumen ejecutivo

**SOC Copilot** es una aplicación web pensada para apoyar a analistas
SOC junior durante la triage de alertas de seguridad. Combina cinco
capacidades en un único producto:

1. **Alert Explainer** — el analista pega un log y obtiene un resumen
   en lenguaje claro, severidad calculada, técnica MITRE ATT&CK probable
   y próximos pasos sugeridos.
2. **Next Step Recommender** — recomendaciones accionables sobre una
   alerta ya analizada, con un *modo aprendizaje* opcional pensado
   para perfiles L1.
3. **Chat IA con RAG** — conversación con citas verificables sobre
   MITRE ATT&CK Enterprise y OWASP Top 10 2025 (707 documentos en
   ChromaDB).
4. **Dashboard analítico y panel de administración** — KPIs,
   distribución por nivel de riesgo, evolución temporal, top de
   técnicas MITRE detectadas, gestión de usuarios, RBAC dinámico y
   auditoría inmutable.
5. **Chat grupal del equipo** — canal único compartido por todos los
   usuarios autenticados para coordinar guardias y triage en directo.

El producto está desplegado en producción sobre un VPS de Hetzner
Cloud con HTTPS gestionado por Caddy, autenticación por cookie
firmada, base de datos PostgreSQL persistida y copias de seguridad
diarias. La IA no sustituye al analista: propone hipótesis y
referencias; la decisión final siempre es humana.

Stack: **FastAPI + Next.js + PostgreSQL + ChromaDB + Gemini**, todo
orquestado con Docker Compose y publicado tras un reverse proxy Caddy.

---

## 2. Descripción del problema y justificación

### 2.1. Contexto

Los Centros de Operaciones de Seguridad (SOC) reciben centenares de
alertas al día. Los analistas L1, normalmente perfiles junior recién
incorporados, dedican gran parte de su jornada a una tarea muy
concreta: **leer una alerta, entender qué significa, decidir si es un
falso positivo y elegir el siguiente paso**. Es la fase de triage.

Los problemas habituales en esta fase son:

- **Sobrecarga cognitiva** — un L1 no domina todavía todas las
  técnicas MITRE ATT&CK ni los CWE/OWASP de cabeza.
- **Heterogeneidad de logs** — cada fuente (sshd, iptables, IIS,
  Suricata…) tiene su formato. El analista pierde tiempo extrayendo
  IP, puerto, usuario o hash.
- **Falta de criterio de prioridad** — sin un baremo claro, un
  brute-force fallido contra una cuenta de servicio puede recibir la
  misma atención que un escaneo desde un host comprometido.
- **Curva de aprendizaje lenta** — el conocimiento se transmite por
  *shadowing* del L2/L3, que no siempre está disponible.

### 2.2. Por qué IA y por qué ahora

Los modelos LLM modernos (Gemini, GPT-4, Claude, etc.) son ya capaces
de:

- resumir texto técnico en lenguaje claro,
- razonar sobre evidencia parcial,
- citar fuentes si se les proporcionan vía RAG,
- adaptar el tono según el nivel del lector.

Esto encaja perfectamente con las tareas que ahogan a un L1. Pero
**no encaja con la decisión final**: alucinaciones, falsa seguridad
y ausencia de contexto operativo hacen que la IA tenga que actuar
como *copilot*, no como piloto.

### 2.3. Por qué este proyecto

SOC Copilot es la materialización práctica de esa idea, ajustada al
alcance de un grupo de _[5]_ personas con un mes de trabajo:

- Cubre el ciclo completo (explicar → recomendar → consultar →
  observar) en un único producto.
- Aterriza la teoría del módulo Blue Team en una herramienta
  ejecutable y desplegada.
- Permite repartir funcionalidades diferenciadas entre los miembros
  del grupo (criterio explícito de la rúbrica).
- Deja una base extensible para la Práctica 2 (ver §11).

---

## 3. Objetivos

### 3.1. Funcionales

- **OF-1.** Generar un análisis estructurado a partir de un log libre,
  incluyendo summary, risk level, técnicas MITRE y siguientes pasos.
- **OF-2.** Persistir el histórico de alertas y recomendaciones por
  usuario, con ownership (un analista no ve alertas de otro).
- **OF-3.** Permitir consulta natural sobre MITRE y OWASP con citas
  verificables (RAG).
- **OF-4.** Ofrecer un panel administrativo con gestión de usuarios,
  RBAC dinámico y auditoría.
- **OF-5.** Exponer un dashboard analítico para visualizar KPIs y
  tendencias del histórico.
- **OF-6.** Habilitar coordinación en directo del equipo SOC
  mediante un chat grupal autenticado.

### 3.2. No funcionales

- **ONF-1.** Acceso autenticado obligatorio para cualquier endpoint
  con consumo de LLM o acceso a datos sensibles.
- **ONF-2.** HTTPS con HSTS preload en producción, sin puertos
  internos expuestos a Internet.
- **ONF-3.** Defensas frente a prompt injection y RAG poisoning
  mediante delimitadores explícitos.
- **ONF-4.** Hardening de la cadena de autenticación: bcrypt + JWT
  invalidable con `password_version`, lockout tras N fallos,
  honeypot anti-bot.
- **ONF-5.** Despliegue reproducible vía Docker Compose, con
  configuración separada para dev y producción.
- **ONF-6.** Copias de seguridad diarias de la base de datos, **cifradas
  con age** (systemd timer), con retención 7 diarias + 4 semanales en el
  VPS, offsite opcional, y copia offline en Windows.

### 3.3. Mapeo con la rúbrica

| Peso | Criterio | Cobertura |
|------|----------|-----------|
| 30% | Funcionalidad | OF-1 a OF-6, todas en producción |
| 20% | Informe PDF | Este documento |
| 15% | Dashboard / UX | `/dashboard` con Recharts, header sticky, header global, paneles admin con cuatro pestañas |
| 15% | Despliegue Hetzner | CPX22 + Caddy + HTTPS + backups (§7) |
| 10% | Calidad del repositorio | Monorepo, CI, tests, ruff, ESLint, documentación (§9) |
| 10% | Roadmap | §11 |

---

## 4. Arquitectura técnica

### 4.1. Visión general

```text
                    ┌─────────────────┐
                    │     Caddy 2     │  TLS auto (Let's Encrypt)
                    │  HTTP/2 + HTTP/3│  HSTS preload
                    └────────┬────────┘
                ┌────────────┼────────────┐
                │            │            │
        /api/*  │            │            │  /*
                ▼            ▼            ▼
       ┌─────────────┐                 ┌─────────────┐
       │  FastAPI    │◄────────────────│  Next.js    │
       │  (uvicorn)  │   internal API  │  (standalone│
       │             │                 │   runtime)  │
       └──┬───┬───┬──┘                 └─────────────┘
          │   │   │
          │   │   └─── ChromaDB (RAG: MITRE + OWASP)
          │   └─────── Gemini API (chat + embeddings)
          └─────────── Postgres 16 (users, alerts, audit, app_settings)
```

Detalle completo y diagramas Mermaid (componentes, despliegue, flujo
de datos y secuencia de autenticación) en
[09-diagramas.md](09-diagramas.md) y [03-arquitectura.md](03-arquitectura.md).

### 4.2. Stack y versiones

| Capa | Tecnología | Versión | Por qué |
|------|------------|---------|---------|
| Backend API | FastAPI + Uvicorn | 0.115 / 0.32 | Async-first, validación con Pydantic, OpenAPI gratis |
| ORM + migraciones | SQLAlchemy + Alembic | 2.0 / 1.14 | Esquema versionado y reproducible |
| Base de datos | PostgreSQL | 16-alpine | ACID, JSONB para audit, types ricos |
| RAG / vector store | ChromaDB | 0.5.23 | Persistencia local, sin servicio cloud, embebible |
| LLM | Gemini (`2.5-flash-lite`, `2.5-flash`, embeddings) | API v1 | Tier gratuito generoso, latencia aceptable, multi-lenguaje |
| Auth | PyJWT (cookie httpOnly) + bcrypt + lockout | — | Sin terceros, control total |
| Frontend | Next.js (app router, standalone) | 22-alpine | SSR + DX moderna; *standalone* permite bundle mínimo en Docker |
| UI | React + Tailwind + Recharts | — | Gráficas con bajo peso (~50 KB gz) |
| Reverse proxy | Caddy 2 | alpine | TLS automático, HTTP/3, configuración mínima |
| Hosting | Hetzner Cloud CPX22 | Nuremberg | 3 vCPU / 4 GB RAM / 80 GB SSD a ~8,5 €/mes |

### 4.3. Modelo de dominio

Tablas principales (gestionadas por Alembic; ver
[apps/api/alembic/versions/](../apps/api/alembic/versions)):

| Tabla | Propósito |
|-------|-----------|
| `users` | Identidades, contraseñas hash, rol, nivel SOC (L1/L2/Instructor), `password_version` para invalidar tokens |
| `alerts` | Logs analizados, salida estructurada del LLM (summary, risk, MITRE, reasoning), FK a `users` |
| `recommendations` | Siguientes pasos asociados a una alerta |
| `audit_logs` | Acciones admin (create/delete/role change/permissions update) inmutables con diff JSON |
| `role_permissions` | RBAC dinámico editable desde la UI |
| `app_settings` | Toggles dinámicos sin redeploy (p.ej. registro público abierto/cerrado) |
| `group_messages` | Mensajes del chat grupal con snapshot de identidad del autor |

### 4.4. Decisiones arquitectónicas relevantes

- **`LLMAdapter` provider-agnostic** — el código sólo conoce
  `LLMAdapter`; `GeminiAdapter` es la implementación actual. Cambiar
  a OpenAI o Anthropic mañana es enchufar otra clase.
- **Allowlist server-side de modelos** — el frontend manda un modelo
  pedido, pero la API valida contra una lista cerrada para evitar que
  un actor abuse de modelos no presupuestados.
- **Delimitadores `BEGIN/END_UNTRUSTED_*`** en todos los prompts que
  meten contenido externo (log del usuario, fragmentos del RAG). Es
  la defensa primaria contra prompt injection y RAG poisoning.
- **JWT invalidable** — el token transporta `pv`
  (`password_version`). Cualquier cambio sensible en el usuario
  (reset, rol) bumpea el contador → todas las sesiones previas mueren.
- **Cookie httpOnly + SameSite=Strict + Secure en prod** — el token
  no es accesible desde JavaScript, mitigando XSS-stealing.

---

## 5. Proceso de desarrollo

### 5.1. Metodología

Trabajo iterativo por **fases con criterio de aceptación explícito**,
gestionado en `docs/02-estado-fases.md`. Cada fase: PR a `main` con
revisión de otro miembro, CI verde obligatoria, actualización del
changelog.

Comunicación interna: _[Discord/Slack — completar]_. Repositorio en
GitHub con Actions corriendo lint + tests + audit en cada push.

### 5.2. Cronología

| Fase | Hito | Estado |
|------|------|--------|
| 0 | Setup repo + Docker Compose + CI | ✅ |
| 1 | Alert Explainer (Gemini + MITRE) | ✅ |
| 2 | Next Step Recommender + persistencia Postgres + Alembic | ✅ |
| 3 | RAG + Chat IA (MITRE + OWASP en Chroma, 707 docs) | ✅ |
| 4 | Auth JWT + RBAC dinámico + auditoría + tests E2E | ✅ |
| 4.5 | Dashboard analítico con Recharts | ✅ |
| 5 | Despliegue Hetzner + HTTPS + backups + SMTP + toggle registro | ✅ |
| Post-5 | BYO Gemini key, niveles SOC L1/L2/Instructor, lockout, honeypot, chat grupal | ✅ |
| 6 | Memoria PDF + presentación 10 min | ⏳ en curso |

Detalle por fase en [02-estado-fases.md](02-estado-fases.md). Histórico
visible en [12-changelog.md](12-changelog.md).

### 5.3. Reparto de responsabilidades

| Integrante | Áreas principales |
|------------|-------------------|
| _[Integrante 1]_ | _[ej. Backend FastAPI + Alembic + servicios LLM]_ |
| _[Integrante 2]_ | _[ej. Frontend Next.js + dashboard + paneles admin]_ |
| _[Integrante 3]_ | _[ej. RAG + ingestión KB + ChromaDB]_ |
| _[Integrante 4]_ | _[ej. Auth + RBAC + auditoría + tests E2E]_ |
| _[Integrante 5]_ | _[ej. Infra Hetzner + Caddy + backups + observabilidad]_ |

> **Nota para el grupo:** completar esta tabla con los nombres reales y
> las áreas específicas. La rúbrica valora explícitamente la
> identificación de contribuciones por persona.

### 5.4. Evidencias

Cada fase deja rastro reproducible:

- **Commits** firmados en `main` con mensajes convencionales (`feat:`,
  `fix:`, `docs:`, `ci:`).
- **Pull Requests** con descripción, checklist de tests y screenshots
  cuando hay cambio visible.
- **Changelog** humano por release en
  [docs/12-changelog.md](12-changelog.md).
- **Migraciones Alembic** numeradas y reversibles
  (0001 → 0005 a fecha de entrega).
- **Capturas** de los flujos críticos en `docs/assets/` (incluidas en
  los anexos de esta memoria).

---

## 6. Seguridad y hardening

SOC Copilot es una herramienta de ciberseguridad: descuidar la suya
sería contradictorio. Resumen del trabajo de hardening; detalle en
[security.md](security.md) y [vulnerability_report.md](vulnerability_report.md).

### 6.1. Autenticación y sesión

- bcrypt con coste por defecto (12), nunca almacenamos contraseñas
  en claro.
- JWT HS256 con TTL 1h, claim `pv` para invalidación selectiva.
- Cookie `soc_session` httpOnly + SameSite + Secure en prod.
- **Lockout** tras N fallos consecutivos (configurable). Mensaje
  opaco para no filtrar el estado de la cuenta.
- **Honeypot** anti-bot en el formulario de registro
  (`payload.website`) + rate limit por email además de por IP.
- **Verificación de email** opcional vía SMTP (Gmail App Password
  en producción).
- **Normalización de tiempos** en el endpoint de login para mitigar
  *timing attacks*.

### 6.2. Autorización

- Rol `analyst` / `admin` + nivel SOC L1/L2/Instructor (ortogonal).
- **RBAC dinámico**: tabla `role_permissions` editable desde la UI;
  cada endpoint admin protegido por `require_perm("clave")`. La
  permission `permissions.manage` está marcada como `locked` para
  evitar lockout total del admin.
- **Ownership**: un analista solo ve sus alertas; un admin las ve
  todas, incluidas las legacy sin owner. Se devuelve 404 (no 403) a
  un no-owner para no filtrar la existencia del recurso.

### 6.3. Defensa frente a abuso del LLM

- **Allowlist server-side** de modelos. El cliente puede pedir, el
  servidor decide.
- **Cuota diaria** por usuario sobre la clave compartida; cuando se
  agota, el usuario puede aportar su propia clave Gemini (cifrada
  con Fernet, validada con ping previo antes de persistir).
- **Delimitadores anti prompt-injection** y anti RAG-poisoning en
  todos los prompts.
- **Sanitización** redundante: regex de longitud máxima en logs y
  filtrado de instrucciones embebidas en el contenido del usuario.

### 6.4. Infraestructura

- **VPS endurecido**: SSH key-only en **puerto 2222**, `PermitRootLogin no`,
  `AllowUsers soc`, UFW (2222/80/443 + 443/udp), fail2ban sobre sshd,
  `unattended-upgrades` automático.
- **Caddy con HSTS preload, CSP, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy**.
- **Secretos rotados** a `openssl rand` antes de salir a producción.
  `.env` con permisos `600`, copia offline.
- **Rate limit en memoria** por IP detrás del reverse proxy con
  `X-Forwarded-For` confiable (Caddy con `trusted_proxies`).
- **Backups**: `pg_dump | gzip | age` diario vía systemd timer en el VPS
  (cifrados, retención 7 diarias + 4 semanales, offsite rclone opcional)
  + copia offline en Windows.

### 6.5. Vulnerabilidades detectadas y mitigadas durante el desarrollo

Lista completa en [vulnerability_report.md](vulnerability_report.md).
Ejemplos:

- **ReDoS** potencial en un parser de logs → cap de longitud y
  límite del backtracking.
- **Seed admin con credenciales por defecto** → eliminado; el primer
  registro vía API se autopromueve a admin, sin credenciales en el
  binario.
- **EmailStr sustituido por regex** (regresión) → restaurado.
- **`npm audit`** en CI con `--audit-level=high`.

---

## 7. Guía de despliegue

### 7.1. Desarrollo local

```bash
git clone git@github.com:f3l0X/soc-copilot.git
cd soc-copilot
cp .env.example .env
# Rellenar GEMINI_API_KEY y secretos
docker compose -f infra/docker-compose.yml --env-file .env up -d --build
```

Aplicación en <http://localhost:13500>. El primer registro se
autopromueve a `admin`.

Para que el chat con RAG funcione hay que poblar ChromaDB (~5 min, usa
cuota de Gemini para embeddings):

```bash
docker compose -f infra/docker-compose.yml --env-file .env \
  exec api python -m scripts.ingest_kb
```

Guía completa en
[01-instalacion-local.md](01-instalacion-local.md) y detalles de
ingestión en [08-rag-ingestion.md](08-rag-ingestion.md).

### 7.2. Producción (Hetzner CPX22)

Resumen de pasos; manual completo en [operations.md](operations.md).

1. **Provisión** de VPS Hetzner CPX22 en Nuremberg
   (3 vCPU / 4 GB / 80 GB).
2. **DNS** vía DuckDNS: `soc-copilot.duckdns.org → IP_VPS`.
3. **Hardening base** del sistema operativo (apartado §6.4).
4. **`/opt/soc-copilot`** clonado, `.env` rellenado a partir de
   `.env.example` con secretos rotados.
5. **`docker compose -f infra/docker-compose.prod.yml up -d --build`**.
6. **Caddy** autoemite certificado Let's Encrypt en el primer
   arranque.
7. **Ingesta KB** en el contenedor `api` (707 docs en Chroma).
8. **Backup diario cifrado** (age) vía systemd timer
   (`scripts/install_backup_timer.sh`).
9. **SMTP** (Gmail App Password) configurado para verificación de
   email.

Deploy de cambios: `bash /opt/soc-copilot/scripts/deploy.sh` sobre
SSH (git pull + validación de secretos + `up --build` + tail logs).
La automatización vía GitHub Actions queda como mejora opcional.

### 7.3. Rollback

Procedimiento documentado en [operations.md](operations.md):
`git revert` + redeploy + restore de Postgres desde el último dump
si la regresión tocó esquema.

---

## 8. Manual de uso

Manual completo con screenshots en [10-manual-usuario.md](10-manual-usuario.md).
Resumen de flujos:

### 8.1. Primer acceso

1. Entrar en <https://soc-copilot.duckdns.org>.
2. **Registrarse** con email + contraseña + nivel deseado (L1/L2/
   Instructor). El registro puede estar abierto o cerrado según el
   toggle del admin.
3. Verificar el email si está habilitado.
4. *Login automático* tras verificación.

### 8.2. Analizar una alerta

1. Ir a **Alertas** desde el menú.
2. Pegar el log o seleccionar uno de los tres ejemplos predefinidos.
3. Pulsar **Analizar**.
4. Resultado en <30 s: summary, badge de riesgo, técnicas MITRE
   clicables, reasoning didáctico.

### 8.3. Pedir próximos pasos

1. Desde una alerta ya analizada, pulsar **Recomendar siguientes
   pasos**.
2. Opcional: activar **modo aprendizaje** para que el copilot
   explique el porqué de cada paso (pensado para L1).

### 8.4. Consultar la base de conocimiento

1. Entrar en **Chat IA**.
2. Preguntar libremente (ej. *«¿Qué es T1110 y cómo lo mitigaba
   OWASP?»*).
3. Las respuestas incluyen citas clicables a `attack.mitre.org` y
   `owasp.org`.

### 8.5. Analizar logs en bruto desde fichero

1. Entrar en **Logs**.
2. Subir un fichero `.log/.txt/.csv`.
3. Filtrar por IP/puerto/MAC/protocolo, errores de auth, errores
   HTTP, rango temporal.
4. Seleccionar líneas → enviar a `/alerts` para análisis IA.

### 8.6. Administración (sólo admin)

- **Usuarios**: crear, eliminar, cambiar rol/nivel, resetear
  contraseña, resetear cuota LLM.
- **Roles**: ver descripción y conteo por rol.
- **Permisos**: matriz editable; los cambios quedan en auditoría.
- **Auditoría**: tabla cronológica inversa con filtros por acción y
  actor.

---

## 9. Calidad y pruebas

Snapshot del estado de calidad en la entrega:

| Métrica | Valor |
|---------|-------|
| Tests backend (inventario) | 104 funciones en 10 archivos |
| · Unit (sin DB / sin `RUN_E2E`) | 86 (smoke, auth, byo_llm, logging, migrations, register_security) |
| · E2E con Postgres real (`RUN_E2E=1`) | 18 (e2e, groupchat, stats, e2e_quota) |
| Migraciones Alembic | 5 (0001 initial → 0005 group_messages); `alembic check` guarda contra drift |
| `ruff check apps/api` | clean |
| ESLint flat config (frontend) | 0 errors / 0 warnings |
| `npm audit --audit-level=high` | 0 critical, 0 high (2 moderate aceptados) |
| TypeScript `tsc --noEmit` | clean |
| `next build` | 13 páginas compiladas |
| GitHub Actions | `ci.yml` (push/PR) + `e2e.yml` (main) |

Detalle de estrategia, fixtures y comandos en
[07-testing.md](07-testing.md).

---

## 10. Conclusiones y lecciones aprendidas

### 10.1. Qué ha funcionado

- **Cortar pronto el alcance** — el módulo «detección de anomalías
  con ML propio» se descartó en la primera semana. Habría chupado
  el mes entero sin aportar más nota que un buen RAG.
- **Alembic desde el día 1** — empezamos con `create_all` y
  cambiamos a Alembic en Fase 2. Aplazarlo más nos habría costado
  caro al añadir auth y RBAC.
- **Despliegue temprano** — subir a Hetzner a mitad del proyecto
  (no el último día) descubrió el problema de `NEXT_PUBLIC_API_URL`
  embebido en el bundle de Next, que en local no se ve.
- **Documentación viva en `docs/`** — el repositorio se ha podido
  retomar fríamente entre miembros gracias a los `docs/HANDOFF-IA.md`
  y `RUNBOOK.md`.

### 10.2. Qué nos costó

- **Cuota gratuita de Gemini** — la ingestión inicial del RAG se
  comió varios días de cuota; tuvimos que añadir backoff y BYO key
  por usuario.
- **Cookies cross-origin en dev** — el setup `localhost:13500 →
  localhost:8080` requirió ajustes finos de `SameSite` y CORS hasta
  encajar.
- **RBAC sin lockout** — un cambio de permisos pudo dejar al admin
  fuera de su panel. La permission `permissions.manage` con flag
  `locked` resolvió el problema, pero hubo susto.
- **Ownership y datos legacy** — al introducir `user_id` en `Alert`
  hubo que decidir qué hacer con las alertas previas. Optamos por
  `nullable` + visibilidad sólo a admin.

### 10.3. Lecciones aprendidas

- La IA en seguridad **no debe sustituir, debe ayudar**. Todo el
  diseño de UX refuerza que la decisión final es del analista.
- **Cada nuevo endpoint con LLM es un nuevo vector**: prompt
  injection, RAG poisoning, abuso de cuota. El hardening tiene que
  ir al mismo ritmo que la funcionalidad.
- **Trabajar en grupo en este tipo de proyecto exige reglas
  estrictas de PR y CI**. Sin ellas, el repo se rompe en una semana.
- **El despliegue es parte del producto**. Un proyecto que sólo
  corre en `localhost` no es comparable a uno que aguanta tráfico
  real con TLS, backups y un runbook.

---

## 11. Roadmap Práctica 2

Esta Práctica 1 deja una base sólida, pero hay 5+ líneas claras de
mejora para la Práctica 2. El plan detallado vive en
[practica-2-plan.md](practica-2-plan.md). Resumen:

### 11.1. Funcionalidades comprometidas (4 ejes, uno por persona)

1. **Integración con SIEM real (CrowdSec)** — agente local en el VPS
   parseando logs de Caddy, sshd y journald. Las alertas se envían
   automáticamente a `/api/explain` vía un *forwarder* propio. Se
   elige CrowdSec sobre Wazuh porque cabe en los 4 GB del CPX22
   (Wazuh completo necesitaría 4-6 GB él solo).
2. **Feedback loop del analista + dashboard de calidad** — botón
   👍/👎 en cada recomendación, widget de tasa de acierto por modelo
   y por técnica MITRE.
3. **A/B multi-LLM con leaderboard** — ejecución paralela de dos
   modelos en un % configurable de alertas, comparativa de
   winrate, latencia y coste por tokens.
4. **Observabilidad (Prometheus + Grafana + alertas)** — `/metrics`
   en FastAPI, tres dashboards Grafana (ops, calidad IA,
   CrowdSec) y alertas a Discord. En *profile* Compose aparte para
   poder pararlo si hace falta RAM.

### 11.2. Funcionalidades adicionales planificadas (post-Práctica 2)

5. **Threat intel** (AbuseIPDB o OpenCTI) para enriquecer IPs/hashes
   detectados antes de mandarlos al LLM.
6. **2FA + auditoría admin ampliada + secrets manager** (Vault o
   sops).
7. **Export de informe de incidente en PDF firmado** (timeline,
   IOCs, acciones tomadas).
8. **Multi-tenant + RBAC ampliado** con espacios de trabajo
   independientes.
9. **Escalabilidad**: rate limiter en Redis, job queue (Celery)
   para análisis batch.
10. **Fine-tuning de un clasificador ligero** en Hugging Face que
    pre-filtre antes de Gemini.

Total: **10 funcionalidades** (4 comprometidas para Práctica 2 + 6
en backlog post-Práctica 2), cumpliendo holgadamente el mínimo de 5
de la rúbrica.

---

## 12. Anexos

- **Anexo A — Diagramas**: [09-diagramas.md](09-diagramas.md)
- **Anexo B — Arquitectura detallada**: [03-arquitectura.md](03-arquitectura.md)
- **Anexo C — Referencia de la API**: [06-api-reference.md](06-api-reference.md)
- **Anexo D — Manual de operaciones**: [operations.md](operations.md)
- **Anexo E — Auditoría de seguridad**: [security.md](security.md) y [vulnerability_report.md](vulnerability_report.md)
- **Anexo F — Estrategia de testing**: [07-testing.md](07-testing.md)
- **Anexo G — Módulo de auditoría inmutable**: [11-modulo-auditoria.md](11-modulo-auditoria.md)
- **Anexo H — Ingestión RAG (MITRE + OWASP)**: [08-rag-ingestion.md](08-rag-ingestion.md)
- **Anexo I — Plan completo de Práctica 2**: [practica-2-plan.md](practica-2-plan.md)
- **Anexo J — Changelog completo**: [12-changelog.md](12-changelog.md)

### Capturas para incluir en el PDF final

Pendiente de adjuntar (`docs/assets/`):

- [ ] Pantalla de login.
- [ ] Análisis de una alerta de ejemplo (con técnica MITRE clicada).
- [ ] Recomendación con modo aprendizaje activado.
- [ ] Chat con cita a MITRE y OWASP.
- [ ] Dashboard con KPIs y gráficas.
- [ ] Panel admin (las cuatro pestañas).
- [ ] Auditoría con filtros aplicados.
- [ ] Chat grupal con varios usuarios.
- [ ] Certificado HTTPS de Let's Encrypt en navegador.
- [ ] Salida del backup cifrado en producción (`systemctl list-timers soc-copilot-backup.timer` + `ls daily/`).

---

> **Nota para el grupo:** este documento está pensado como **fuente
> Markdown** para generar el PDF final (por ejemplo con
> `pandoc memoria.md -o memoria.pdf --pdf-engine=xelatex` o con la
> función *Export to PDF* de cualquier editor Markdown). Antes de la
> entrega:
>
> 1. Rellenar nombres reales en portada y §5.3.
> 2. Adjuntar capturas en `docs/assets/` y referenciarlas desde las
>    secciones correspondientes.
> 3. Revisar la sección 10 (lecciones aprendidas) y añadir las
>    vuestras propias — las listadas son las observadas desde el
>    código y los docs, no las que cada persona vivió.
> 4. Generar el PDF y verificar la portada, índice navegable y los
>    saltos de página.
