import json
import random
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app, Response
from sqlalchemy import text
from app import db
from models import Posto, Prenotazione, Blocco, Impostazioni, CodicePrenotazione, OperazioneLog

api_bp = Blueprint('api', __name__)


def _log_operazione(tipo, dettagli=None):
    """Registra un'operazione nel log (audit). dettagli: dict o str."""
    try:
        if isinstance(dettagli, dict):
            dettagli_str = json.dumps(dettagli, ensure_ascii=False)
        else:
            dettagli_str = str(dettagli or '')
        entry = OperazioneLog(tipo=tipo, dettagli=dettagli_str)
        db.session.add(entry)
        db.session.commit()
    except Exception:
        db.session.rollback()

def _pulisci_blocchi_scaduti():
    """Rimuove tutti i blocchi con scadenza passata."""
    now = datetime.utcnow()
    Blocco.query.filter(Blocco.scadenza < now).delete()
    db.session.commit()

def _get_scadenza():
    minuti = current_app.config.get('BLOCCO_DURATA_MINUTI', 5)
    return datetime.utcnow() + timedelta(minutes=minuti)

def _posto_occupato(posto):
    return Prenotazione.query.filter_by(posto_id=posto.id, stato='confermata').first() is not None

def _posto_blocco_attivo(posto):
    """Ritorna il Blocco attivo per il posto se esiste (scadenza > now), altrimenti None."""
    now = datetime.utcnow()
    return Blocco.query.filter_by(posto_id=posto.id).filter(Blocco.scadenza > now).first()

def _posto_stato(posto, session_id=None):
    if posto.riservato_staff or not posto.disponibile:
        return 'non_disponibile'
    if _posto_occupato(posto):
        return 'occupato'
    blocco = _posto_blocco_attivo(posto)
    if blocco:
        if session_id and blocco.session_id == session_id:
            return 'bloccato_da_me'
        return 'bloccato'
    return 'disponibile'

def _serialize_posto(posto, session_id=None):
    stato = _posto_stato(posto, session_id)
    out = {
        'id': posto.id,
        'fila': posto.fila,
        'numero': posto.numero,
        'disponibile': posto.disponibile,
        'riservato_staff': posto.riservato_staff,
        'stato': stato
    }
    if stato == 'occupato':
        pren = Prenotazione.query.filter_by(posto_id=posto.id, stato='confermata').first()
        if pren:
            out['prenotazione_nome'] = pren.nome
            out['prenotazione_nome_allieva'] = pren.nome_allieva or ''
            out['prenotazione_telefono'] = pren.telefono
    return out

@api_bp.route('/spettacolo', methods=['GET'])
def get_spettacolo():
    """Dati spettacolo per la pagina pubblica (senza auth)."""
    row = Impostazioni.query.get(1)
    if not row:
        return jsonify({
            'nome_teatro': '',
            'nome_spettacolo': '',
            'data_ora_evento': None,
            'gruppi_file': [],
        })
    return jsonify({
        'nome_teatro': row.nome_teatro or '',
        'nome_spettacolo': row.nome_spettacolo or '',
        'data_ora_evento': row.data_ora_evento.isoformat() if row.data_ora_evento else None,
        'gruppi_file': row.get_gruppi_file(),
    })


@api_bp.route('/posti', methods=['GET'])
def get_posti():
    _pulisci_blocchi_scaduti()
    session_id = request.args.get('session_id') or request.headers.get('X-Session-Id') or ''
    posti = Posto.query.order_by(Posto.fila, Posto.numero).all()
    return jsonify([_serialize_posto(p, session_id) for p in posti])

def _normalizza_telefono(val):
    """Restituisce solo le cifre del telefono (senza prefisso internazionale)."""
    return ''.join(c for c in (val or '') if c.isdigit())


def _valida_telefono(telefono):
    """Telefono: solo cifre, 9-11 caratteri (senza prefisso)."""
    t = _normalizza_telefono(telefono)
    if not t:
        return None, 'Inserisci il numero di telefono'
    if len(t) < 9 or len(t) > 11:
        return None, 'Il numero deve avere da 9 a 11 cifre (senza prefisso internazionale)'
    return t, None


@api_bp.route('/prenotazioni', methods=['POST'])
def crea_prenotazione():
    data = request.get_json() or {}
    posto_ids = data.get('posto_ids', [])
    nome = (data.get('nome') or '').strip()
    nome_allieva = (data.get('nome_allieva') or '').strip()
    telefono_raw = (data.get('telefono') or '').strip()
    session_id = (data.get('session_id') or request.headers.get('X-Session-Id') or '').strip()
    if not nome:
        return jsonify({'error': 'Nome richiesto'}), 400
    telefono, err = _valida_telefono(telefono_raw)
    if err:
        return jsonify({'error': err}), 400
    if not posto_ids:
        return jsonify({'error': 'Seleziona almeno un posto'}), 400
    try:
        _pulisci_blocchi_scaduti()
        # Lock per concorrenza: su SQLite BEGIN IMMEDIATE acquisisce il lock subito (prima di qualsiasi lettura)
        bind = db.session.get_bind()
        if bind.dialect.name == 'sqlite':
            db.session.execute(text('BEGIN IMMEDIATE'))
        for pid in posto_ids:
            posto = Posto.query.get(pid)
            if not posto:
                db.session.rollback()
                return jsonify({'error': f'Posto {pid} non trovato'}), 400
            if posto.riservato_staff or not posto.disponibile:
                db.session.rollback()
                return jsonify({'error': f'Posto {posto.fila}{posto.numero} non disponibile'}), 400
            if _posto_occupato(posto):
                db.session.rollback()
                return jsonify({'error': f'Posto {posto.fila}{posto.numero} già occupato. Ricarica la pagina e riprova.'}), 400
            blocco = _posto_blocco_attivo(posto)
            if blocco and (not session_id or blocco.session_id != session_id):
                db.session.rollback()
                return jsonify({'error': f'Posto {posto.fila}{posto.numero} non più disponibile (blocco scaduto o occupato). Ricarica e riprova.'}), 400
        created = []
        for pid in posto_ids:
            pren = Prenotazione(posto_id=pid, nome=nome, nome_allieva=nome_allieva or None, telefono=telefono, stato='confermata')
            db.session.add(pren)
            created.append(pren)
        # Rilascia blocchi sui posti prenotati (qualsiasi session_id)
        Blocco.query.filter(Blocco.posto_id.in_(posto_ids)).delete(synchronize_session=False)
        # Assegna o recupera codice prenotazione (6 cifre) per questo telefono
        row = CodicePrenotazione.query.filter_by(telefono=telefono).first()
        if row:
            codice = row.codice
            codice_nuovo = False
        else:
            for _ in range(10):
                codice = str(random.randint(100000, 999999))
                if CodicePrenotazione.query.filter_by(codice=codice).first() is None:
                    db.session.add(CodicePrenotazione(telefono=telefono, codice=codice))
                    codice_nuovo = True
                    break
            else:
                db.session.rollback()
                return jsonify({'error': 'Impossibile generare codice prenotazione. Riprova.'}), 500
        db.session.commit()
        try:
            posti_etichette = [f"{Posto.query.get(pid).fila}{Posto.query.get(pid).numero}" for pid in posto_ids]
            from email_service import invio_email_conferma
            invio_email_conferma(telefono, nome, nome_allieva or '', posti_etichette, codice)
        except Exception:
            pass
        _log_operazione('crea_prenotazione', {'telefono': telefono, 'nome': nome, 'nome_allieva': nome_allieva or '', 'posti': posti_etichette, 'codice': codice})
        return jsonify({
            'prenotazioni': [p.to_dict() for p in created],
            'codice': codice,
            'codice_nuovo': codice_nuovo,
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@api_bp.route('/prenotazioni', methods=['GET'])
def list_prenotazioni():
    pren = Prenotazione.query.filter_by(stato='confermata').order_by(Prenotazione.timestamp.desc()).all()
    return jsonify([p.to_dict() for p in pren])


@api_bp.route('/prenotazioni/recupera', methods=['POST'])
def recupera_prenotazioni():
    """Restituisce le prenotazioni confermate per telefono+codice (codice assegnato alla prima prenotazione)."""
    data = request.get_json() or {}
    telefono_raw = (data.get('telefono') or '').strip()
    codice = (data.get('codice') or '').strip()
    telefono, err = _valida_telefono(telefono_raw)
    if err:
        return jsonify({'error': err}), 400
    if not codice or len(codice) != 6 or not codice.isdigit():
        return jsonify({'error': 'Codice prenotazione non valido (6 cifre)'}), 400
    row = CodicePrenotazione.query.filter_by(telefono=telefono).first()
    if not row or row.codice != codice:
        return jsonify({'error': 'Nessuna prenotazione trovata per questo telefono e codice.'}), 404
    pren_list = Prenotazione.query.filter_by(telefono=row.telefono, stato='confermata').order_by(Prenotazione.timestamp.desc()).all()
    out = []
    for p in pren_list:
        posto = Posto.query.get(p.posto_id)
        out.append({
            **p.to_dict(),
            'posto_fila': posto.fila if posto else '',
            'posto_numero': posto.numero if posto else 0,
        })
    return jsonify({'prenotazioni': out})


@api_bp.route('/prenotazioni/annulla', methods=['POST'])
def annulla_prenotazioni():
    """Annulla tutte le prenotazioni per telefono+codice; notifica admin."""
    data = request.get_json() or {}
    telefono_raw = (data.get('telefono') or '').strip()
    codice = (data.get('codice') or '').strip()
    telefono, err = _valida_telefono(telefono_raw)
    if err:
        return jsonify({'error': err}), 400
    if not codice or len(codice) != 6 or not codice.isdigit():
        return jsonify({'error': 'Codice prenotazione non valido (6 cifre)'}), 400
    row = CodicePrenotazione.query.filter_by(telefono=telefono).first()
    if not row or row.codice != codice:
        return jsonify({'error': 'Nessuna prenotazione trovata per questo telefono e codice.'}), 404
    pren_list = Prenotazione.query.filter_by(telefono=row.telefono, stato='confermata').all()
    if not pren_list:
        return jsonify({'ok': True, 'message': 'Nessuna prenotazione attiva'})
    nome = pren_list[0].nome
    posti_etichette = []
    for p in pren_list:
        posto = Posto.query.get(p.posto_id)
        if posto:
            posti_etichette.append(f"{posto.fila}{posto.numero}")
        p.stato = 'cancellata'
    db.session.commit()
    try:
        from email_service import invio_email_annullamento
        invio_email_annullamento(telefono, nome, posti_etichette)
    except Exception:
        pass
    _log_operazione('annulla_prenotazioni', {'telefono': telefono, 'nome': nome, 'posti': posti_etichette})
    return jsonify({'ok': True})


@api_bp.route('/prenotazioni/aggiorna', methods=['POST'])
def aggiorna_prenotazioni():
    """Aggiorna le prenotazioni per telefono+codice: sostituisce i posti con la nuova lista; notifica admin."""
    data = request.get_json() or {}
    telefono_raw = (data.get('telefono') or '').strip()
    codice = (data.get('codice') or '').strip()
    posto_ids = data.get('posto_ids', [])
    nome = (data.get('nome') or '').strip() or None
    nome_allieva = (data.get('nome_allieva') or '').strip() or None
    telefono, err = _valida_telefono(telefono_raw)
    if err:
        return jsonify({'error': err}), 400
    if not codice or len(codice) != 6 or not codice.isdigit():
        return jsonify({'error': 'Codice prenotazione non valido (6 cifre)'}), 400
    row = CodicePrenotazione.query.filter_by(telefono=telefono).first()
    if not row or row.codice != codice:
        return jsonify({'error': 'Nessuna prenotazione trovata per questo telefono e codice.'}), 404
    if not posto_ids:
        return jsonify({'error': 'Seleziona almeno un posto'}), 400
    try:
        _pulisci_blocchi_scaduti()
        bind = db.session.get_bind()
        if bind.dialect.name == 'sqlite':
            db.session.execute(text('BEGIN IMMEDIATE'))
        old_list = Prenotazione.query.filter_by(telefono=row.telefono, stato='confermata').all()
        nome_final = nome if nome else (old_list[0].nome if old_list else '')
        nome_allieva_final = nome_allieva if nome_allieva is not None else (old_list[0].nome_allieva if old_list else None)
        for p in old_list:
            p.stato = 'cancellata'
        for pid in posto_ids:
            posto = Posto.query.get(pid)
            if not posto:
                db.session.rollback()
                return jsonify({'error': f'Posto {pid} non trovato'}), 400
            if posto.riservato_staff or not posto.disponibile:
                db.session.rollback()
                return jsonify({'error': f'Posto {posto.fila}{posto.numero} non disponibile'}), 400
            if _posto_occupato(posto):
                db.session.rollback()
                return jsonify({'error': f'Posto {posto.fila}{posto.numero} già occupato'}), 400
            pren = Prenotazione(posto_id=pid, nome=nome_final, nome_allieva=nome_allieva_final, telefono=row.telefono, stato='confermata')
            db.session.add(pren)
        db.session.commit()
        posti_etichette = [f"{Posto.query.get(pid).fila}{Posto.query.get(pid).numero}" for pid in posto_ids]
        try:
            from email_service import invio_email_conferma
            invio_email_conferma(row.telefono, nome_final, nome_allieva_final or '', posti_etichette, row.codice)
        except Exception:
            pass
        _log_operazione('aggiorna_prenotazioni', {'telefono': row.telefono, 'nome': nome_final, 'posti': posti_etichette})
        return jsonify({'ok': True, 'codice': row.codice})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@api_bp.route('/prenotazioni/<int:pid>', methods=['DELETE'])
def cancella_prenotazione(pid):
    pren = Prenotazione.query.get(pid)
    if not pren:
        return jsonify({'error': 'Prenotazione non trovata'}), 404
    posto = Posto.query.get(pren.posto_id)
    posto_label = f"{posto.fila}{posto.numero}" if posto else str(pren.posto_id)
    pren.stato = 'cancellata'
    db.session.commit()
    _log_operazione('admin_cancella_prenotazione', {'prenotazione_id': pid, 'telefono': pren.telefono, 'nome': pren.nome, 'posto': posto_label})
    return jsonify({'ok': True})

@api_bp.route('/admin/file/<fila>', methods=['PUT'])
def admin_file(fila):
    data = request.get_json() or {}
    password = data.get('password') or request.headers.get('X-Admin-Password')
    if password != current_app.config.get('ADMIN_PASSWORD'):
        return jsonify({'error': 'Non autorizzato'}), 401
    riservato = data.get('riservato_staff', True)
    updated = Posto.query.filter_by(fila=fila.upper()).update({'riservato_staff': riservato})
    db.session.commit()
    _log_operazione('admin_file', {'fila': fila.upper(), 'riservato_staff': riservato, 'aggiornati': updated})
    return jsonify({'aggiornati': updated})

@api_bp.route('/admin/file', methods=['GET'])
def admin_list_file():
    password = request.headers.get('X-Admin-Password') or request.args.get('password')
    if password != current_app.config.get('ADMIN_PASSWORD'):
        return jsonify({'error': 'Non autorizzato'}), 401
    from sqlalchemy import distinct
    file = db.session.query(Posto.fila).distinct().order_by(Posto.fila).all()
    file_list = [f[0] for f in file]
    riservate = db.session.query(Posto.fila).filter_by(riservato_staff=True).distinct().all()
    riservate_list = [r[0] for r in riservate]
    return jsonify({'file': file_list, 'riservate': riservate_list})


def _admin_auth():
    password = request.headers.get('X-Admin-Password') or (request.get_json() or {}).get('password') or request.args.get('password')
    if password != current_app.config.get('ADMIN_PASSWORD'):
        return None
    return True


@api_bp.route('/admin/posti', methods=['GET'])
def admin_get_posti():
    if not _admin_auth():
        return jsonify({'error': 'Non autorizzato'}), 401
    _pulisci_blocchi_scaduti()
    posti = Posto.query.order_by(Posto.fila, Posto.numero).all()
    return jsonify([_serialize_posto(p, None) for p in posti])


@api_bp.route('/admin/posti/<int:posto_id>', methods=['PUT'])
def admin_set_posto(posto_id):
    if not _admin_auth():
        return jsonify({'error': 'Non autorizzato'}), 401
    posto = Posto.query.get(posto_id)
    if not posto:
        return jsonify({'error': 'Posto non trovato'}), 404
    if _posto_occupato(posto):
        return jsonify({'error': 'Non si può modificare un posto già prenotato'}), 400
    data = request.get_json() or {}
    riservato = data.get('riservato_staff', True)
    posto.riservato_staff = bool(riservato)
    db.session.commit()
    _log_operazione('admin_set_posto', {'posto_id': posto_id, 'fila': posto.fila, 'numero': posto.numero, 'riservato_staff': riservato})
    return jsonify({'ok': True, 'riservato_staff': posto.riservato_staff})


@api_bp.route('/admin/export', methods=['GET'])
def admin_export():
    if not _admin_auth():
        return jsonify({'error': 'Non autorizzato'}), 401
    pren_list = Prenotazione.query.filter_by(stato='confermata').order_by(Prenotazione.nome, Prenotazione.telefono).all()
    by_seat = []
    person_map = {}  # (nome, telefono) -> { count, posti: [], timestamp: datetime }
    for p in pren_list:
        posto = Posto.query.get(p.posto_id)
        if not posto:
            continue
        fila, numero = posto.fila, posto.numero
        label = f'{fila}{numero}'
        by_seat.append({'fila': fila, 'numero': numero, 'posto': label, 'nome': p.nome, 'nome_allieva': p.nome_allieva or '', 'telefono': p.telefono})
        key = (p.nome, p.telefono)
        if key not in person_map:
            person_map[key] = {'nome': p.nome, 'nome_allieva': p.nome_allieva or '', 'telefono': p.telefono, 'count': 0, 'posti': [], 'timestamp': p.timestamp}
        else:
            if p.timestamp and (person_map[key]['timestamp'] is None or p.timestamp < person_map[key]['timestamp']):
                person_map[key]['timestamp'] = p.timestamp
        person_map[key]['count'] += 1
        person_map[key]['posti'].append(label)
    by_person = []
    for v in person_map.values():
        rec = {'nome': v['nome'], 'nome_allieva': v['nome_allieva'], 'telefono': v['telefono'], 'count': v['count'], 'posti': v['posti']}
        if v.get('timestamp'):
            rec['timestamp'] = v['timestamp'].isoformat()
        by_person.append(rec)
    by_person.sort(key=lambda x: (-x['count'], x['nome'], x['telefono']))
    by_seat.sort(key=lambda x: (x['fila'], x['numero']))
    return jsonify({'bySeat': by_seat, 'byPerson': by_person})


@api_bp.route('/admin/log', methods=['GET'])
def admin_get_log():
    """Restituisce il log delle operazioni (solo admin)."""
    if not _admin_auth():
        return jsonify({'error': 'Non autorizzato'}), 401
    limit = request.args.get('limit', type=int)
    if limit is None or limit < 1:
        limit = 1000
    limit = min(limit, 10000)
    rows = OperazioneLog.query.order_by(OperazioneLog.timestamp.desc()).limit(limit).all()
    return jsonify([r.to_dict() for r in rows])


def _escape_csv_cell(val):
    """Escape per cella CSV (virgolette se contiene separatore o virgolette)."""
    s = str(val) if val is not None else ''
    if ';' in s or '"' in s or '\n' in s or '\r' in s:
        return '"' + s.replace('"', '""') + '"'
    return s


@api_bp.route('/admin/log/export', methods=['GET'])
def admin_export_log_csv():
    """Esporta il log operazioni in CSV (solo admin)."""
    if not _admin_auth():
        return jsonify({'error': 'Non autorizzato'}), 401
    limit = request.args.get('limit', type=int)
    if limit is None or limit < 1:
        limit = 50000
    limit = min(limit, 50000)
    rows = OperazioneLog.query.order_by(OperazioneLog.timestamp.desc()).limit(limit).all()
    lines = ['Data e ora;Tipo;Dettagli']
    for r in rows:
        ts = r.timestamp.strftime('%Y-%m-%d %H:%M:%S') if r.timestamp else ''
        lines.append(f"{_escape_csv_cell(ts)};{_escape_csv_cell(r.tipo)};{_escape_csv_cell(r.dettagli or '')}")
    body = '\n'.join(lines)
    return Response(body, mimetype='text/csv; charset=utf-8', headers={
        'Content-Disposition': 'attachment; filename=log_operazioni.csv',
    })


@api_bp.route('/admin/impostazioni', methods=['GET'])
def admin_get_impostazioni():
    if not _admin_auth():
        return jsonify({'error': 'Non autorizzato'}), 401
    row = Impostazioni.query.get(1)
    if not row:
        return jsonify({
            'nome_teatro': '', 'indirizzo_teatro': '', 'nome_spettacolo': '',
            'data_ora_evento': None, 'numero_file': None, 'posti_per_fila': None,
            'gruppi_file': []
        })
    return jsonify({
        'nome_teatro': row.nome_teatro or '',
        'indirizzo_teatro': row.indirizzo_teatro or '',
        'nome_spettacolo': row.nome_spettacolo or '',
        'data_ora_evento': row.data_ora_evento.isoformat() if row.data_ora_evento else None,
        'numero_file': row.numero_file,
        'posti_per_fila': row.posti_per_fila,
        'gruppi_file': row.get_gruppi_file(),
    })


@api_bp.route('/admin/impostazioni', methods=['PUT'])
def admin_put_impostazioni():
    if not _admin_auth():
        return jsonify({'error': 'Non autorizzato'}), 401
    data = request.get_json() or {}
    row = Impostazioni.query.get(1)
    if not row:
        row = Impostazioni(id=1)
        db.session.add(row)
    row.nome_teatro = (data.get('nome_teatro') or '').strip()[:120]
    row.indirizzo_teatro = (data.get('indirizzo_teatro') or '').strip()[:255]
    row.nome_spettacolo = (data.get('nome_spettacolo') or '').strip()[:120]
    da = data.get('data_ora_evento')
    if da and isinstance(da, str):
        try:
            s = da.strip()
            if 'T' in s:
                date_part, time_part = s.split('T', 1)
                y, m, d = map(int, date_part.split('-'))
                h = mnt = 0
                if time_part:
                    t = time_part.replace('Z', '').replace('+00:00', '').strip()
                    parts = t.split(':')
                    h = int(parts[0]) if len(parts) > 0 else 0
                    mnt = int(parts[1]) if len(parts) > 1 else 0
                row.data_ora_evento = datetime(y, m, d, h, mnt)
            else:
                row.data_ora_evento = None
        except (ValueError, TypeError):
            row.data_ora_evento = None
    else:
        row.data_ora_evento = None
    row.numero_file = data.get('numero_file') if data.get('numero_file') is not None else None
    if row.numero_file is not None and (row.numero_file < 1 or row.numero_file > 50):
        row.numero_file = None
    row.posti_per_fila = data.get('posti_per_fila') if data.get('posti_per_fila') is not None else None
    if row.posti_per_fila is not None and (row.posti_per_fila < 1 or row.posti_per_fila > 50):
        row.posti_per_fila = None
    gruppi = data.get('gruppi_file')
    if isinstance(gruppi, list):
        row.set_gruppi_file([g for g in gruppi if isinstance(g, dict) and g.get('lettere') and g.get('nome')])
    db.session.commit()
    _log_operazione('admin_impostazioni', {'nome_spettacolo': row.nome_spettacolo or ''})
    return jsonify({'ok': True})


@api_bp.route('/admin/impostazioni/genera-posti', methods=['POST'])
def admin_genera_posti():
    if not _admin_auth():
        return jsonify({'error': 'Non autorizzato'}), 401
    row = Impostazioni.query.get(1)
    if not row or row.numero_file is None or row.numero_file < 1 or row.posti_per_fila is None or row.posti_per_fila < 1:
        return jsonify({'error': 'Configura prima numero di file e posti per fila'}), 400
    n_prenotazioni = Prenotazione.query.filter_by(stato='confermata').count()
    if n_prenotazioni > 0:
        return jsonify({'error': 'Impossibile rigenerare: ci sono prenotazioni confermate. Elimina le prenotazioni prima.'}), 400
    Blocco.query.delete()
    Posto.query.delete()
    db.session.commit()
    import string
    letters = string.ascii_uppercase[: row.numero_file]
    for i, letter in enumerate(letters):
        for n in range(1, row.posti_per_fila + 1):
            db.session.add(Posto(fila=letter, numero=n, disponibile=True, riservato_staff=False))
    creati = row.numero_file * row.posti_per_fila
    db.session.commit()
    _log_operazione('admin_genera_posti', {'creati': creati})
    return jsonify({'ok': True, 'creati': creati})


# --- Blocco temporaneo posti ---

@api_bp.route('/blocchi', methods=['POST'])
def blocca_posti():
    """Blocca i posti per la session_id. Crea nuovi blocchi o rinnova (scadenza +5 min) se già bloccati da questa session."""
    _pulisci_blocchi_scaduti()
    data = request.get_json() or {}
    posto_ids = data.get('posto_ids', [])
    session_id = (data.get('session_id') or request.headers.get('X-Session-Id') or '').strip()
    if not session_id:
        return jsonify({'error': 'session_id richiesto'}), 400
    if not posto_ids:
        return jsonify({'ok': True, 'bloccati': []})
    scadenza = _get_scadenza()
    bloccati = []
    conflitti = []
    for pid in posto_ids:
        posto = Posto.query.get(pid)
        if not posto or posto.riservato_staff or not posto.disponibile or _posto_occupato(posto):
            continue
        blocco = _posto_blocco_attivo(posto)
        if blocco:
            if blocco.session_id == session_id:
                blocco.scadenza = scadenza
                bloccati.append(pid)
            else:
                conflitti.append(pid)
        else:
            db.session.add(Blocco(posto_id=pid, session_id=session_id, scadenza=scadenza))
            bloccati.append(pid)
    db.session.commit()
    if conflitti:
        conflitti_etichette = []
        for pid in conflitti:
            p = Posto.query.get(pid)
            if p:
                conflitti_etichette.append(f'{p.fila}{p.numero}')
        return jsonify({
            'error': 'Alcuni posti sono stati bloccati da un altro utente.',
            'bloccati': bloccati,
            'conflitti': conflitti,
            'conflitti_etichette': conflitti_etichette,
        }), 409
    return jsonify({'ok': True, 'bloccati': bloccati})


@api_bp.route('/blocchi/rinnovo', methods=['PUT'])
def rinnova_blocchi():
    """Rinnova la scadenza (+5 min) per i blocchi della session_id sui posti indicati."""
    _pulisci_blocchi_scaduti()
    data = request.get_json() or {}
    posto_ids = data.get('posto_ids', [])
    session_id = (data.get('session_id') or request.headers.get('X-Session-Id') or '').strip()
    if not session_id or not posto_ids:
        return jsonify({'ok': True})
    scadenza = _get_scadenza()
    now = datetime.utcnow()
    Blocco.query.filter(
        Blocco.session_id == session_id,
        Blocco.posto_id.in_(posto_ids),
        Blocco.scadenza > now
    ).update({'scadenza': scadenza}, synchronize_session=False)
    db.session.commit()
    return jsonify({'ok': True})


@api_bp.route('/blocchi', methods=['DELETE'])
def rilascio_blocchi():
    """Rilascia i blocchi sui posti per la session_id (es. utente deseleziona posti)."""
    data = request.get_json() or {}
    posto_ids = data.get('posto_ids', [])
    session_id = (data.get('session_id') or request.headers.get('X-Session-Id') or '').strip()
    if not session_id or not posto_ids:
        return jsonify({'ok': True})
    Blocco.query.filter(
        Blocco.session_id == session_id,
        Blocco.posto_id.in_(posto_ids)
    ).delete(synchronize_session=False)
    db.session.commit()
    return jsonify({'ok': True})
