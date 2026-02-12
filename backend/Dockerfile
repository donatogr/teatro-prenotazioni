FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY . .

EXPOSE 5000

# Crea DB e posti al primo avvio (gestito in app.create_app)
CMD ["gunicorn", "-b", "0.0.0.0:5000", "-w", "2", "app:application", "--timeout", "120"]
