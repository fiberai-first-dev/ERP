#!/usr/bin/env bash
# Install host nginx site files, reload, and issue certs with the VM certbot.
# Run from the repo root after docker compose is already up:
#   sudo ./scripts/enable-nginx.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EMAIL="${ACME_EMAIL:-admin@fybud.com}"
AVAILABLE="/etc/nginx/sites-available"
ENABLED="/etc/nginx/sites-enabled"

cp "$ROOT/nginx/erp-demo.fybud.com.conf" "$AVAILABLE/erp-demo.fybud.com"
cp "$ROOT/nginx/api.erp-demo.fybud.com.conf" "$AVAILABLE/api.erp-demo.fybud.com"
ln -sfn "$AVAILABLE/erp-demo.fybud.com" "$ENABLED/erp-demo.fybud.com"
ln -sfn "$AVAILABLE/api.erp-demo.fybud.com" "$ENABLED/api.erp-demo.fybud.com"

nginx -t
systemctl reload nginx

certbot --nginx \
  -d erp-demo.fybud.com \
  -d api.erp-demo.fybud.com \
  --non-interactive \
  --agree-tos \
  --no-eff-email \
  --redirect \
  -m "$EMAIL"

nginx -t
systemctl reload nginx

echo "Enabled:"
echo "  https://erp-demo.fybud.com"
echo "  https://api.erp-demo.fybud.com/health"
