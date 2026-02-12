"""Crea posti di esempio se la tabella è vuota. Usa Impostazioni se presenti."""
from app import db
from models import Posto, Impostazioni

def init_seats_if_empty():
    if Posto.query.first() is not None:
        return
    imp = Impostazioni.query.get(1)
    if imp and imp.numero_file and imp.numero_file >= 1 and imp.posti_per_fila and imp.posti_per_fila >= 1:
        import string
        letters = string.ascii_uppercase[: imp.numero_file]
        for letter in letters:
            for n in range(1, imp.posti_per_fila + 1):
                db.session.add(Posto(fila=letter, numero=n, disponibile=True, riservato_staff=False))
        db.session.commit()
        return
    # Default: teatro medio ~15 file, 8-12 posti per fila
    import random
    for i, letter in enumerate('ABCDEFGHIJKLMNO'):
        num_seats = random.randint(8, 12)
        for n in range(1, num_seats + 1):
            db.session.add(Posto(fila=letter, numero=n, disponibile=True, riservato_staff=False))
    db.session.commit()
