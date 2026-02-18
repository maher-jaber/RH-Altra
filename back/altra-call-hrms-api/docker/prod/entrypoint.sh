#!/usr/bin/env sh
set -eu

echo "[api] Starting (prod) ..."

# Ensure writable var/ and uploads/ volumes (Docker named volumes default to root)
mkdir -p /app/var/cache /app/var/log /app/public/uploads
chown -R www-data:www-data /app/var /app/public/uploads 2>/dev/null || true
chmod -R ug+rwX /app/var /app/public/uploads 2>/dev/null || true


# Run migrations with retries (db might still be starting even after healthcheck)
i=0
until php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration; do
  i=$((i+1))
  if [ "$i" -ge 20 ]; then
    echo "[api] ERROR: migrations failed after ${i} tries"
    exit 1
  fi
  echo "[api] Migrations failed (try ${i}/20). Waiting 3s..."
  sleep 3
done

# Ensure a default admin user exists (email/password visible in container logs once).
php bin/console app:seed-admin || true

# Seed default holidays for the current year (Tunisia fixed-date holidays).
# Movable Islamic holidays can be added/edited from the UI settings.
php bin/console app:seed-holidays || true

# Optional cache warmup (ignore if it fails; app can still run)
php bin/console cache:clear --env=prod || true

echo "[api] Ready - launching php-fpm"
exec php-fpm -F
