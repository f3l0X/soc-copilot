# Roadmap

## Fases del proyecto (entrega 2026-05-25)

| Fase | Hito | Estado |
|------|------|--------|
| 0 | Setup repo + Docker Compose | ✅ |
| 1 | Alert Explainer (Gemini + MITRE) | ✅ |
| 2 | Next Step Recommender + persistencia Postgres | ✅ |
| 3 | RAG + Chat IA (MITRE + OWASP en Chroma) | ✅ |
| 4 | Auth (JWT cookie + bcrypt) + RBAC + tests E2E | ✅ |
| 5 | Despliegue Hetzner + dominio + HTTPS + CI/CD | ⏳ pendiente |
| 6 | Informe PDF + presentación 10 min | ⏳ pendiente |

Detalle de cada fase en [02-estado-fases.md](02-estado-fases.md).

## Fase 5 — checklist operativa

### Infra

- [ ] VPS Hetzner CX22 (2 vCPU / 4 GB RAM / ~5 €/mes) provisionado.
- [ ] Dominio comprado y DNS A → IP del VPS.
- [ ] SSH key-only (deshabilitar password auth).
- [ ] `ufw` allow 22, 80, 443. Resto deny.
- [ ] `fail2ban` con jails para sshd y `auth.log`.
- [ ] `unattended-upgrades` activo para kernel + paquetes seguridad.
- [ ] Swap 2 GB.
- [ ] Backups Postgres: `pg_dump | gzip | scp` cron diario + retención 7 días.

### Configuración

- [ ] `JWT_SECRET` rotado a `openssl rand -base64 48`.
- [ ] `COOKIE_SECURE=true`.
- [ ] `RATE_LIMIT_*` revisado para tráfico real.
- [ ] `API_CORS_ORIGINS` con el dominio real.
- [ ] `NEXT_PUBLIC_API_URL` con dominio real.
- [ ] Copiar `infra/docker-compose.prod.example.yml` → `docker-compose.prod.yml`.
- [ ] Caddyfile con `PUBLIC_DOMAIN` real + `ACME_EMAIL`.
- [ ] `.env` de producción fuera del repo (ej. `/etc/soc-copilot/.env`
      con permisos 600 root).

### Auth / acceso

- [ ] `AUTH_REGISTRATION_ENABLED=false` (o seed CLI de admin).
- [ ] Crear admin via script o `psql` antes de exponer.
- [ ] `ProxyHeadersMiddleware` en uvicorn + `forwarded_allow_ips`
      apuntando a la red del compose (Caddy).

### CD

- [ ] Workflow GitHub Actions `deploy.yml` triggered on tag.
- [ ] Secret `DEPLOY_SSH_KEY` configurado en repo.
- [ ] Job hace `ssh user@host 'cd /opt/soc-copilot && git pull && docker compose -f docker-compose.prod.yml up --build -d'`.
- [ ] Health check post-deploy.

### Datos iniciales

- [ ] `docker compose exec api python -m scripts.ingest_kb` en VPS.
- [ ] Verificar `/api/kb/status` devuelve ~700 docs.

### Verificación

- [ ] HTTPS válido (test SSL Labs grado A).
- [ ] CSP / HSTS / X-Content-Type-Options en Caddy.
- [ ] Endpoints LLM siguen respondiendo tras Caddy proxy.
- [ ] Rate limit lee la IP correcta (no la de Caddy).
- [ ] Cookie `Secure` flag presente en respuestas.
- [ ] Smoke completo (login → explain → recommend → chat → history).

## Fase 6 — checklist informe + demo

### Informe PDF (mín. exigido por la rúbrica)

- [ ] Portada con nombre proyecto + integrantes + fecha.
- [ ] Índice.
- [ ] Resumen ejecutivo (≤1 página).
- [ ] Descripción del problema y justificación.
- [ ] Arquitectura técnica con diagrama (reusar Mermaid de
      [03-arquitectura.md](03-arquitectura.md)).
- [ ] Proceso de desarrollo con evidencias (capturas, commits,
      diagramas) fase a fase.
- [ ] Guía de despliegue paso a paso (basada en [01-instalacion-local.md](01-instalacion-local.md)
      + Fase 5).
- [ ] Manual de uso con screenshots reales.
- [ ] Conclusiones y lecciones aprendidas.
- [ ] **Roadmap Práctica 2** (≥5 funcionalidades) — abajo.

### Demo (10 min)

- [ ] Ensayo cronometrado.
- [ ] Stack arrancado en Hetzner antes de la presentación.
- [ ] Plan B con captura de pantalla por si falla la red.
- [ ] Cuenta admin + analyst preparadas.
- [ ] 3 logs de ejemplo listos para pegar (uno por nivel de riesgo).
- [ ] Pregunta de chat preparada para forzar cita MITRE + OWASP.

### Entrega

- [ ] URL pública del producto.
- [ ] URL del repo (con profe invitado o repo público).
- [ ] PDF subido al campus virtual.

## Roadmap para Práctica 2 (mejoras planificadas)

Estas son las extensiones que dejamos documentadas como continuación
natural en la Práctica 2 (rúbrica exige ≥5):

1. **Integración con SIEM real** (Wazuh / Elastic / Splunk) — feed de
   alertas que entran a `/api/explain` automáticamente.
2. **Multi-tenant + RBAC ampliado** — espacios de trabajo independientes,
   roles personalizados, scoping por organización.
3. **Modelo fine-tuneado para clasificación de logs** — pipeline
   pequeño en Hugging Face Spaces que pre-clasifique antes de Gemini.
4. **Feedback loop del analista** — botón «útil / no útil» en cada
   recomendación, agregación en dashboard, fine-tune incremental.
5. **Soporte multi-LLM con A/B** — Claude, OpenAI, Ollama local
   sirviendo en paralelo; medición automatizada de calidad.
6. **Export de informes de incidente** en PDF firmado (cierre de ticket
   completo con timeline, IOCs, acciones tomadas).
7. **Integración con threat intel** (MISP, OpenCTI) para enriquecer
   IPs / hashes / dominios encontrados en logs.
8. **Mejoras de escalabilidad**: rate limiter en Redis, job queue
   (Celery) para análisis batch, replicación de Postgres.
9. **Hardening** del producto: 2FA, password reset, auditoría de
   acciones admin, secrets manager (Vault / sops).
10. **Observabilidad**: OpenTelemetry traces + Prometheus + Grafana
    dashboards, alerting en Discord/Slack.

## Riesgos y mitigaciones para entrega

| Riesgo | Mitigación |
|--------|-----------|
| Cuota Gemini agotada en demo | Selector de modelo en UI permite cambiar al vuelo; allowlist con 3 modelos |
| VPS caído el día de la entrega | Plan B: demo desde local con grabación de video en backup |
| Demos rotas por dependencias externas (red MITRE) | KB persistida en volumen, no se re-descarga en runtime |
| Pérdida de datos en deploy | `pg_dump` antes de cada `up --build`; restore documentado |
| Bug introducido en último commit | CI obligatoria + rollback con `git revert` y redeploy |
