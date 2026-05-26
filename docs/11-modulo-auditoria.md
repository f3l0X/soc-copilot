# Módulo de Auditoría (Audit Module)

Este documento detalla el funcionamiento del módulo de auditoría de SOC Copilot, encargado de registrar de manera inmutable las acciones críticas y de administración que ocurren en la aplicación.

## Diseño y Arquitectura

El módulo se compone principalmente del servicio `app/services/audit.py` y el modelo `AuditLog` definido en `app/models.py`.

* **Modelo Append-Only**: La tabla `audit_logs` es inmutable. No se permite actualizar o borrar filas. Esto garantiza la integridad forense y trazabilidad.
* **Persistencia Desacoplada de Objetos**: Permite `actor_id` y `actor_email` nulos u opcionales para poder trazar acciones no autenticadas (ej. ataques de fuerza bruta al login).

## Categorías de Eventos Auditados

El módulo registra eventos clasificados por su prefijo de acción (`action`):

### Autenticación (`auth.*`)
* `auth.register`: Creación de un nuevo usuario (registra `verification_required`, `role`, `level`, `is_first` en `details`).
* `auth.register_honeypot`: Bot que rellenó el campo trampa `website` del formulario de registro. La fila se persiste pero el usuario nunca se crea — el bot recibe un 201 falso.
* `auth.email_verified`: El usuario completa el flujo de verificación clicando el link recibido por SMTP.
* `auth.verify_failed`: Intento de verificación con token inválido o expirado (`details.reason = "expired"` o ausente).
* `auth.login`: Inicio de sesión exitoso (`details.level` con el nivel SOC efectivo).
* `auth.login_failed`: Intento de login fallido (registra IP, correo intentado y, si la cuenta existe, el contador `attempts`).
* `auth.lockout`: La N-ésima falla cruzó `AUTH_LOCKOUT_THRESHOLD` (default 4) y la cuenta queda bloqueada `AUTH_LOCKOUT_MINUTES` (default 15).
* `auth.login_blocked`: Intento contra una cuenta que estaba bloqueada (`details.reason = "locked"`) o no verificada (`details.reason = "not_verified"`). Mensaje al usuario opaco e idéntico al de credenciales malas para no filtrar estado.
* `auth.logout`: Cierre de sesión.
* `auth.update_profile`: Modificación de nombre/apellidos/correo (registra `email_changed`, `level_changed`, `level`).
* `auth.llm_settings_updated`: Configuración o actualización de la clave API de Gemini (`details.key_changed`, `details.preferred_chat_model`).
* `auth.llm_key_cleared`: Eliminación de la clave API de Gemini del usuario.

### Operaciones Administrativas (`user.*`, `permissions.*`, `settings.*`)
* `user.create`: Administrador crea un analista.
* `user.password_reset`: Administrador resetea la contraseña de un usuario.
* `user.llm_quota_reset`: Administrador reinicia la cuota diaria del LLM.
* `user.role_change`: Promoción o degradación de rol.
* `user.level_change`: Aprobación o cambio del nivel SOC (L1 / L2 / Instructor) solicitado por el usuario.
* `user.delete`: Eliminación de un usuario del sistema.
* `permissions.update`: Modificación en la matriz de roles y permisos.
* `settings.public_registration.update`: Toggle del registro público abierto/cerrado desde el panel admin (registra `details.from` y `details.to` con el valor booleano anterior y nuevo).

### Interacciones IA (`explain.*`, `chat.*`, `recommend.*`)
* `explain.alert`: El analista solicita una explicación de IA para una alerta.
* `chat.message`: El analista envía un mensaje al asistente de IA en contexto de una alerta.
* `recommend.actions`: Se solicita una recomendación estructurada de pasos de remediación.

## Uso para Desarrolladores

Para invocar el servicio de auditoría desde un nuevo módulo o router:

```python
from app.services.audit import log_audit

# Ejemplo: Registrar un evento simple autenticado
log_audit(
    db,
    actor=user,
    action="modulo.accion_realizada",
    target_type="entidad",
    target_id=entidad.id,
    details={"key": "value"}
)
db.commit() # Asegurar de comitear si la ruta no lo hace
```
