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