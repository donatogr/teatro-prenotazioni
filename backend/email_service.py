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


def invio_email_conferma(telefono: str, nome: str, nome_allieva: str, posti_etichette: list, codice: str):
    """Notifica admin della nuova prenotazione (utente identificato da telefono, senza invio email all'utente)."""
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
        f"Telefono: {telefono}\n"
        f"Posti: {posti_str}\n"
        f"Codice prenotazione: {codice}\n\n"
        f"L'utente può modificare o annullare con telefono e codice nella sezione 'Recupera con telefono e codice'."
    )
    admin_email = current_app.config.get('ADMIN_EMAIL')
    subject = f"Conferma prenotazione - {imp['nome_spettacolo'] if imp else 'Teatro'}"

    if admin_email and _usare_resend():
        _invia_resend(
            [admin_email],
            f"[Admin] Nuova prenotazione - {telefono}",
            corpo,
        )
    elif admin_email and _usare_smtp():
        try:
            from flask_mail import Mail, Message
            mail = Mail(current_app)
            msg_admin = Message(
                subject=f"[Admin] Nuova prenotazione - {telefono}",
                body=corpo,
                recipients=[admin_email],
            )
            mail.send(msg_admin)
        except Exception as e:
            current_app.logger.warning("Invio email conferma admin fallito: %s", e)
    else:
        current_app.logger.info("Prenotazione confermata (telefono %s): %s", telefono, corpo[:200])
        if admin_email:
            current_app.logger.info("Notifica admin: %s", admin_email)


def invio_email_annullamento(telefono: str, nome: str, posti_etichette: list):
    """Notifica admin dell'annullamento prenotazione (utente identificato da telefono)."""
    imp = _get_impostazioni()
    posti_str = ', '.join(posti_etichette) if posti_etichette else ''
    corpo = (
        f"La prenotazione è stata annullata.\n\n"
        f"Spettacolo: {imp['nome_spettacolo'] if imp else '—'} - {imp['nome_teatro'] if imp else '—'}\n\n"
        f"Nome: {nome}\n"
        f"Telefono: {telefono}\n"
        f"Posti annullati: {posti_str}\n"
    )
    admin_email = current_app.config.get('ADMIN_EMAIL')

    if admin_email and _usare_resend():
        _invia_resend([admin_email], "[Admin] Prenotazione annullata", corpo)
    elif admin_email and _usare_smtp():
        try:
            from flask_mail import Mail, Message
            mail = Mail(current_app)
            msg_admin = Message(
                subject="[Admin] Prenotazione annullata",
                body=corpo,
                recipients=[admin_email],
            )
            mail.send(msg_admin)
        except Exception as e:
            current_app.logger.warning("Invio email annullamento admin fallito: %s", e)
    else:
        current_app.logger.info("Prenotazione annullata (telefono %s): %s", telefono, corpo[:200])
        if admin_email:
            current_app.logger.info("Notifica admin: %s", admin_email)
