# Instalacion local

## Requisitos

- Windows 11, macOS o Linux.
- Docker Desktop con Docker Compose.
- Git.
- Una clave de Gemini creada en Google AI Studio: <https://aistudio.google.com/apikey>.
- Recomendado en Windows: WSL2 activo y virtualizacion habilitada en BIOS/UEFI.

No es necesario instalar Python, Node.js ni PostgreSQL en local si se usa Docker. El stack levanta todo en contenedores.

## Puertos usados

| Servicio | URL local | Puerto host |
|----------|-----------|-------------|
| Frontend Next.js | <http://localhost:13000> | 13000 |
| API FastAPI | <http://localhost:8080> | 8080 |
| Swagger API | <http://localhost:8080/docs> | 8080 |
| PostgreSQL | localhost:55432 | 55432 |
| ChromaDB | <http://localhost:8001> | 8001 |

## Pasos de instalacion

1. Descomprimir el paquete recibido.

2. Entrar en la carpeta del proyecto:

```bash
cd soc-copilot
```

3. Crear el archivo de entorno a partir del ejemplo:

```bash
cp .env.example .env
```

En Windows PowerShell, si `cp` no esta disponible:

```powershell
Copy-Item .env.example .env
```

4. Editar `.env` y configurar la clave real:

```env
GEMINI_API_KEY=tu_clave_de_gemini
```

Para entorno local se pueden mantener el resto de valores por defecto.

5. Levantar el stack:

```bash
cd infra
docker compose up --build -d
```

6. Ver logs si se quiere comprobar el arranque:

```bash
docker compose logs -f
```

7. Abrir la aplicacion:

- Frontend: <http://localhost:13000>
- API docs: <http://localhost:8080/docs>

## Comandos utiles

Parar contenedores:

```bash
cd infra
docker compose down
```

Parar y borrar datos locales de PostgreSQL y ChromaDB:

```bash
cd infra
docker compose down -v
```

Reconstruir despues de cambios importantes:

```bash
cd infra
docker compose up --build -d
```

Ver logs solo de la API:

```bash
cd infra
docker compose logs -f api
```

Ver logs solo del frontend:

```bash
cd infra
docker compose logs -f web
```

## Pruebas basicas

1. Abrir <http://localhost:13000/alerts>.
2. Usar uno de los ejemplos de alerta.
3. Pulsar `Analizar`.
4. Confirmar que aparece resumen, riesgo, tecnicas MITRE y razonamiento.
5. Pulsar `Siguiente paso` para ir a recomendaciones.
6. Generar recomendaciones.
7. Abrir <http://localhost:13000/history> y confirmar que la alerta quedo persistida.

