import { Request, Response } from "express";
import {
  getChannelCatalog,
  getLogisticsCatalog,
  availableLogisticsFor,
} from "../integrations/index.js";

/**
 * Unified integration catalog for Settings UI (channels + logistics).
 * Credential schemas + capabilities come from plugins — not hardcoded frontend forms.
 */
export class IntegrationsController {
  catalog = async (_req: Request, res: Response) => {
    return res.json({
      channels: getChannelCatalog(),
      logistics: getLogisticsCatalog(),
    });
  };

  logisticsForChannel = async (req: Request, res: Response) => {
    const channel = String(req.params.channel || "").toUpperCase();
    return res.json({
      channel,
      logistics: availableLogisticsFor(channel),
    });
  };
}

export const integrationsController = new IntegrationsController();
