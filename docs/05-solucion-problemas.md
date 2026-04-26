# Solucion de problemas

## Docker no arranca

Comprobar que Docker Desktop esta abierto y que el motor esta iniciado.

En Windows, comprobar tambien:

- WSL2 instalado.
- Virtualizacion habilitada.
- Docker Desktop configurado para usar WSL2.

## Puerto ocupado

Puertos usados:

- 13000 para frontend.
- 8080 para API.
- 55432 para PostgreSQL.
- 8001 para ChromaDB.

Si uno esta ocupado, Docker Compose mostrara un error de bind. Hay que cerrar el proceso que lo usa o cambiar el puerto en `infra/docker-compose.yml`.

## La API responde 502 al analizar

Causa probable: `GEMINI_API_KEY` no esta configurada o no es valida.

Comprobar `.env`:

```env
GEMINI_API_KEY=tu_clave_real
```

Despues reiniciar:

```bash
cd infra
docker compose restart api
```

## El frontend no conecta con la API

Comprobar que la API esta viva:

```bash
curl http://localhost:8080/api/health
```

Respuesta esperada:

```json
{"status":"ok"}
```

Comprobar `.env`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
API_CORS_ORIGINS=http://localhost:13000
```

## Cambios en frontend no aparecen

Reiniciar el contenedor web:

```bash
cd infra
docker compose restart web
```

Si persiste:

```bash
cd infra
docker compose up --build -d web
```

## Problemas con base de datos

Para borrar datos locales y recrear desde cero:

```bash
cd infra
docker compose down -v
docker compose up --build -d
```

Esto elimina las alertas y recomendaciones guardadas localmente.

## El build tarda mucho la primera vez

Es normal. Docker descarga imagenes base e instala dependencias de Python y Node.js. Las siguientes ejecuciones reutilizan cache.

## Comprobar estado de contenedores

```bash
cd infra
docker compose ps
```

## Ver logs

Todos los servicios:

```bash
cd infra
docker compose logs -f
```

Solo API:

```bash
cd infra
docker compose logs -f api
```

Solo frontend:

```bash
cd infra
docker compose logs -f web
```

