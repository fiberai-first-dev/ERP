import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { channelRepository } from "../repositories/channel.repository.js";
import { orderService } from "../services/OrderService.js";
import { createAdapter } from "../adapters/salesChannelRegistry/index.js";
import { decryptJson } from "../utils/crypto.js";
import { ChannelType } from "../models/domain.js";
import { query } from "../config/db.js";
import { logger } from "../utils/logger.js";
import { AmazonClient } from "../adapters/salesChannelRegistry/amazon/amazonClient.js";
import { FlipkartClient } from "../adapters/salesChannelRegistry/flipkart/flipkartClient.js";
import { ShopifyClient } from "../adapters/salesChannelRegistry/shopify/shopifyClient.js";
import { AppError } from "../middleware/errorHandler.js";

export const webhookRouter = Router();

webhookRouter.post(
  "/:channel",
  asyncHandler(async (req, res) => {
    const channel = String(req.params.channel).toUpperCase() as ChannelType;
    const eventKey = String(req.headers["x-event-id"] || req.body?.eventId || `${channel}-${Date.now()}`);
    const config = await channelRepository.findByChannel(channel);
    if (!config || config.status !== "CONNECTED" || !config.credentialsEncrypted) {
      throw new AppError("Channel not connected", 400);
    }

    const inserted = await query(
      `INSERT INTO channel_sync_events (channel_config_id, event_key, event_type, payload)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (channel_config_id, event_key) DO NOTHING
       RETURNING id`,
      [config.id, eventKey, req.body?.type || "notification", JSON.stringify(req.body || {})]
    );

    if (!inserted.rowCount) {
      return res.json({ ok: true, duplicate: true });
    }

    // When MOCK_CHANNELS=true, stash webhook order payloads into empty in-memory stubs (no demo seed).
    if (channel === "AMAZON" && req.body?.order) {
      AmazonClient.injectOrder(req.body.order);
    }
    if (channel === "FLIPKART" && req.body?.order) {
      FlipkartClient.injectOrder(req.body.order);
    }
    if (channel === "SHOPIFY" && req.body?.order) {
      ShopifyClient.injectOrder(req.body.order);
    }

    const credentials = decryptJson(config.credentialsEncrypted);
    const adapter = createAdapter(channel, credentials);
    await adapter.connect(credentials);

    const channelOrderId = String(
      req.body?.channelOrderId ||
        req.body?.order?.AmazonOrderId ||
        req.body?.order?.orderId ||
        req.body?.order?.id ||
        ""
    );

    if (channelOrderId) {
      const order = await adapter.getOrder(channelOrderId);
      if (order) {
        await orderService.ingestAdapterOrder(config.id, channel, order);
      }
    }

    logger.info({ channel, eventKey }, "Webhook processed");
    return res.json({ ok: true });
  })
);
