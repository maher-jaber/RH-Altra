#!/usr/bin/env sh
set -e

# In dev, the code is bind-mounted, while vendor/ lives in a named volume.
# That volume can become stale (e.g. when composer.json changes). To avoid
# hard-to-debug "class not found" errors, we run composer install on startup.
echo "[api] composer install (ensure vendor is up-to-date)"

# Install deps (vendor lives in a named volume in dev)
composer install --no-interaction --no-progress --prefer-dist

# cache clear (do not fail build/startup if config not ready yet)
php bin/console cache:clear || true

# Ensure the database exists (named volume can be reused, DB may be missing)
# Safe to run repeatedly.
php bin/console doctrine:database:create --if-not-exists >/dev/null 2>&1 || true

# --- Wait for DB to be reachable ---
# Even with docker-compose healthchecks, the DB can be reachable but still
# refuse connections for a brief moment. Also, this prevents us from silently
# skipping migrations (which would later cause 500s on many endpoints).
echo "[api] waiting for database..."
i=0
until php bin/console doctrine:query:sql "SELECT 1" >/dev/null 2>&1; do
  i=$((i+1))
  if [ $((i % 10)) -eq 0 ]; then
    echo "[api] still waiting for database... (try $i/60)"
  fi
  if [ $i -ge 60 ]; then
    echo "[api] database not reachable after waiting, exiting." >&2
    exit 1
  fi
  sleep 2
done
echo "[api] database reachable."

# Run migrations (dev-friendly: make migrations idempotent; fail fast on real errors)
php bin/console doctrine:migrations:migrate --no-interaction || (echo "[api] migrations failed" >&2; exit 1)

# Seed default admin (dev)
php bin/console app:seed-admin || true

# Seed holidays (dev)
php bin/console app:seed-holidays || true

# Start PHP built-in server for dev
exec php -S 0.0.0.0:8000 -t public
