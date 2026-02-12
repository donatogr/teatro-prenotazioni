from datetime import datetime, timedelta
import json
from app import db

class Impostazioni(db.Model):
    """Configurazione spettacolo e teatro (singola riga, id=1)."""
    __tablename__ = 'impostazioni'
    id = db.Column(db.Integer, primary_key=True, default=1)
    nome_teatro = db.Column(db.String(120), default='')
    indirizzo_teatro = db.Column(db.String(255), default='')
    nome_spettacolo = db.Column(db.String(120), default='')
    data_ora_evento = db.Column(db.DateTime, nullable=True)
    numero_file = db.Column(db.Integer, nullable=True)  # es. 15
    posti_per_fila = db.Column(db.Integer, nullable=True)  # stesso per tutte le file, es. 10
    gruppi_file = db.Column(db.Text, default='[]')  # JSON: [{"lettere": "A-G", "nome": "Platea"}, ...]

    def get_gruppi_file(self):
        try:
            return json.loads(self.gruppi_file or '[]')
        except Exception:
            return []

    def set_gruppi_file(self, value):
        self.gruppi_file = json.dumps(value) if value is not None else '[]'


class Posto(db.Model):
    __tablename__ = 'posti'
    id = db.Column(db.Integer, primary_key=True)
    fila = db.Column(db.String(10), nullable=False)
    numero = db.Column(db.Integer, nullable=False)
    disponibile = db.Column(db.Boolean, default=True, nullable=False)
    riservato_staff = db.Column(db.Boolean, default=False, nullable=False)

    prenotazioni = db.relationship('Prenotazione', backref='posto', lazy='dynamic', foreign_keys='Prenotazione.posto_id')
    blocchi = db.relationship('Blocco', backref='posto', lazy='dynamic', foreign_keys='Blocco.posto_id')


class Blocco(db.Model):
    __tablename__ = 'blocchi'
    id = db.Column(db.Integer, primary_key=True)
    posto_id = db.Column(db.Integer, db.ForeignKey('posti.id'), nullable=False, unique=True)
    session_id = db.Column(db.String(64), nullable=False)
    scadenza = db.Column(db.DateTime, nullable=False)

    def __repr__(self):
        return f'<Blocco posto={self.posto_id} session={self.session_id[:8]}... scadenza={self.scadenza}>'

    def __repr__(self):
        return f'<Posto {self.fila}{self.numero}>'


class CodicePrenotazione(db.Model):
    """Codice 6 cifre univoco per email, assegnato alla prima prenotazione."""
    __tablename__ = 'codici_prenotazione'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), nullable=False, unique=True, index=True)
    codice = db.Column(db.String(6), nullable=False, unique=True)

    def __repr__(self):
        return f'<CodicePrenotazione email={self.email!r} codice={self.codice!r}>'


class Prenotazione(db.Model):
    __tablename__ = 'prenotazioni'
    id = db.Column(db.Integer, primary_key=True)
    posto_id = db.Column(db.Integer, db.ForeignKey('posti.id'), nullable=False)
    nome = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    stato = db.Column(db.String(20), default='confermata', nullable=False)  # confermata, cancellata

    def to_dict(self):
        return {
            'id': self.id,
            'posto_id': self.posto_id,
            'nome': self.nome,
            'email': self.email,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'stato': self.stato
        }

    def __repr__(self):
        return f'<Prenotazione {self.id} posto={self.posto_id}>'
