"""Test API backend: posti, prenotazioni, blocchi, admin."""
import pytest


def test_get_posti(client):
    """GET /api/posti restituisce lista posti con stato."""
    r = client.get('/api/posti')
    assert r.status_code == 200
    data = r.get_json()
    assert isinstance(data, list)
    assert len(data) > 0
    posto = data[0]
    assert 'id' in posto and 'fila' in posto and 'numero' in posto
    assert posto['stato'] in ('disponibile', 'occupato', 'non_disponibile', 'bloccato', 'bloccato_da_me')


def test_get_posti_con_session_id(client):
    """GET /api/posti?session_id=xxx include session per stato blocchi."""
    r = client.get('/api/posti', query_string={'session_id': 'sess-123'})
    assert r.status_code == 200
    data = r.get_json()
    assert isinstance(data, list)


def test_crea_prenotazione_nome_email_richiesti(client):
    """POST /api/prenotazioni senza nome/email -> 400."""
    r = client.post('/api/prenotazioni', json={}, headers={'Content-Type': 'application/json'})
    assert r.status_code == 400
    assert 'Nome e email richiesti' in r.get_json().get('error', '')


def test_crea_prenotazione_posto_richiesto(client):
    """POST /api/prenotazioni senza posti -> 400."""
    r = client.post(
        '/api/prenotazioni',
        json={'nome': 'Mario', 'email': 'mario@test.it', 'posto_ids': []},
        headers={'Content-Type': 'application/json'},
    )
    assert r.status_code == 400
    assert 'almeno un posto' in r.get_json().get('error', '').lower()


def test_crea_prenotazione_success(client):
    """POST /api/prenotazioni con dati validi crea prenotazione."""
    # Ottieni un posto id valido
    get_r = client.get('/api/posti')
    posti = get_r.get_json()
    posto_id = next(p['id'] for p in posti if p['stato'] == 'disponibile')

    r = client.post(
        '/api/prenotazioni',
        json={
            'nome': 'Mario Rossi',
            'email': 'mario@test.it',
            'posto_ids': [posto_id],
        },
        headers={'Content-Type': 'application/json'},
    )
    assert r.status_code == 200
    data = r.get_json()
    assert 'prenotazioni' in data
    assert len(data['prenotazioni']) == 1
    assert data['prenotazioni'][0]['nome'] == 'Mario Rossi'
    assert data['prenotazioni'][0]['email'] == 'mario@test.it'
    assert data['prenotazioni'][0]['posto_id'] == posto_id


def test_crea_prenotazione_stesso_posto_occupato(client):
    """Prenotare di nuovo lo stesso posto -> 400."""
    get_r = client.get('/api/posti')
    posti = get_r.get_json()
    posto_id = next(p['id'] for p in posti if p['stato'] == 'disponibile')

    client.post(
        '/api/prenotazioni',
        json={'nome': 'A', 'email': 'a@b.it', 'posto_ids': [posto_id]},
        headers={'Content-Type': 'application/json'},
    )
    r = client.post(
        '/api/prenotazioni',
        json={'nome': 'B', 'email': 'b@b.it', 'posto_ids': [posto_id]},
        headers={'Content-Type': 'application/json'},
    )
    assert r.status_code == 400
    assert 'occupato' in r.get_json().get('error', '').lower() or 'non più disponibile' in r.get_json().get('error', '')


def test_list_prenotazioni(client):
    """GET /api/prenotazioni restituisce le prenotazioni confermate."""
    r = client.get('/api/prenotazioni')
    assert r.status_code == 200
    data = r.get_json()
    assert isinstance(data, list)


def test_cancella_prenotazione(client):
    """DELETE /api/prenotazioni/<id> marca come cancellata."""
    # Crea una prenotazione
    get_r = client.get('/api/posti')
    posto_id = next(p['id'] for p in get_r.get_json() if p['stato'] == 'disponibile')
    crea = client.post(
        '/api/prenotazioni',
        json={'nome': 'X', 'email': 'x@x.it', 'posto_ids': [posto_id]},
        headers={'Content-Type': 'application/json'},
    )
    pren_id = crea.get_json()['prenotazioni'][0]['id']

    r = client.delete(f'/api/prenotazioni/{pren_id}')
    assert r.status_code == 200
    assert r.get_json().get('ok') is True


def test_cancella_prenotazione_404(client):
    """DELETE /api/prenotazioni/99999 -> 404."""
    r = client.delete('/api/prenotazioni/99999')
    assert r.status_code == 404


def test_blocca_posti_session_richiesta(client):
    """POST /api/blocchi senza session_id -> 400."""
    r = client.post(
        '/api/blocchi',
        json={'posto_ids': [1]},
        headers={'Content-Type': 'application/json'},
    )
    assert r.status_code == 400


def test_blocca_posti_success(client):
    """POST /api/blocchi blocca i posti per la session."""
    get_r = client.get('/api/posti')
    posto_id = next(p['id'] for p in get_r.get_json() if p['stato'] == 'disponibile')

    r = client.post(
        '/api/blocchi',
        json={'session_id': 'sess-abc', 'posto_ids': [posto_id]},
        headers={'Content-Type': 'application/json'},
    )
    assert r.status_code == 200
    data = r.get_json()
    assert data.get('ok') is True
    assert posto_id in data.get('bloccati', [])


def test_blocchi_rinnovo(client):
    """PUT /api/blocchi/rinnovo senza body -> 200."""
    r = client.put(
        '/api/blocchi/rinnovo',
        json={'session_id': 's1', 'posto_ids': []},
        headers={'Content-Type': 'application/json'},
    )
    assert r.status_code == 200


def test_blocchi_rilascio(client):
    """DELETE /api/blocchi senza body -> 200."""
    r = client.delete(
        '/api/blocchi',
        json={'session_id': 's1', 'posto_ids': []},
        headers={'Content-Type': 'application/json'},
    )
    assert r.status_code == 200


def test_admin_file_unauthorized(client):
    """GET /api/admin/file senza password -> 401."""
    r = client.get('/api/admin/file')
    assert r.status_code == 401


def test_admin_file_list(client):
    """GET /api/admin/file con password corretta restituisce file e riservate."""
    r = client.get('/api/admin/file', headers={'X-Admin-Password': 'admin123'})
    assert r.status_code == 200
    data = r.get_json()
    assert 'file' in data and 'riservate' in data
    assert isinstance(data['file'], list)
    assert isinstance(data['riservate'], list)


def test_admin_file_put_riservata(client):
    """PUT /api/admin/file/<fila> con password imposta riservato_staff."""
    r = client.put(
        '/api/admin/file/A',
        json={'riservato_staff': True},
        headers={'Content-Type': 'application/json', 'X-Admin-Password': 'admin123'},
    )
    assert r.status_code == 200
    data = r.get_json()
    assert 'aggiornati' in data
    assert data['aggiornati'] >= 0
