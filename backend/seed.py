"""Crea posti di esempio se la tabella è vuota (teatro medio: ~15 file, ~10 posti per fila)."""
from app import db
from models import Posto

def init_seats_if_empty():
    if Posto.query.first() is not None:
        return
    # Teatro medio: file A-O (15 file), 8-12 posti per fila (variabile)
    import random
    for i, letter in enumerate('ABCDEFGHIJKLMNO'):
        num_seats = random.randint(8, 12)
        for n in range(1, num_seats + 1):
            db.session.add(Posto(fila=letter, numero=n, disponibile=True, riservato_staff=False))
    db.session.commit()
