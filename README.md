# ERM — Ecommerce Resource Manager

Unified commerce operations for vendors: manage orders and inventory across Amazon, Flipkart, and Shopify from one place.

## Stack
- **Frontend**: React (Vite) + React Router — `frontend/`
- **Backend**: TypeScript Express modular monolith — `backend/`
- **Database**: PostgreSQL 16

## Quick start (Docker)

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:4000/health
- Login password: `12345` (or `ADMIN_PASSWORD` env)

## Local development

```bash
docker compose up db -d
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
