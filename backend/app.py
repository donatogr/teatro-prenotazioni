from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

db = SQLAlchemy()

def create_app():
    app = Flask(__name__)
    app.config.from_object('config.Config')
    db.init_app(app)
    CORS(app, origins=app.config.get('CORS_ORIGINS', ['http://localhost:5173', 'http://127.0.0.1:5173']), supports_credentials=True)

    with app.app_context():
        import models  # register models with db
        db.create_all()
        from seed import init_seats_if_empty
        init_seats_if_empty()
        from routes import api_bp
        app.register_blueprint(api_bp, url_prefix='/api')

    return app


# Per Gunicorn in produzione
application = create_app()
