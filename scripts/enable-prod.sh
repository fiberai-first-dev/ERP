#!/usr/bin/env bash
# One command: start production, create Let's Encrypt certs, enable HTTPS.
# From the repo root on the production server:
#   ./scripts/enable-prod.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
EMAIL="${ACME_EMAIL:-admin@fybud.com}"
CERT_DIR="erp-demo.fybud.com"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example to .env and set production secrets first."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a
EMAIL="${ACME_EMAIL:-$EMAIL}"

echo "==> Placeholder certificates (nginx needs them before Let's Encrypt)"
"${COMPOSE[@]}" run --rm --no-deps --entrypoint sh nginx -c "
  set -e
  apk add --no-cache openssl >/dev/null
  live=/etc/letsencrypt/live/${CERT_DIR}
  mkdir -p \"\$live\" /var/www/certbot
  if [ ! -s \"\$live/fullchain.pem\" ] || [ ! -s \"\$live/privkey.pem\" ]; then
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
      -keyout \"\$live/privkey.pem\" \
      -out \"\$live/fullchain.pem\" \
      -subj \"/CN=erp-demo.fybud.com\"
  fi
"

echo "==> Building and starting stack"
"${COMPOSE[@]}" up -d --build

echo "==> Waiting for nginx"
for _ in $(seq 1 40); do
  if "${COMPOSE[@]}" exec -T nginx nginx -t >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Removing placeholder certs if they are not Let's Encrypt"
"${COMPOSE[@]}" exec -T nginx sh -c "
  apk add --no-cache openssl >/dev/null
  pem=/etc/letsencrypt/live/${CERT_DIR}/fullchain.pem
  if [ -f \"\$pem\" ] && ! openssl x509 -in \"\$pem\" -noout -issuer 2>/dev/null | grep -qi \"Let's Encrypt\"; then
    rm -rf /etc/letsencrypt/live/${CERT_DIR} /etc/letsencrypt/archive/${CERT_DIR} /etc/letsencrypt/renewal/${CERT_DIR}.conf || true
  fi
"

echo "==> Requesting Let's Encrypt certificates for erp-demo.fybud.com and api.erp-demo.fybud.com"
"${COMPOSE[@]}" run --rm --entrypoint certbot certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive \
  --cert-name "$CERT_DIR" \
  -d erp-demo.fybud.com \
  -d api.erp-demo.fybud.com

echo "==> Reloading nginx with real certificates"
"${COMPOSE[@]}" exec -T nginx nginx -t
"${COMPOSE[@]}" exec -T nginx nginx -s reload

echo
echo "Enabled:"
echo "  https://erp-demo.fybud.com"
echo "  https://api.erp-demo.fybud.com/health"
echo
echo "Certificates renew automatically every 12 hours."
