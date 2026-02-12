"""Configurazione pytest: app Flask con DB in-memory."""
import os
import sys

# Usa DB in-memory per i test (va impostato prima di importare l'app)
os.environ['TESTING'] = '1'
if 'DATABASE_URL' not in os.environ:
    os.environ['DATABASE_URL'] = 'sqlite:///:memory:'

# Assicura che backend sia nel path quando si lancia pytest dalla root
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pytest
from app import create_app, db


@pytest.fixture
def app():
    app = create_app()
    app.config['TESTING'] = True
    return app


@pytest.fixture
def client(app):
    return app.test_client()
