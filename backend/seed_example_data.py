"""
Inserisce valori di esempio nel DB: impostazioni, posti (se vuoto), prenotazioni.
Eseguire dalla cartella backend con: python seed_example_data.py
"""
import random
import string
from datetime import datetime, timedelta, timezone

def run():
    from app import create_app, db
    from models import Impostazioni, Posto, Prenotazione, CodicePrenotazione

    app = create_app()
    with app.app_context():
        # 1) Impostazioni (id=1)
        imp = db.session.get(Impostazioni, 1)
        if not imp:
            imp = Impostazioni(id=1)
            db.session.add(imp)
        imp.nome_teatro = 'Teatro Verdi'
        imp.indirizzo_teatro = 'Via Roma 1, 50100 Firenze'
        imp.nome_spettacolo = 'Saggio di fine anno 2025'
        imp.data_ora_evento = datetime.now(timezone.utc) + timedelta(days=30)
        imp.numero_file = 15
        imp.posti_per_fila = 10
        imp.set_gruppi_file([
            {'lettere': 'A-G', 'nome': 'Platea'},
            {'lettere': 'H-N', 'nome': 'Galleria'},
        ])
        db.session.commit()
        print('Impostazioni aggiornate (Teatro Verdi, Saggio di fine anno).')

        # 2) Posti (solo se tabella vuota)
        if db.session.query(Posto).first() is None:
            letters = string.ascii_uppercase[: imp.numero_file]
            for letter in letters:
                for n in range(1, imp.posti_per_fila + 1):
                    db.session.add(Posto(fila=letter, numero=n, disponibile=True, riservato_staff=False))
            db.session.commit()
            print(f'Creati {imp.numero_file * imp.posti_per_fila} posti.')
        else:
            print('Tabella posti già presente, skip.')

        # 3) Prenotazioni di esempio (solo se non ci sono già prenotazioni)
        if db.session.query(Prenotazione).filter_by(stato='confermata').count() > 0:
            print('Esistono già prenotazioni, skip inserimento esempio.')
            return

        posti = db.session.query(Posto).order_by(Posto.fila, Posto.numero).all()
        if len(posti) < 5:
            print('Posti insufficienti per creare prenotazioni di esempio.')
            return

        esempi = [
            {'nome': 'Maria Rossi', 'nome_allieva': 'Giulia Rossi', 'email': 'maria.rossi@email.it', 'n_posti': 2},
            {'nome': 'Luigi Bianchi', 'nome_allieva': '', 'email': 'luigi.bianchi@email.it', 'n_posti': 1},
            {'nome': 'Anna Verdi', 'nome_allieva': 'Marco Verdi', 'email': 'anna.verdi@email.it', 'n_posti': 3},
            {'nome': 'Paolo Neri', 'nome_allieva': '', 'email': 'paolo.neri@email.it', 'n_posti': 1},
        ]

        idx = 0
        for e in esempi:
            for _ in range(e['n_posti']):
                if idx >= len(posti):
                    break
                posto = posti[idx]
                idx += 1
                pren = Prenotazione(
                    posto_id=posto.id,
                    nome=e['nome'],
                    nome_allieva=e['nome_allieva'] or None,
                    email=e['email'].lower(),
                    stato='confermata',
                )
                db.session.add(pren)
            # Codice prenotazione 6 cifre per questa email
            if db.session.query(CodicePrenotazione).filter_by(email=e['email'].lower()).first() is None:
                for _ in range(20):
                    codice = str(random.randint(100000, 999999))
                    if db.session.query(CodicePrenotazione).filter_by(codice=codice).first() is None:
                        db.session.add(CodicePrenotazione(email=e['email'].lower(), codice=codice))
                        break

        db.session.commit()
        print('Inserite 7 prenotazioni di esempio (Maria, Luigi, Anna, Paolo).')


if __name__ == '__main__':
    run()
