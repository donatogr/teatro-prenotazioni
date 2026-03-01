"""Invio email conferma e annullamento prenotazione.

Provider supportati (in ordine di priorità):
- Resend: imposta RESEND_API_KEY e MAIL_FROM (es. "Teatro <prenotazioni@tudominio.com>")
- SMTP: imposta MAIL_SERVER, MAIL_PORT, MAIL_USE_TLS, MAIL_USERNAME, MAIL_PASSWORD (opz. Flask-Mail)
Se nessuno è configurato, le email vengono solo loggate.
"""
from flask import current_app


def _usare_resend():
    """True se Resend è configurato (API key + from)."""
    return bool(
        current_app.config.get('RESEND_API_KEY')
        and current_app.config.get('MAIL_FROM')
    )


def _usare_smtp():
    """True se SMTP è configurato."""
    return bool(current_app.config.get('MAIL_SERVER'))


def _invia_resend(to: list[str], subject: str, body: str) -> bool:
    """Invia email tramite Resend. Ritorna True se inviata, False altrimenti."""
    try:
        import resend
        resend.api_key = current_app.config.get('RESEND_API_KEY')
        params = {
            "from": current_app.config.get('MAIL_FROM'),
            "to": to,
            "subject": subject,
            "text": body,
        }
        resend.Emails.send(params)
        return True
    except Exception as e:
        current_app.logger.warning("Resend invio fallito: %s", e)
        return False


def _get_impostazioni():
    """Dati spettacolo per il corpo email."""
    try:
        from models import Impostazioni
        row = Impostazioni.query.get(1)
        if not row:
            return None
        return {
            'nome_teatro': row.nome_teatro or '',
            'nome_spettacolo': row.nome_spettacolo or '',
            'data_ora_evento': row.data_ora_evento,
        }
    except Exception:
        return None


def invio_email_conferma(email_destinatario: str, nome: str, nome_allieva: str, posti_etichette: list, codice: str):
    """Invia email di conferma prenotazione a utente e admin."""
    imp = _get_impostazioni()
    posti_str = ', '.join(posti_etichette) if posti_etichette else ''
    data_ora = ''
    if imp and imp.get('data_ora_evento'):
        data_ora = imp['data_ora_evento'].strftime('%d/%m/%Y ore %H:%M')
    corpo = (
        f"Prenotazione confermata.\n\n"
        f"Spettacolo: {imp['nome_spettacolo'] if imp else '—'} - {imp['nome_teatro'] if imp else '—'}\n"
        f"Data/ora: {data_ora}\n\n"
        f"Nome: {nome}\n"
        f"Allieva: {nome_allieva or '—'}\n"
        f"Posti: {posti_str}\n"
        f"Codice prenotazione: {codice}\n\n"
        f"Per modificare o annullare la prenotazione, usa la stessa email e questo codice nella sezione 'Recupera con email e codice'."
    )
    admin_email = current_app.config.get('ADMIN_EMAIL')
    subject = f"Conferma prenotazione - {imp['nome_spettacolo'] if imp else 'Teatro'}"

    if _usare_resend():
        _invia_resend([email_destinatario], subject, corpo)
        if admin_email and admin_email != email_destinatario:
            _invia_resend(
                [admin_email],
                f"[Admin] Nuova prenotazione - {email_destinatario}",
                corpo,
            )
    elif _usare_smtp():
        try:
            from flask_mail import Mail, Message
            mail = Mail(current_app)
            msg = Message(subject=subject, body=corpo, recipients=[email_destinatario])
            mail.send(msg)
            if admin_email and admin_email != email_destinatario:
                msg_admin = Message(
                    subject=f"[Admin] Nuova prenotazione - {email_destinatario}",
                    body=corpo,
                    recipients=[admin_email],
                )
                mail.send(msg_admin)
        except Exception as e:
            current_app.logger.warning("Invio email conferma fallito: %s", e)
    else:
        current_app.logger.info("Email conferma (utente): %s\n%s", email_destinatario, corpo[:200])
        if admin_email:
            current_app.logger.info("Email conferma (admin): %s", admin_email)


def invio_email_annullamento(email_destinatario: str, nome: str, posti_etichette: list):
    """Invia email di annullamento prenotazione a utente e admin."""
    imp = _get_impostazioni()
    posti_str = ', '.join(posti_etichette) if posti_etichette else ''
    corpo = (
        f"La prenotazione è stata annullata.\n\n"
        f"Spettacolo: {imp['nome_spettacolo'] if imp else '—'} - {imp['nome_teatro'] if imp else '—'}\n\n"
        f"Nome: {nome}\n"
        f"Email: {email_destinatario}\n"
        f"Posti annullati: {posti_str}\n"
    )
    admin_email = current_app.config.get('ADMIN_EMAIL')
    subject = "Annullamento prenotazione"

    if _usare_resend():
        _invia_resend([email_destinatario], subject, corpo)
        if admin_email and admin_email != email_destinatario:
            _invia_resend([admin_email], "[Admin] Prenotazione annullata", corpo)
    elif _usare_smtp():
        try:
            from flask_mail import Mail, Message
            mail = Mail(current_app)
            msg = Message(subject=subject, body=corpo, recipients=[email_destinatario])
            mail.send(msg)
            if admin_email and admin_email != email_destinatario:
                msg_admin = Message(
                    subject="[Admin] Prenotazione annullata",
                    body=corpo,
                    recipients=[admin_email],
                )
                mail.send(msg_admin)
        except Exception as e:
            current_app.logger.warning("Invio email annullamento fallito: %s", e)
    else:
        current_app.logger.info("Email annullamento (utente): %s\n%s", email_destinatario, corpo[:200])
        if admin_email:
            current_app.logger.info("Email annullamento (admin): %s", admin_email)
