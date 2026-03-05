import os

class Config:
    # CORS: in Docker usare es. ALLOWED_ORIGINS=http://localhost:8080,http://localhost
    _cors = os.environ.get('ALLOWED_ORIGINS', '')
    CORS_ORIGINS = [x.strip() for x in _cors.split(',') if x.strip()] or [
        'http://localhost:5173', 'http://127.0.0.1:5173'
    ]
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    _base = os.path.join(BASE_DIR, "database.db")
    if os.environ.get('TESTING'):
        SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///:memory:'
    else:
        SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or f'sqlite:///{_base}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')
    BLOCCO_DURATA_MINUTI = 5

    # Email: scegli un provider (il primo con configurazione valida ha priorità)
    # - Resend: imposta RESEND_API_KEY e MAIL_FROM
    RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
    MAIL_FROM = os.environ.get('MAIL_FROM', '')  # Mittente (Resend: obbligatorio; SMTP: opz. se usi MAIL_DEFAULT_SENDER)
    ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', '')  # Riceve copia conferme/annullamenti

    # SMTP (alternativa a Resend, richiede Flask-Mail)
    MAIL_SERVER = os.environ.get('MAIL_SERVER', '')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', '587'))
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'true').lower() in ('1', 'true', 'yes')
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME', '')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD', '')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', '')  # es. "noreply@tudominio.com"