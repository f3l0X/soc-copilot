# Guia de trabajo para el equipo

## Que contiene el comprimido

El comprimido de entrega incluye:

- Codigo fuente de backend y frontend.
- Infraestructura Docker local.
- Documentacion del proyecto.
- Workflows de CI.
- `.env.example`.

No incluye:

- `.env` real.
- `.git`.
- `node_modules`.
- `.next`.
- Caches locales.
- Volumenes o bases de datos locales.

Cada persona debe crear su propio `.env` a partir de `.env.example`.

## Flujo recomendado para empezar

1. Leer [Instalacion local](01-instalacion-local.md).
2. Levantar el stack con Docker Compose.
3. Probar `/alerts`, `/respond` y `/history`.
4. Leer [Estado del proyecto y fases completadas](02-estado-fases.md).
5. Coordinar tareas de fase 3 antes de modificar codigo.

## Reparto funcional sugerido para fase 3

Backend RAG:

- Definir formato de documentos de conocimiento.
- Crear ingesta hacia ChromaDB.
- Generar embeddings.
- Implementar retrieval.

Backend Chat:

- Sustituir el stub de `/api/chat`.
- Construir prompt con historial, contexto recuperado y log opcional.
- Manejar errores del LLM y respuestas vacias.

Frontend Chat:

- Crear pantalla `/chat`.
- Mostrar mensajes del usuario y del asistente.
- Mostrar fuentes usadas por RAG.
- Permitir pasar contexto desde una alerta.

DevOps:

- Revisar puertos y variables de entorno.
- Preparar configuracion para VPS.
- Integrar Caddy en fase 5.

QA/Documentacion:

- Ampliar tests.
- Probar instalacion limpia desde el comprimido.
- Mantener esta documentacion actualizada.

## Convenciones actuales

- Backend bajo `apps/api/app`.
- Frontend bajo `apps/web/src`.
- Endpoints de API bajo prefijo `/api`.
- Variables compartidas en `.env`.
- Desarrollo local preferentemente con Docker Compose.

## Puntos importantes antes de desarrollar

- No subir claves reales de Gemini.
- No compartir `.env` personal.
- Si se cambia el esquema de base de datos durante estas fases tempranas, puede ser necesario ejecutar `docker compose down -v`.
- ChromaDB ya esta en el stack, pero la logica RAG aun no esta implementada.
- El endpoint `/api/chat` existe solo como punto de entrada provisional.

## Validacion antes de entregar cambios

Backend:

```bash
cd infra
docker compose exec api ruff check app
docker compose exec api pytest -q
```

Frontend:

```bash
cd infra
docker compose exec web npx tsc --noEmit
docker compose exec web npm run build
```

Prueba manual:

- Crear una alerta desde `/alerts`.
- Generar recomendaciones desde `/respond`.
- Verificar que aparece en `/history`.

