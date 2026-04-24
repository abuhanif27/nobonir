# Django backend image
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps for psycopg (Postgres), Pillow, reportlab/svglib, healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
        libjpeg-dev \
        zlib1g-dev \
        libfreetype6-dev \
        curl \
        netcat-openbsd \
        dos2unix \
    && rm -rf /var/lib/apt/lists/*

# Python deps first for better layer caching
COPY requirements.txt /app/
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy full project (everything — no .dockerignore so env/media/sqlite all ship)
COPY . /app/

# Normalize line endings and mark entrypoint executable
RUN dos2unix /app/docker-entrypoint.sh 2>/dev/null || true \
    && chmod +x /app/docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
