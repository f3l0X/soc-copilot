"""SMTP delivery for transactional emails (verification links, etc).

Uses stdlib ``smtplib`` to avoid pulling another dependency. Sends are
synchronous but happen inside FastAPI's threadpool route handlers, so a
slow SMTP server only blocks the calling request, not the event loop.

Fails are logged and swallowed: a failed email must not crash registration
or block a user — the verification token is already stored in the DB and
can be resent via the admin panel.
"""
from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)


def _is_configured(s: Settings) -> bool:
    return bool(s.smtp_host and s.smtp_from)


def _build_verification_message(
    settings: Settings, to_email: str, to_name: str, link: str
) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = "Verifica tu cuenta en SOC Copilot"
    msg["From"] = settings.smtp_from
    msg["To"] = f"{to_name} <{to_email}>" if to_name else to_email

    text = (
        f"Hola {to_name or to_email},\n\n"
        "Bienvenido a SOC Copilot. Confirma tu dirección de email haciendo "
        "clic en el siguiente enlace (válido durante "
        f"{settings.email_verification_ttl_hours} horas):\n\n"
        f"{link}\n\n"
        "Si no has solicitado esta cuenta, ignora este mensaje.\n\n"
        "— SOC Copilot"
    )
    html = f"""<!DOCTYPE html>
<html lang="es"><body style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5">
  <h2 style="color:#0891b2">Bienvenido a SOC Copilot</h2>
  <p>Hola {to_name or to_email},</p>
  <p>Confirma tu dirección de email haciendo clic en el botón
     (válido durante {settings.email_verification_ttl_hours} horas):</p>
  <p style="margin:24px 0">
    <a href="{link}"
       style="background:#0891b2;color:#fff;padding:12px 20px;border-radius:6px;
              text-decoration:none;display:inline-block">
      Verificar email
    </a>
  </p>
  <p style="font-size:12px;color:#64748b">
    Si el botón no funciona, copia este enlace en tu navegador:<br>
    <a href="{link}">{link}</a>
  </p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
  <p style="font-size:11px;color:#94a3b8">
    Si no has solicitado esta cuenta, ignora este mensaje.<br>
    — SOC Copilot
  </p>
</body></html>"""

    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    return msg


def send_verification_email(to_email: str, to_name: str, token: str) -> bool:
    """Send the verification link. Returns True on success, False on failure.

    Failures are logged but never raised — registration must not break if
    SMTP is down. Caller decides what to surface to the user.
    """
    settings = get_settings()
    if not _is_configured(settings):
        logger.warning(
            "email.smtp_not_configured", extra={"to": to_email}
        )
        return False

    link = (
        f"{settings.web_base_url.rstrip('/')}/verify?token={token}"
    )
    msg = _build_verification_message(settings, to_email, to_name, link)

    try:
        if settings.smtp_use_ssl:
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(
                settings.smtp_host, settings.smtp_port,
                context=ctx, timeout=settings.smtp_timeout_seconds,
            ) as srv:
                if settings.smtp_user:
                    srv.login(settings.smtp_user, settings.smtp_password)
                srv.send_message(msg)
        else:
            with smtplib.SMTP(
                settings.smtp_host, settings.smtp_port,
                timeout=settings.smtp_timeout_seconds,
            ) as srv:
                srv.ehlo()
                if settings.smtp_use_starttls:
                    srv.starttls(context=ssl.create_default_context())
                    srv.ehlo()
                if settings.smtp_user:
                    srv.login(settings.smtp_user, settings.smtp_password)
                srv.send_message(msg)
        logger.info("email.verification_sent", extra={"to": to_email})
        return True
    except Exception:
        logger.exception("email.send_failed", extra={"to": to_email})
        return False
