"""Test modelli (serializzazione)."""
import os
import sys

os.environ['TESTING'] = '1'
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from app import create_app
from models import Prenotazione


def test_prenotazione_to_dict():
    app = create_app()
    with app.app_context():
        # Crea prenotazione in memoria (senza flush per evitare vincoli)
        p = Prenotazione(
            id=999,
            posto_id=1,
            nome='Test',
            email='test@test.it',
            timestamp=datetime(2025, 1, 15, 12, 0, 0),
            stato='confermata',
        )
        d = p.to_dict()
        assert d['id'] == 999
        assert d['posto_id'] == 1
        assert d['nome'] == 'Test'
        assert d['email'] == 'test@test.it'
        assert '2025-01-15' in (d['timestamp'] or '')
        assert d['stato'] == 'confermata'
