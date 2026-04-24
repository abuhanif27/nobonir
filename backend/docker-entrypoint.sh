#!/bin/sh
set -e

# Wait for Postgres if configured (docker-compose injects POSTGRES_HOST).
if [ -n "$POSTGRES_HOST" ]; then
    echo "[entrypoint] waiting for postgres at ${POSTGRES_HOST}:${POSTGRES_PORT:-5432}..."
    # Up to ~60s; each nc attempt has its own 1s connect timeout.
    for i in $(seq 1 60); do
        if nc -z "$POSTGRES_HOST" "${POSTGRES_PORT:-5432}" 2>/dev/null; then
            echo "[entrypoint] postgres is reachable."
            break
        fi
        sleep 1
    done
fi

# Apply migrations on every start — harmless if already applied.
echo "[entrypoint] applying migrations..."
python manage.py migrate --noinput

# Collect static files (safe no-op if STATIC_ROOT isn't set/needed at dev time).
python manage.py collectstatic --noinput --clear >/dev/null 2>&1 || true

echo "[entrypoint] starting: $@"
exec "$@"
