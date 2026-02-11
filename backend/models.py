from datetime import datetime, timedelta
from app import db

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
