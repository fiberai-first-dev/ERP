import { Request, Response } from "express";
import { dashboardService } from "../services/DashboardService.js";

export class DashboardController {
  summary = async (_req: Request, res: Response) => {
    return res.json(await dashboardService.summary());
  };
}

export const dashboardController = new DashboardController();
