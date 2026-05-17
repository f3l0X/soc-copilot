# Changelog de UI/UX

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
