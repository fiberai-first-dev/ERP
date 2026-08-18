import cron from "node-cron";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { checkDb } from "./config/db.js";
import { runMigrations } from "./config/migrate.js";
import { seed } from "./config/seed.js";
import { logger } from "./utils/logger.js";
import { syncAllOrders } from "./jobs/syncOrders.js";
import { syncInventoryToChannels } from "./jobs/syncInventory.js";
import { syncShipments } from "./jobs/syncShipments.js";
import { eventBus } from "./events/eventBus.js";
import { sseHub } from "./events/sseHub.js";
// Canonical plug-and-play registries (channels + logistics)
import "./integrations/index.js";

async function bootstrap() {
  await checkDb();
  await runMigrations();
  await seed();
  await eventBus.start();
  sseHub.start();

  const app = createApp();
  app.listen(env.port, () => {
    logger.info(
      { redis: eventBus.isRedisConnected(), sseClients: sseHub.clientCount() },
      `API listening on :${env.port}`
    );
  });

  if (cron.validate(env.syncCron)) {
    cron.schedule(env.syncCron, async () => {
      logger.info("Running scheduled sync jobs");
      await syncAllOrders();
      await syncInventoryToChannels();
      await syncShipments();
    });
  }
}

bootstrap().catch((err) => {
  logger.error(err, "Failed to start server");
  process.exit(1);
});
