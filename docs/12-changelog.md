# Changelog de UI/UX

## [17/05/2026] - Política de contraseñas unificada en reseteo admin

El modal "Resetear contraseña" del panel `/admin → Usuarios` ahora aplica
exactamente la misma política que el registro de cuenta: mínimo 10
caracteres, mayúscula, minúscula, dígito, símbolo, puntuación zxcvbn ≥ 2
y campo de confirmación con verificación de coincidencia en vivo. El
botón Guardar queda deshabilitado hasta que se cumplen todos los
criterios. Se extrajo la política a un módulo compartido para evitar
divergencia entre flujos.

**Archivos modificados:**
- `apps/web/src/lib/password.ts` (nuevo): reglas, loader perezoso de
  zxcvbn-ts, constantes de fortaleza, helper `evaluatePassword`.
- `apps/web/src/app/login/page.tsx`: refactor para consumir el módulo
  compartido (sin cambios funcionales).
- `apps/web/src/app/admin/page.tsx`: el modal `pwUser` añade campo
  Confirmar contraseña, barra de fortaleza, checklist de reglas y
  validación de submit; el título pasa a "Resetear contraseña".
- `apps/api/app/schemas/admin.py`: `ChangePasswordRequest` y
  `CreateUserRequest` pasan de `min_length=8` a `min_length=MIN_LENGTH`
  (10) y aplican el validador `check_password` (mismas reglas que
  `RegisterRequest`). Cierra el bypass por llamada directa a la API.
- `docs/security.md`: tabla de validación de schemas refleja la nueva
  política en los 3 endpoints (register, admin reset, admin create).

**Impacto:**
- Un admin ya no puede establecer contraseñas débiles (≥ 8 caracteres
  sin clases ni fortaleza mínima) al resetear cuentas ajenas, ni vía UI
  ni vía API directa.
- Tras un reseteo exitoso, las sesiones activas del usuario afectado se
  invalidan automáticamente (comportamiento ya existente).

## [17/05/2026] - Confirmación inline para eliminar usuario

El botón **Eliminar** de la tabla de usuarios en `/admin` ya no usa
`window.confirm()`. Pasa a una confirmación inline ¿Eliminar? Sí / No
con el mismo patrón visual que la confirmación de "Resetear cuota"
(botones emerald/slate, texto rose para la pregunta).

**Archivos modificados:**
- `apps/web/src/app/admin/page.tsx`: nuevo estado `confirmDeleteId`,
  `handleDelete` ya no abre el diálogo nativo, render condicional del
  botón rojo o de los botones Sí/No.

**Impacto:**
- UX consistente con el resto de acciones críticas del panel.
- Sin dependencia del prompt nativo del navegador (mejor accesibilidad
  y testeabilidad).

## [17/05/2026] - Acciones del panel de usuarios como botones

Las acciones de cada fila en `/admin → Usuarios` (Resetear cuota,
Password, Eliminar) pasan de enlaces subrayados a botones con borde,
fondo translúcido y estado hover/disabled. La acción "Password" se
renombra a **"Resetear contraseña"**. Layout flex con `gap-2 flex-wrap`
para pantallas estrechas.

**Archivos modificados:**
- `apps/web/src/app/admin/page.tsx`: estilos de la celda de acciones,
  texto del botón.

**Impacto:**
- Visualmente más reconocibles como controles interactivos.
- Etiqueta más explícita sobre lo que hace la acción.

## [17/05/2026] - Migración OWASP Top 10 2021 → 2025

Se actualiza el dataset RAG y todas las referencias de la app a la
edición 2025 del OWASP Top 10 (publicada en 2025). Cambios estructurales
respecto a 2021:

- A01 absorbe SSRF (antes A10).
- A02 Security Misconfiguration sube de #5 a #2.
- A03 Software Supply Chain Failures (nueva, reemplaza/amplía la antigua
  A06 Vulnerable & Outdated Components).
- A07 renombrada a "Authentication Failures".
- A09 renombrada a "Security Logging & Alerting Failures".
- A10 Mishandling of Exceptional Conditions (nueva).

**Archivos modificados:**
- `apps/api/scripts/owasp_top10.py`: dataset reescrito con `A##:2025`,
  descripciones curadas y tags. Alias `OWASP_TOP_10_2021 =
  OWASP_TOP_10_2025` para compatibilidad temporal.
- `apps/api/scripts/ingest_kb.py`: imports y logs apuntan a la lista
  2025.
- `apps/api/app/services/chat.py`: el system prompt cita `A##:2025`.
- `apps/api/tests/test_smoke.py`: fixtures de OWASP migrados.
- `apps/web/src/app/chat/page.tsx`: starter prompt y URL externa.
- Docs: `README.md`, `01-instalacion-local.md`, `02-estado-fases.md`,
  `03-arquitectura.md`, `06-api-reference.md`, `08-rag-ingestion.md`,
  `09-diagramas.md`, `10-manual-usuario.md`.

**Operación post-deploy:**
Re-ingerir la KB con `docker compose exec api python -m
scripts.ingest_kb --force` para sustituir los 10 docs `owasp:A##:2021`
por `owasp:A##:2025` en Chroma. Tras la migración la colección queda
con ~707 docs (691 MITRE + 10 OWASP 2025 + posibles extras).

**Impacto:**
- Las citas del chat usan IDs `owasp:A##:2025`.
- Las pills clicables en `/chat` enlazan a la sección 2025 de
  `owasp.org/Top10/`.

## [17/05/2026] - Ocultamiento de Next Step Recommender

Se ha procedido a ocultar la opción "Next Step Recommender" de las interfaces principales por solicitud del usuario.

**Archivos modificados:**
- `apps/web/src/app/page.tsx`: Se eliminó el objeto correspondiente a `/respond` del array de tiles `TILES`.
- `apps/web/src/components/AppShell.tsx`: Se eliminó el objeto correspondiente a `/respond` del menú lateral `OPS_NAV`.

**Impacto:**
- Los usuarios ya no verán el enlace a `/respond` en la página principal ni en la barra de navegación lateral.
- La ruta `/respond` y el componente de la página (`apps/web/src/app/respond/page.tsx`) aún existen en el código y pueden ser accedidos directamente por URL o desde otros lugares que conserven el enlace (como el botón "Next Step Recommender" en los detalles de una alerta, el cual no fue solicitado a remover en esta iteración).

## [17/05/2026] - Ocultamiento de textos de rutas

Se ha procedido a ocultar todos los textos en la interfaz que hacian mencion explicita a las rutas de las paginas (ej. /alerts, /admin).

**Archivos modificados:**
- `apps/web/src/app/page.tsx`: Se eliminaron los bloques de texto que mostraban `t.hint` y `/admin` en las tarjetas de la pagina principal.

## [17/05/2026] - Reemplazo de ruta en historico

Se reemplazó la mencion explícita de la ruta `/alerts` por el nombre del menú `Alertas` en la vista del historial de alertas, mejorando la legibilidad para los usuarios finales.

**Archivos modificados:**
- `apps/web/src/app/history/page.tsx`: Modificado el estado vacío para que el enlace diga "Alertas" en lugar de "/alerts".

## [17/05/2026] - Estilizado de enlaces a botones

Se convirtieron los enlaces de texto plano que navegaban entre los módulos de Alertas y Chat hacia el Historial y viceversa, dándoles la apariencia de botones secundarios interactivos para mejorar la consistencia visual y la accesibilidad.

**Archivos modificados:**
- `apps/web/src/app/alerts/page.tsx`: El enlace a `/history` ahora tiene clases de botón.
- `apps/web/src/app/chat/page.tsx`: El enlace a `/alerts` ahora tiene clases de botón y el texto capitalizado.

## [17/05/2026] - Ajuste de estilos de botones de navegacion

Se unificó el estilo visual de los nuevos botones añadidos en los módulos de Alertas y Chat, aplicando las mismas clases CSS usadas por el botón secundario del Dashboard (`Analizar una alerta`) para asegurar total consistencia en el sistema de diseño.

**Archivos modificados:**
- `apps/web/src/app/alerts/page.tsx`: Clases CSS de botón actualizadas a formato unificado.
- `apps/web/src/app/chat/page.tsx`: Clases CSS de botón actualizadas a formato unificado.

## [17/05/2026] - Reemplazo de texto en estado vacio de Dashboard

Se eliminó la mención explícita a la ruta `/alerts` en el mensaje que aparece cuando el Dashboard no tiene datos, en favor de un texto más descriptivo que invita al usuario a crear su primera alerta, manteniendo la navegación mediante un hipervínculo en el propio texto.

**Archivos modificados:**
- `apps/web/src/app/dashboard/page.tsx`: Modificado el componente de texto del estado vacío.

## [17/05/2026] - Eliminacion de hipervinculo en Dashboard

Se retiró el hipervínculo del mensaje de estado vacío en el Dashboard para que sea únicamente texto plano, siguiendo las preferencias de diseño indicadas.

**Archivos modificados:**
- `apps/web/src/app/dashboard/page.tsx`: El componente <Link> fue removido dejando solo la etiqueta <p>.
