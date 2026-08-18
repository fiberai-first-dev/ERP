import { Request, Response } from "express";
import { logisticsService } from "../services/LogisticsService.js";

export class LogisticsController {
  catalog = async (_req: Request, res: Response) => {
    return res.json(await logisticsService.catalog());
  };
}

export const logisticsController = new LogisticsController();
