import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authController } from "../controllers/AuthController.js";
import { inventoryController } from "../controllers/InventoryController.js";
import { orderController } from "../controllers/OrderController.js";
import { channelController } from "../controllers/ChannelController.js";
import { dashboardController } from "../controllers/DashboardController.js";
import { simulationController } from "../controllers/SimulationController.js";
import { logisticsController } from "../controllers/LogisticsController.js";
import { integrationsController } from "../controllers/IntegrationsController.js";
import { webhookRouter } from "../webhooks/index.js";
import { uploadRouter } from "./upload.js";
import { eventsRouter } from "./events.js";

export const apiRouter = Router();

apiRouter.use("/events", eventsRouter);

apiRouter.post("/auth/login", asyncHandler(authController.login));
apiRouter.post("/auth/logout", asyncHandler(authController.logout));

apiRouter.get("/dashboard/summary", asyncHandler(dashboardController.summary));

apiRouter.get("/inventory", asyncHandler(inventoryController.list));
apiRouter.post("/inventory", asyncHandler(inventoryController.create));
apiRouter.put("/inventory/bulk", asyncHandler(inventoryController.bulk));
apiRouter.post("/inventory/push-channels", asyncHandler(inventoryController.pushAll));
apiRouter.put("/inventory/:id", asyncHandler(inventoryController.update));
apiRouter.delete("/inventory/:id", asyncHandler(inventoryController.remove));
apiRouter.post("/inventory/:id/adjust", asyncHandler(inventoryController.adjust));

apiRouter.get("/orders", asyncHandler(orderController.list));
apiRouter.post("/orders", asyncHandler(orderController.create));
apiRouter.put("/orders/:id", asyncHandler(orderController.update));
apiRouter.get("/orders/:id/pickup-slots", asyncHandler(orderController.pickupSlots));
apiRouter.post("/orders/:id/schedule-pickup", asyncHandler(orderController.schedulePickup));

apiRouter.post("/simulation/orders", asyncHandler(simulationController.placeOrder));
apiRouter.get("/simulation/config", asyncHandler(simulationController.config));
apiRouter.get("/simulation/logistics-orders", asyncHandler(simulationController.listLogistics));
apiRouter.post("/simulation/orders/:id/transition", asyncHandler(simulationController.transition));

apiRouter.get("/channels", asyncHandler(channelController.list));
apiRouter.post("/channels/sync-all", asyncHandler(channelController.syncAll));
apiRouter.post("/channels/:channel/connect", asyncHandler(channelController.connect));
apiRouter.post("/channels/:channel/disconnect", asyncHandler(channelController.disconnect));
apiRouter.put("/channels/:channel/fulfillment-type", asyncHandler(channelController.updateFulfillmentType));
apiRouter.put("/channels/:channel/logistics", asyncHandler(channelController.updateFulfillmentType));
apiRouter.post("/channels/:channel/sync", asyncHandler(channelController.sync));

apiRouter.get("/logistics/catalog", asyncHandler(logisticsController.catalog));
apiRouter.get("/integrations/catalog", asyncHandler(integrationsController.catalog));
apiRouter.get(
  "/integrations/channels/:channel/logistics",
  asyncHandler(integrationsController.logisticsForChannel)
);

apiRouter.use("/uploads", uploadRouter);
apiRouter.use("/webhooks", webhookRouter);
