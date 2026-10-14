# Ciclo de vida de las alertas y niveles SOC (Práctica 3)

Las alertas que llegan de Wazuh pasan por un ciclo de vida con estados, y
lo que cada analista puede hacer depende de su **nivel SOC** (L1, L2 o
Instructor). Las reglas se comprueban **en la API**
(`apps/api/app/services/alert_workflow.py`), no solo en la interfaz.

## 1. Estados

| Estado | Valor en la API | Significado |
|---|---|---|
| Nueva | `new` | Ha llegado y nadie la ha cogido |
| Asignada | `in_progress` | Un analista la está trabajando («Asignada a: nombre») |
| Escalada | `escalated` | Un analista la ha pasado al nivel superior con una nota; vuelve a quedar sin asignar |
| Resuelta | `resolved` | Cerrada como incidente real, con su resolución |
| Falso positivo | `false_positive` | Cerrada como falsa alarma, con su resolución |

```
 Nueva ──asignarse──► Asignada ──escalar (nota)──► Escalada
                        │  ▲                          │
                        │  └──── asignarse (L2+) ─────┘
                        │
                        └──cerrar──► Resuelta / Falso positivo ──reabrir (L2+)──► Asignada
```

Analizar con IA no cambia el estado; queda registrado en el historial.

## 2. Reglas por nivel

| Acción | L1 | L2 | Instructor | Admin |
|---|---|---|---|---|
| Asignarse una alerta nueva | Sí | Sí | Sí | Sí |
| Asignarse una escalada o la de otro analista | No | Sí | Sí | Sí |
| Analizar, escalar o cerrar | Solo las suyas | Solo las suyas | Solo las suyas | Siempre |
| Cerrar riesgo alto, crítico o sin analizar | No, debe escalar | Sí | Sí | Sí |
| Reabrir una alerta cerrada | No | Sí | Sí | Sí |
| Valorar una decisión | No | No | Sí, salvo las propias | Sí |

- Escalar exige una **nota** de al menos 10 caracteres.
- Cerrar exige una **resolución** de al menos 5 caracteres.
- Un nivel distinto de L1 solo se aplica cuando un administrador lo
  aprueba en **Admin**.
- Una acción no permitida responde **403** (nivel o alerta no asignada) o
  **409** (estado no válido, por ejemplo cerrar una alerta ya cerrada).

## 3. Colas de la página SIEM

| Cola | Qué muestra | Cola inicial para |
|---|---|---|
| Nuevas | Alertas sin asignar | L1 |
| Mis alertas | Abiertas y asignadas a mí | — |
| Asignadas | Todas las que alguien está trabajando | — |
| Escaladas | Pendientes de un L2 | L2 y admin |
| Cerradas | Resueltas y falsos positivos | — |
| Para revisar | Escaladas o cerradas sin valoración (solo Instructor y admin) | Instructor |
| Todas | Sin filtro | — |

## 4. Historial y auditoría

Cada acción (asignar, analizar, escalar, cerrar, reabrir, valorar) se
guarda en la tabla `alert_events` con quién, cuándo, el estado anterior y
el nuevo, y la nota. Se muestra en el panel **Gestión de la alerta**. Las
mismas acciones quedan también en la auditoría global (`audit_logs`).

## 5. Revisión del Instructor

El Instructor valora la decisión tomada en una alerta escalada o cerrada:

- **Correcta**, **Mejorable** o **Incorrecta**; el comentario es
  obligatorio si no es Correcta.
- Hay una valoración por alerta (tabla `alert_reviews`); se puede
  actualizar.
- Se valora a quien tomó la decisión: quien la escaló o quien la cerró.
  Nadie puede valorar una decisión propia.
- El analista ve la valoración en su alerta y en la tabla del SIEM.

## 6. Cierre masivo

`POST /api/alerts/bulk-resolve` cierra hasta 100 alertas con el mismo
veredicto y la misma resolución:

- Cada alerta se comprueba por separado con las reglas anteriores. Las
  que no se pueden cerrar se devuelven en `failed` con el motivo; el resto
  se cierran igualmente.
- Las alertas que no eran del usuario se le asignan antes de cerrarlas,
  para que el historial refleje quién las cerró.
- Cada cierre queda en la auditoría marcado como masivo.

Caso de uso típico: tras una actualización del servidor, Wazuh genera
muchas alertas «Integrity checksum changed» a la vez. No se silencian
(son los archivos que modificaría un atacante), sino que se comprueban
contra `/var/log/apt/history.log` y se cierran juntas.

## 7. Migraciones

| Migración | Cambio |
|---|---|
| `0009_alert_workflow` | Estado, asignación, escalado y resolución en `alerts`; tabla `alert_events` |
| `0010_alert_assignment_flow` | Solo datos: elimina el estado intermedio «triaged» |
| `0011_alert_reviews` | Tabla `alert_reviews` |

## 8. Pruebas

`apps/api/tests/test_alert_workflow.py` prueba cada regla sin base de
datos (75 casos), y `tests/test_e2e_wazuh.py` recorre el flujo completo
contra la API (asignarse la alerta antes de analizarla).
