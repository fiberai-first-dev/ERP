# Integrations (Plug-and-Play)

Sales channels and logistics providers are **plugins**. Core order, inventory, and fulfillment engines must depend only on:

- `integrations/channels/core` → `SalesChannelAdapter`
- `integrations/logistics/core` → `LogisticsAdapter`

Never write `if (channel === "SHOPIFY")` / `if (provider === "DELHIVERY")` in core services. Use the registry + capabilities instead.

```text
API / Domain
     |
     +-- channelRegistry.get(id)
     |        |
     |        v
     |   SalesChannelAdapter
     |
     +-- logisticsRegistry.get(id)
              |
              v
         LogisticsAdapter
```

Channel × logistics are **independent**. Configuration binds them (e.g. Shopify → Delhivery). Compatibility is declared on logistics via `supportedChannels`.

---

## Layout

```text
integrations/
├── channels/
│   ├── core/           # adapter interface, types, capabilities, errors
│   ├── registry.ts     # channelRegistry
│   ├── catalog.ts      # Settings UI catalog
│   ├── providers/      # plugin definitions (map to implementations)
│   └── index.ts
├── logistics/
│   ├── core/
│   ├── registry.ts
│   ├── catalog.ts
│   ├── providers/      # auto-maps legacy logisticsRegistry plugins
│   └── index.ts
└── index.ts            # boot both registries
```

Phase 1 keeps provider **implementations** under `adapters/salesChannelRegistry/*` and `adapters/logisticsRegistry/*`. Canonical contracts + registries live here; `Legacy*Bridge` wraps existing adapters.

Phase 2 moves implementation folders into `integrations/*/providers/<name>/` and deletes bridges.

---

## Add a sales channel

1. Implement `SalesChannelAdapter` (or a legacy `ChannelAdapter` + `legacyFactory`).
2. Add a `ChannelPlugin` in `channels/providers/index.ts` with `definition` (capabilities + credentialSchema).
3. Append it to `channelProviderPlugins`.
4. Do **not** change order/inventory/fulfillment engines.

```ts
channelRegistry.get("MEESHO");
```

## Add a logistics provider

1. Create `adapters/logisticsRegistry/<name>/` plugin (current) **or** a canonical `LogisticsAdapter`.
2. Register it in the legacy logistics plugin list (Phase 1 auto-maps into `logisticsRegistry`).
3. Declare `supportedChannels` and `capabilities` / `credentialSchema` on meta.
4. Do **not** change `FulfillmentService` for provider-specific branches.

```ts
logisticsRegistry.get("FED_EX");
logisticsRegistry.assertCompatible("FED_EX", "SHOPIFY");
```

---

## Capabilities (not provider names)

**Channel:** `inventory`, `orders`, `fulfillment`, `tracking`, `webhooks`, `notifySelfShip`, …

**Logistics:** `createShipment`, `generateLabel`, `schedulePickup`, `pickupSlots`, `tracking`, `cancelShipment`

Settings UI should render from:

- `getChannelCatalog()`
- `getLogisticsCatalog()` / `availableLogisticsFor(channelId)`

---

## Boot

```ts
import "./integrations/index.js";
```

Already wired from `server.ts`.
