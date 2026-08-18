# ERM — Ecommerce Resource Manager

Unified commerce operations for vendors: manage orders and inventory across Amazon, Flipkart, and Shopify from one place.

## Stack
- **Frontend**: React (Vite) + React Router — `frontend/`
- **Backend**: TypeScript Express modular monolith — `backend/`
- **Database**: PostgreSQL 16
- **Cache / events**: Redis 7

## Domains

| Service | Production | Local Docker |
| --- | --- | --- |
| Frontend | https://erp-demo.fybud.com | http://localhost:3000 |
| Backend | https://api.erp-demo.fybud.com | http://localhost:4000 |

## Quick start (local Docker)

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:4000/health
- Login password: `ADMIN_PASSWORD` in `.env` (default `12345`)

## Production

1. Point DNS A records for `erp-demo.fybud.com` and `api.erp-demo.fybud.com` at the server.
2. Copy env and set secrets:

```bash
cp .env.example .env
```

Set at least:

```env
NODE_ENV=production
ADMIN_PASSWORD=...
ENCRYPTION_KEY=...          # long random string
POSTGRES_PASSWORD=...
CORS_ORIGIN=https://erp-demo.fybud.com
VITE_API_BASE_URL=https://api.erp-demo.fybud.com
FRONTEND_HOST=erp-demo.fybud.com
BACKEND_HOST=api.erp-demo.fybud.com
ACME_EMAIL=admin@fybud.com
```

3. Start with TLS (Caddy):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Caddy issues Let's Encrypt certificates for both hosts. Ports 80 and 443 must be open. Postgres and Redis stay private to the compose network.

Rebuild the frontend after changing `VITE_API_BASE_URL` (`docker compose ... up -d --build frontend`).

## Local development (without Docker frontend/backend)

```bash
docker compose up db redis -d
cd backend && cp .env.example .env && npm install && npm run dev
cd frontend && npm install && npm run dev
```

Vite proxies `/api` to `http://localhost:4000`.

## Channel architecture

```
Frontend → Backend API → Core Services → ChannelManager → ChannelAdapter
                                              ├── AmazonAdapter
                                              ├── FlipkartAdapter
                                              └── ShopifyAdapter
```

Credentials are entered in Settings, encrypted, and stored only in `channels_config`.

## Pages
- Dashboard — order pipeline, low stock, channel health
- Orders — multi-channel board (Awaiting Packaging → Delivered / RTO)
- Inventory — master catalog with images; quantity syncs to connected channels
- Settings — connect/disconnect channels with only the credentials each platform requires
