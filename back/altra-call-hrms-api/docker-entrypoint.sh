#!/usr/bin/env sh
set -e

# If code is mounted, vendor might be missing. Keep vendor in a named volume if possible.
if [ ! -d "vendor" ]; then
  echo "[api] vendor/ missing -> composer install"
  composer install --no-interaction --no-progress --prefer-dist --no-scripts
fi

# cache clear (do not fail build/startup if config not ready yet)
php bin/console cache:clear || true

# Run migrations (safe for dev; ignore errors if DB not ready)
php bin/console doctrine:migrations:migrate --no-interaction || true

# Seed default admin (dev)
php bin/console app:seed-admin || true

# Start PHP built-in server for dev
exec php -S 0.0.0.0:8000 -t public
