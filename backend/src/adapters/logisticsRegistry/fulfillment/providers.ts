import {
  AdapterShipment,
  ChannelAdapter,
} from "../../salesChannelRegistry/SalesChannelAdapter.js";
import { Order, OrderStatus, ShipmentStatus } from "../../../models/domain.js";
import { shipmentRepository } from "../../../repositories/shipment.repository.js";
import {
  LogisticsCredentials,
  LogisticsPartnerAdapter,
  LogisticsPartnerId,
} from "../types.js";
import { createLogisticsPartner } from "../registry.js";
import { getLogisticsServiceMeta, isLogisticsServiceId } from "../catalog.js";
import {
  isExternalLogisticsProvider,
  isMarketplaceLogisticsProvider,
} from "./fulfillmentTypes.js";
import { logger } from "../../../utils/logger.js";

export interface LogisticsSyncContext {
  logisticsProvider?: LogisticsPartnerId | null;
  logisticsCredentials?: LogisticsCredentials | null;
}

export interface LogisticsSyncResult {
  shipment: AdapterShipment | null;
  suggestedOrderStatus?: OrderStatus;
  deliveredAt?: string;
  shippedAt?: string;
}

export interface LogisticsProvider {
  readonly mode: "MARKETPLACE" | "THIRD_PARTY";
  sync(
    order: Order,
    adapter: ChannelAdapter | null,
    context?: LogisticsSyncContext
  ): Promise<LogisticsSyncResult>;
  recordSimulationAdvance?(
    order: Order,
    targetStatus: OrderStatus,
    logisticsProvider?: LogisticsPartnerId | null
  ): Promise<AdapterShipment>;
}

function shipmentStatusForOrder(target: OrderStatus): ShipmentStatus {
  if (target === "DELIVERED") return "DELIVERED";
  if (target === "DELIVERY_FAILED") return "RTO";
  if (target === "PICKED_UP") return "PICKED_UP";
  if (target === "PICKUP_SCHEDULED" || target === "SHIPMENT_CREATED") return "READY_FOR_PICKUP";
  if (target === "IN_TRANSIT" || target === "OUT_FOR_DELIVERY") return "IN_TRANSIT";
  if (target === "CANCELLED") return "CANCELLED";
  if (target === "PACKED") return "LABEL_CREATED";
  return "PENDING";
}

function suggestedFromShipment(order: Order, status: ShipmentStatus): OrderStatus | undefined {
  if (status === "DELIVERED" && order.status !== "DELIVERED") return "DELIVERED";
  if (status === "RTO" && order.status !== "DELIVERY_FAILED") return "DELIVERY_FAILED";
  if (
    status === "IN_TRANSIT" &&
    ["PICKUP_SCHEDULED", "PICKED_UP", "SHIPMENT_CREATED"].includes(order.status)
  ) {
    return "IN_TRANSIT";
  }
  if (status === "PICKED_UP" && ["PICKUP_SCHEDULED", "SHIPMENT_CREATED"].includes(order.status)) {
    return "PICKED_UP";
  }
  return undefined;
}

export class MarketplaceLogisticsProvider implements LogisticsProvider {
  readonly mode = "MARKETPLACE" as const;

  async sync(order: Order, adapter: ChannelAdapter | null): Promise<LogisticsSyncResult> {
    if (!adapter) return { shipment: null };
    const shipment = await adapter.getShipment(order.channelOrderId);
    if (!shipment) return { shipment: null };
    return {
      shipment,
      suggestedOrderStatus: suggestedFromShipment(order, shipment.status),
      deliveredAt: shipment.deliveredAt,
      shippedAt: shipment.shippedAt,
    };
  }
}

export class ThirdPartyLogisticsProvider implements LogisticsProvider {
  readonly mode = "THIRD_PARTY" as const;

  async sync(
    order: Order,
    _adapter: ChannelAdapter | null,
    context?: LogisticsSyncContext
  ): Promise<LogisticsSyncResult> {
    const locals = await shipmentRepository.findByOrderId(order.id);
    const local = locals[0];
    if (!local) return { shipment: null };

    let status = local.status;
    let carrier = local.carrier || context?.logisticsProvider || "3PL";
    let trackingNumber = local.trackingNumber || undefined;
    let shippedAt = local.shippedAt || undefined;
    let deliveredAt = local.deliveredAt || undefined;
    let metadata: Record<string, unknown> = {
      ...(local.metadata || {}),
      source: "THIRD_PARTY",
      logisticsProvider: context?.logisticsProvider || null,
    };

    if (
      trackingNumber &&
      context?.logisticsProvider &&
      isLogisticsServiceId(context.logisticsProvider)
    ) {
      try {
        const meta = getLogisticsServiceMeta(context.logisticsProvider);
        if (meta.kind === "EXTERNAL" || meta.kind === "MARKETPLACE") {
          const partner = createLogisticsPartner(context.logisticsProvider);
          await partner.connect(context.logisticsCredentials || {});
          const tracked = await partner.track(trackingNumber);
          if (tracked) {
            status = tracked.status;
            carrier = tracked.carrier || context.logisticsProvider;
            trackingNumber = tracked.trackingNumber;
            shippedAt = tracked.shippedAt || shippedAt;
            deliveredAt = tracked.deliveredAt || deliveredAt;
            metadata = {
              ...metadata,
              ...(tracked.metadata || {}),
              rawStatus: tracked.rawStatus,
            };
          }
        }
      } catch (error) {
        logger.warn(
          { orderId: order.id, partner: context.logisticsProvider, err: error },
          "3PL tracking sync failed"
        );
      }
    }

    const shipment: AdapterShipment = {
      channelShipmentId: local.channelShipmentId || `3PL-${order.id.slice(0, 8)}`,
      channelOrderId: order.channelOrderId,
      status,
      fulfillmentType: local.fulfillmentType || context?.logisticsProvider || undefined,
      carrier,
      trackingNumber,
      metadata,
      shippedAt,
      deliveredAt,
    };

    return {
      shipment,
      suggestedOrderStatus: suggestedFromShipment(order, status),
      deliveredAt,
      shippedAt,
    };
  }

  async recordSimulationAdvance(
    order: Order,
    targetStatus: OrderStatus,
    logisticsProvider?: LogisticsPartnerId | null
  ): Promise<AdapterShipment> {
    const status = shipmentStatusForOrder(targetStatus);
    const now = new Date().toISOString();
    const partner =
      logisticsProvider && isLogisticsServiceId(logisticsProvider)
        ? getLogisticsServiceMeta(logisticsProvider).kind === "EXTERNAL"
          ? logisticsProvider
          : "MANUAL_COURIER"
        : "MANUAL_COURIER";
    const trackingNumber =
      status === "IN_TRANSIT" ||
      status === "DELIVERED" ||
      status === "RTO" ||
      status === "PICKED_UP" ||
      status === "READY_FOR_PICKUP"
        ? `${partner.slice(0, 3)}-${order.channelOrderId}`.replace(/[^A-Za-z0-9-]/g, "").slice(0, 32)
        : null;

    if (trackingNumber) {
      try {
        const adapter = createLogisticsPartner(partner);
        await adapter.connect({});
        if (adapter.simulateAdvance) {
          await adapter.simulateAdvance(trackingNumber, status);
        }
      } catch (error) {
        logger.warn({ err: error, partner }, "Failed to push 3PL simulation tracking update");
      }
    }

    const saved = await shipmentRepository.upsertForOrder({
      orderId: order.id,
      channelShipmentId: `3PL-${order.id}`,
      status,
      fulfillmentType: partner,
      carrier: partner,
      trackingNumber,
      metadata: {
        source: "SIMULATOR",
        logisticsMode: "THIRD_PARTY",
        logisticsProvider: partner,
      },
      shippedAt:
        status === "IN_TRANSIT" || status === "DELIVERED" || status === "RTO" ? now : null,
      deliveredAt: status === "DELIVERED" || status === "RTO" ? now : null,
    });

    return {
      channelShipmentId: saved.channelShipmentId || `3PL-${order.id}`,
      channelOrderId: order.channelOrderId,
      status: saved.status,
      fulfillmentType: saved.fulfillmentType || partner,
      carrier: saved.carrier || partner,
      trackingNumber: saved.trackingNumber || undefined,
      metadata: saved.metadata,
      shippedAt: saved.shippedAt || undefined,
      deliveredAt: saved.deliveredAt || undefined,
    };
  }
}

const marketplaceProvider = new MarketplaceLogisticsProvider();
const thirdPartyProvider = new ThirdPartyLogisticsProvider();

export function resolveLogisticsProvider(logisticsProvider?: string | null): LogisticsProvider {
  return isExternalLogisticsProvider(logisticsProvider)
    ? thirdPartyProvider
    : marketplaceProvider;
}

export type { LogisticsPartnerAdapter };
