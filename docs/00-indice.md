# Documentacion del proyecto SOC Copilot

Este paquete contiene el estado actual del proyecto al cierre de la fase 2 y la informacion necesaria para que cualquier miembro del equipo pueda ejecutarlo localmente.

## Orden recomendado de lectura

1. [Instalacion local](01-instalacion-local.md)
2. [Estado del proyecto y fases completadas](02-estado-fases.md)
3. [Arquitectura tecnica](03-arquitectura.md)
4. [Guia de trabajo para el equipo](04-guia-equipo.md)
5. [Solucion de problemas](05-solucion-problemas.md)

## Resumen rapido

SOC Copilot es una aplicacion para analistas SOC junior. El backend analiza alertas con Gemini, persiste resultados en PostgreSQL y expone una API FastAPI. El frontend Next.js permite analizar logs, ver el historico y generar recomendaciones de respuesta.

La fase 2 esta terminada. La fase 3 empieza con el modulo de Chat IA + RAG sobre conocimiento de ciberseguridad en ChromaDB.

