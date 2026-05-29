# Plan Práctica 2 — Evolución de SOC Copilot

> Documento de planificación para la **Práctica 2** del Máster de
> Ciberseguridad e IA. Continúa el trabajo entregado en la Práctica 1
> (SOC Copilot v1, desplegado en <https://soc-copilot.duckdns.org>).
>
> Este documento sirve también como **anexo "Roadmap Práctica 2"** del
> informe PDF de la Práctica 1 (la rúbrica exige ≥5 funcionalidades de
> continuación).

---

## 1. Objetivo

Pasar SOC Copilot de "asistente de análisis" a **plataforma Blue Team
end-to-end**: ingesta automática de alertas reales, comparación
sistemática entre modelos LLM, ciclo de mejora con feedback del
analista y observabilidad de grado producción — todo manteniéndolo
desplegado en el mismo VPS de Hetzner.

No se reescribe nada. Se construye **sobre** la base de la Práctica 1.

---

## 2. Restricción de partida: infraestructura disponible

Trabajamos con la infra real ya provisionada en la Práctica 1.
Cualquier decisión de diseño tiene que caber aquí:

| Recurso | Capacidad | En uso (Práctica 1) | Libre para Práctica 2 |
|---------|-----------|---------------------|-----------------------|
| VPS | Hetzner CPX22 (Nuremberg) | — | — |
| vCPU | 3 | ~0,3 medio / picos a 2 | ~1 vCPU sostenido |
| RAM | 4 GB | ~1,5 GB (pg + chroma + api + web + caddy) | ~2 GB + 2 GB swap |
| Disco | 80 GB NVMe | ~8 GB | ~70 GB |
| Red | 20 TB/mes | despreciable | sobra |
| Backups | Hetzner snapshot diario + `pg_dump` cifrado (age, systemd timer) | — | — |

Esto descarta de entrada la opción "Wazuh completo" (manager +
OpenSearch + dashboard ≈ 4-6 GB RAM él solo). Ver §4.1.

---

## 3. Ejes de mejora seleccionados (4)

Cuatro ejes, uno por persona del grupo. Elegidos para que:

- cada eje sea **identificable como contribución individual** (la
  rúbrica lo exige),
- las dependencias entre ejes generen una **narrativa coherente** en el
  informe ("ingesta → análisis multi-modelo → feedback → observado"),
- ninguno requiera ampliar el plan Hetzner.

| # | Eje | Persona | Esfuerzo |
|---|-----|---------|----------|
| 1 | SIEM real (CrowdSec) + forwarder a `/api/explain` | P1 | Alto |
| 2 | Feedback loop del analista + dashboard de calidad | P2 | Medio |
| 3 | A/B multi-LLM + comparador de calidad | P3 | Medio |
| 4 | Observabilidad: Prometheus + Grafana + alertas | P4 | Medio |

Funcionalidades descartadas para no diluir esfuerzo (van al
"roadmap post-Práctica 2" en el informe): threat intel
(AbuseIPDB/OpenCTI), fine-tuning HuggingFace, multi-tenant ampliado,
PDF firmado de incidente, 2FA, escalabilidad con Redis/Celery.

---

## 4. Detalle por eje

### 4.1. Eje 1 — Integración SIEM (CrowdSec)

**Por qué CrowdSec y no Wazuh**

| Criterio | Wazuh completo | CrowdSec |
|----------|----------------|----------|
| RAM | 4-6 GB | 150-250 MB |
| Disco | 5-10 GB | <1 GB |
| Encaja en CPX22 | ❌ | ✅ |
| Es SIEM/IPS real | ✅ | ✅ (SIEM ligero + IPS) |
| OSS y moderno | ✅ | ✅ |
| Curva de aprendizaje | Alta | Media |

CrowdSec corre como **agente en el mismo host**, parsea logs
(Caddy, sshd, syslog, journald) y genera "decisions" sobre IPs
sospechosas. No necesita stack OpenSearch.

**Arquitectura**

```text
┌──────────────┐   parsers     ┌────────────┐  HTTP POST   ┌──────────┐
│ logs locales │──────────────▶│ CrowdSec   │─────────────▶│ forwarder│
│ (caddy, ssh, │   acquisitions│  agent     │  alerts/v1   │ (Python) │
│  journald)   │               └────────────┘              └────┬─────┘
└──────────────┘                                                │
                                                                ▼
                                                       ┌────────────────┐
                                                       │  /api/explain  │
                                                       │  (FastAPI)     │
                                                       └────────────────┘
```

El **forwarder** es un servicio pequeño nuevo (`apps/forwarder/`,
~150 LOC Python) que consulta la Local API de CrowdSec, formatea cada
alerta como log enriquecido, y la envía al endpoint existente con
una `service_account` (nuevo rol `system`).

**Entregables**

- Servicio `crowdsec` en `docker-compose.prod.yml` con volumen
  persistente y acquisitions.yaml montado.
- Servicio `forwarder` en mismo Compose (imagen propia,
  `apps/forwarder/Dockerfile`).
- Migración Alembic 0006: rol `system`, tabla `alert_source` con
  campos `source_type` (manual/crowdsec/api) y `external_id`.
  (La `0005` ya existe en Práctica 1 = `group_messages`; la numeración
  de Práctica 2 arranca en `0006`.)
- Endpoint `/api/explain` acepta header `X-Source: crowdsec` con
  service-account token y persiste el origen.
- Página `/alerts` filtrable por origen (manual vs CrowdSec).
- 3 escenarios CrowdSec activados como mínimo:
  `crowdsecurity/http-probing`, `crowdsecurity/ssh-bf`,
  `crowdsecurity/http-bad-user-agent`.

**Criterios de aceptación**

- [ ] Ataque simulado (`hydra` sobre SSH desde otra máquina) genera
      alerta en CrowdSec **y** aparece en `/alerts` analizada en <30 s.
- [ ] Forwarder reintenta con backoff exponencial si la API está
      caída; sin pérdida de alertas tras 5 min de outage simulado.
- [ ] El consumo conjunto (`crowdsec` + `forwarder`) no supera
      **350 MB RAM** medidos con `docker stats` durante 1h de carga.
- [ ] Documentado en `docs/13-siem-crowdsec.md`.

**Riesgos**

| Riesgo | Mitigación |
|--------|-----------|
| CrowdSec spamea Gemini en un ataque masivo | Rate limit en forwarder (máx 10 alertas/min, deduplicación por IP+escenario en ventana de 5 min) |
| Falsos positivos llenan la base | TTL de 30 días en alertas con `source=crowdsec` no revisadas |
| CAPI key fugada | Token de service-account en `.env` con permisos sólo a `/api/explain` |

---

### 4.2. Eje 2 — Feedback loop + dashboard de calidad

**Idea**

Cada recomendación de Gemini lleva 👍 / 👎 (+ comentario opcional). La
señal se persiste y alimenta un widget de "calidad percibida" en
`/dashboard`, segmentable por modelo y por técnica MITRE. Es la base
de la métrica que necesita el Eje 3 para comparar modelos.

**Entregables**

- Migración Alembic 0007: tabla `ai_feedback` con `alert_id`,
  `user_id`, `model`, `vote` (+1/-1), `comment`, `created_at`,
  índice por `(model, created_at)`.
- `POST /api/feedback` y `GET /api/feedback/summary?group_by=model|mitre`.
- Componente `<FeedbackButtons />` en la vista de alerta.
- Nuevos widgets en `/dashboard`:
  - "Calidad por modelo" (barras horizontales con tasa de 👍).
  - "Técnicas MITRE con peor feedback" (top 5).
- Export CSV de `ai_feedback` para análisis offline en el informe.

**Criterios de aceptación**

- [ ] Votar no recarga la página (mutación optimista).
- [ ] Un analista sólo ve feedback de sus alertas; admin ve global.
- [ ] El widget de calidad se calcula con ≥10 votos por modelo;
      muestra "datos insuficientes" en caso contrario.
- [ ] Tests unit del endpoint `summary` con fixtures de votos
      mezclados.
- [ ] Documentado en `docs/14-feedback-loop.md`.

**Riesgos**

| Riesgo | Mitigación |
|--------|-----------|
| Sesgo por pocos votos | Umbral mínimo (10) antes de mostrar tasa pública |
| Spam de votos del mismo usuario | Restricción UNIQUE `(alert_id, user_id)` — un voto por alerta y persona |

---

### 4.3. Eje 3 — A/B multi-LLM + comparador

**Idea**

Ya tenemos selector de modelo en la UI. Lo subimos a **ejecución
paralela**: cuando una alerta entra (manual o vía CrowdSec), un X%
configurable se analiza con **dos** modelos en paralelo. Se persisten
ambas respuestas con latencia y tokens. El analista vota una de las
dos (alimenta el Eje 2). El comparador genera leaderboard.

**Entregables**

- Migración 0008: tabla `ab_run` con `alert_id`, `model_a`, `model_b`,
  `response_a`, `response_b`, `latency_ms_a/b`, `tokens_a/b`,
  `winner` (null hasta voto).
- Setting `AB_SAMPLE_RATE` (default 0.2) en `app_settings` editable
  por admin.
- Vista `/admin/ab-tests` con leaderboard: por modelo (winrate,
  latencia p50/p95, coste estimado en tokens).
- Endpoint `GET /api/ab/leaderboard`.
- Test E2E: forzar `AB_SAMPLE_RATE=1.0`, crear 5 alertas, votar,
  verificar leaderboard.

**Criterios de aceptación**

- [ ] La ejecución paralela usa `asyncio.gather` — la latencia
      percibida ≈ max(modelo_a, modelo_b), no la suma.
- [ ] Si un modelo falla, la alerta no falla (degradación a single).
- [ ] Coste extra controlado: con `AB_SAMPLE_RATE=0.2` el consumo
      Gemini sube ≤20% (medido durante 1 día).
- [ ] Leaderboard sólo visible para `admin`.
- [ ] Documentado en `docs/15-ab-multi-llm.md`.

**Riesgos**

| Riesgo | Mitigación |
|--------|-----------|
| Cuota Gemini se agota antes de la demo | `AB_SAMPLE_RATE` reducible al vuelo desde admin UI |
| Análisis A/B no concluyente con muestra pequeña | Mostrar intervalo de confianza en leaderboard, no sólo media |

---

### 4.4. Eje 4 — Observabilidad (Prometheus + Grafana)

**Idea**

Pasar de "logs en stdout" a métricas + dashboards + alertas reales.
Mide los otros tres ejes y da material visual fortísimo para la demo.

**Entregables**

- Endpoint `/metrics` en FastAPI (`prometheus-fastapi-instrumentator`,
  ~30 LOC).
- Métricas custom: `llm_request_duration_seconds{model}`,
  `llm_tokens_total{model,kind}`, `crowdsec_alerts_total{scenario}`,
  `ab_runs_total`, `feedback_votes_total{vote}`.
- Servicios `prometheus` y `grafana` en `docker-compose.prod.yml`
  (perfil `observability` para poder pararlos si hace falta RAM).
- Caddy enruta `grafana.soc-copilot.duckdns.org` con TLS automático
  (DuckDNS ya soporta el subdominio).
- 3 dashboards Grafana versionados como JSON en
  `infra/grafana/dashboards/`:
  - **SOC ops** (latencia LLM, errores, throughput de alertas).
  - **Calidad IA** (tasa de 👍 por modelo, técnicas MITRE peor
    valoradas).
  - **CrowdSec** (alertas por escenario, top IPs bloqueadas).
- Alertmanager → webhook Discord. 4 reglas iniciales:
  `LLMLatencyHigh` (p95 > 8 s, 5 min), `LLMErrorRateHigh` (>5% en
  5 min), `CrowdSecBurst` (>20 alertas/min), `DiskAlmostFull` (>80%).

**Criterios de aceptación**

- [ ] Prometheus persiste 7 días (`--storage.tsdb.retention.time=7d`).
- [ ] Grafana protegido con login propio + auth básica de Caddy
      como segunda capa.
- [ ] Disparar `LLMLatencyHigh` manualmente (sleep en mock) genera
      mensaje en Discord en <60 s.
- [ ] Footprint: prometheus + grafana + alertmanager juntos
      ≤500 MB RAM medidos.
- [ ] Documentado en `docs/16-observabilidad.md` + capturas de los
      3 dashboards en el informe.

**Riesgos**

| Riesgo | Mitigación |
|--------|-----------|
| Prometheus se come el disco | Retención 7 días + alert `DiskAlmostFull` autoreferencial |
| Grafana expuesto sin protección | Doble capa: login Grafana + basic-auth Caddy; admin token rotado en `.env` |

---

## 5. Presupuesto de recursos tras Práctica 2

Estimación a sumar sobre el baseline actual (~1,5 GB RAM):

| Servicio nuevo | RAM | Disco |
|----------------|-----|-------|
| crowdsec | ~200 MB | ~500 MB |
| forwarder | ~50 MB | ~50 MB |
| prometheus | ~250 MB | ~2 GB (retención 7d) |
| grafana | ~150 MB | ~200 MB |
| alertmanager | ~30 MB | <50 MB |
| **Total nuevo** | **~680 MB** | **~3 GB** |

**Proyección final**: ~2,2 GB RAM en uso, ~1,8 GB libres + 2 GB swap.
~11 GB de disco usados de 80 GB. **Cabe holgado.**

Si en algún momento se va de madre, los servicios de observabilidad
están en un **profile Compose** (`--profile observability`) que se
puede parar sin tocar el resto del stack.

---

## 6. Calendario propuesto

Asumiendo entrega de Práctica 2 ~4 semanas después de Práctica 1.

| Semana | Hito |
|--------|------|
| 1 | Kickoff, ramas por eje, esqueleto de migraciones 0006-0008, mocks de servicios nuevos en Compose |
| 2 | Ejes 1 y 4 funcionales en dev local (CrowdSec ingesta + Prometheus emitiendo métricas básicas) |
| 3 | Ejes 2 y 3 funcionales; integración cruzada (feedback alimenta leaderboard A/B) |
| 4 | Despliegue Hetzner del stack completo, smoke E2E con los 4 ejes encadenados, redacción del informe |

Reuniones cortas (15 min) lunes y jueves para desbloquear; merge a
`main` sólo con PR aprobada por otro miembro del grupo.

---

## 7. Reparto y rendición de cuentas

| Persona | Eje | Sección que firma en el informe |
|---------|-----|----------------------------------|
| P1 | SIEM (CrowdSec) | Cap. "Ingesta automática de alertas" |
| P2 | Feedback loop | Cap. "Ciclo de mejora con feedback del analista" |
| P3 | A/B multi-LLM | Cap. "Comparativa de modelos LLM" |
| P4 | Observabilidad | Cap. "Monitorización y alerting" |

Cada persona mantiene su propio `docs/1X-*.md` y el changelog
correspondiente en `docs/12-changelog.md`.

---

## 8. Cómo usar este documento en la Práctica 1

La rúbrica de la Práctica 1 pide un apartado "Roadmap Práctica 2"
con ≥5 funcionalidades. Para el informe PDF de la Práctica 1 se
puede:

1. Resumir §3 (los 4 ejes seleccionados).
2. Añadir como **funcionalidades adicionales planificadas**
   (≥1 extra para llegar a 5+): threat intel con AbuseIPDB, 2FA
   + auditoría admin ampliada, export de informe de incidente
   en PDF firmado. Marcar explícitamente como "post-Práctica 2".
3. Referenciar este documento (`docs/practica-2-plan.md`) como
   anexo técnico para no inflar el cuerpo del PDF.

---

## 9. Cambios respecto al roadmap original

El `docs/roadmap.md` listaba 10 candidatas. Este plan formaliza el
recorte tras analizar (a) presupuesto de recursos en CPX22 y (b)
tamaño del grupo (4 personas).

| Roadmap original | Decisión Práctica 2 |
|------------------|----------------------|
| #1 SIEM Wazuh | ✅ Reemplazado por **CrowdSec** (cabe en CPX22) |
| #4 Feedback loop | ✅ Incluido (Eje 2) |
| #5 Multi-LLM A/B | ✅ Incluido (Eje 3) |
| #10 Observabilidad | ✅ Incluido (Eje 4) |
| #2 Multi-tenant | ❌ Aplazado |
| #3 Fine-tuning HF | ❌ Aplazado |
| #6 PDF de incidente | ❌ Aplazado |
| #7 Threat intel | ❌ Aplazado (posible bonus si P1 termina antes) |
| #8 Redis/Celery | ❌ Aplazado |
| #9 2FA + Vault | ❌ Aplazado |
