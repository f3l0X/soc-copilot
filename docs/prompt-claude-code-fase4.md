# Prompt para Claude Code - Preparacion Fase 4

Actua como senior full-stack/security engineer en SOC Copilot.

## Contexto actual

- Proyecto SOC Copilot.
- Fase 2 terminada.
- Fase 3 ya empezo parcialmente: existe `/api/chat`, RAG, ChromaDB, `/api/kb/status`, `/api/llm/models`, scripts de ingesta y UI `/chat`.
- Queremos cerrar problemas pendientes antes de iniciar fase 4.
- Fase 4 debe centrarse en: pulido UI, auth basica/RBAC si aplica, tests ampliados y estabilizacion.
- No hagas despliegue real a Hetzner todavia. Eso pertenece a fase 5.

## Problemas detectados

### 1. Next/React vulnerables originalmente

- Antes: Next 15.1.3 + React 19.0.0.
- Ya se actualizo a Next 15.5.15 y React 19.2.5.
- Verificar que `package.json` y `package-lock.json` estan consistentes.
- Ejecutar `npm audit`.
- Estado esperado:
  - 0 critical.
  - 0 high.
  - Si quedan moderate por PostCSS embebido dentro de Next, documentar explicitamente el advisory, por que no hay fix limpio dentro de Next 15.x y que alternativa existe.
  - No hacer downgrade raro sugerido por `npm audit`.

### 2. `/api/chat` antes era stub

- Ya no debe tratarse como bug si ahora esta implementado con RAG.
- Verificar que:
  - `/api/chat` valida payloads.
  - usa prompt injection hardening.
  - no filtra errores internos.
  - funciona con KB vacia.
  - funciona con KB poblada.
  - devuelve `sources` cuando hay documentos recuperados.
- Si algo falla, corregirlo sin reescribir toda la arquitectura.

### 3. Caddy no estaba orquestado

- Para local/dev no hace falta Caddy.
- Para produccion debe existir una plantilla clara.
- Verificar que:
  - `infra/docker-compose.yml` queda marcado como local/dev.
  - `infra/docker-compose.prod.example.yml` existe y define Caddy.
  - Postgres y Chroma no exponen puertos publicos en prod.
  - API no usa `--reload` en prod.
  - Web usa target `runner` en prod.
- No desplegar ni tocar dominio real todavia.

### 4. Ingesta RAG depende de red y cuota Gemini

Problema:

- `scripts/ingest_kb.py` descarga MITRE desde GitHub y embebe con Gemini.
- Esto puede fallar por red, Chroma apagado o cuota agotada.
- Para companeros y fase 4 necesitamos una ingesta repetible.

Solucion requerida:

- Anadir modo `--dry-run`:
  - valida acceso a Chroma.
  - prepara documentos.
  - cuenta documentos a insertar.
  - NO llama a Gemini.
  - NO escribe en Chroma.
- Anadir modo `--sample`:
  - ingesta un set pequeno de documentos locales, suficiente para probar `/chat`.
  - maximo 10-20 docs.
  - debe gastar poca cuota.
- Mantener `--owasp-only` y `--mitre-only`.
- Mejorar errores:
  - si Chroma no responde, mensaje claro: `Chroma unavailable. Start docker compose service chroma.`
  - si Gemini devuelve 429/cuota, mensaje claro: `Gemini quota exhausted. Try --sample, --owasp-only or wait for quota reset.`
- Documentar comandos:
  - `docker compose up -d chroma api`
  - `docker compose exec api python -m scripts.ingest_kb --dry-run`
  - `docker compose exec api python -m scripts.ingest_kb --sample`
  - `docker compose exec api python -m scripts.ingest_kb --owasp-only`
  - `curl http://localhost:8080/api/kb/status`
- No meter Redis ni servicios nuevos.
- No depender de internet para `--sample`.

### 5. Mojibake/codificacion

Problema:

- Hay textos rotos como:
  - `quÃ©`
  - `explicaciÃ³n`
  - `â€”`
  - `â†’`
  - `âœ…`
  - `TÃº`
  - `estÃ¡`
- Afecta README, docs, prompts backend, comentarios y UI.

Solucion requerida:

- Corregir todos los textos visibles al usuario.
- Corregir prompts del backend.
- Corregir `README.md`, `docs/roadmap.md` y `docs/security.md` si aplica.
- Corregir comentarios solo si es facil.
- Mantener archivos en UTF-8.
- No cambiar logica por esta tarea.
- Despues buscar patrones:
  - `Ã`
  - `â`
  - `ðŸ`
  - `Â`
- Criterio: no debe quedar mojibake en UI, docs ni prompts.

### 6. `npm run lint` no usable

Problema:

- `package.json` mantiene `"lint": "next lint"`.
- `next lint` abre asistente interactivo y esta deprecado.

Solucion requerida:

- Migrar a ESLint CLI minima y no interactiva.
- Anadir dependencias necesarias:
  - `eslint`
  - `eslint-config-next` compatible con Next 15.x.
- Crear configuracion minima si no existe.
- Cambiar script:
  - `"lint": "eslint ."`
- Debe funcionar sin preguntas interactivas.
- No introducir reglas excesivas que obliguen a refactor grande.

### 7. Tests Docker

Problema:

- El servicio `api` monta `/code/app`, pero no `/code/tests`.
- Para testear en contenedor hubo que montar tests manualmente.

Solucion requerida:

- Ajustar `docker-compose.yml` local para montar:
  - `../apps/api/tests:/code/tests`
- Mantener comportamiento local.
- Verificar:
  - `docker compose exec api pytest -q`
  - `docker compose exec api ruff check app tests`

### 8. Riesgos de fase 4

Antes de iniciar fase 4 dejar claro:

- Auth/RBAC aun no existe.
- `/api/alerts` y `/api/alerts/{id}` exponen datos sin autenticacion.
- En local esta bien; en VPS no.
- Fase 4 debe introducir auth basica o al menos una estrategia documentada.
- No iniciar fase 5 sin:
  - auth.
  - secrets reales fuera de repo.
  - Caddy validado.
  - backups.
  - rate limiting en proxy.
  - politica de logs.

## Reglas de trabajo

- No borrar archivos.
- No tocar `.env` real.
- No introducir secretos.
- No hacer despliegue.
- No convertir `docker-compose.yml` local en produccion.
- No hacer refactors grandes.
- Mantener compatibilidad con Windows + Docker Desktop.
- Si actualizas dependencias, actualizar lockfiles.
- Si anades opciones nuevas, documentarlas.
- Toda verificacion debe quedar ejecutada o explicar por que no se pudo.

## Verificacion obligatoria

Backend:

```bash
cd infra
docker compose config --quiet
docker compose up -d postgres chroma api
docker compose exec api ruff check app tests
docker compose exec api pytest -q
docker compose exec api python -m scripts.ingest_kb --dry-run
docker compose exec api python -m scripts.ingest_kb --sample
curl http://localhost:8080/api/kb/status
```

Frontend:

```bash
cd apps/web
npm install
npm audit
npm run lint
npm run build
```

Busqueda de mojibake:

```powershell
Get-ChildItem -Recurse -File |
  Where-Object { $_.FullName -notmatch 'node_modules|\.next|\.git' } |
  Select-String -Pattern 'Ã|â|ðŸ|Â'
```

## Documentacion

Actualizar docs en Markdown:

- `docs/00-indice.md`
- `docs/security.md`
- `docs/roadmap.md`
- crear `docs/rag-ingestion.md` si no existe.

Documentar:

- como ingestar KB en modo dry-run.
- como ingestar KB sample.
- como verificar `/api/kb/status`.
- que queda pendiente para fase 4.
- que queda pendiente para fase 5.

## Entrega final

- Resumen de cambios.
- Archivos modificados.
- Problemas corregidos.
- Comandos ejecutados y resultados.
- Resultado de `npm audit`.
- Resultado de lint/build/test.
- Estado de `/api/kb/status`.
- Pendientes reales para fase 4.
- Cualquier cosa no verificada y motivo.

