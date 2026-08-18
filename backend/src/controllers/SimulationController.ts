import { Request, Response } from "express";
import { simulationService } from "../services/SimulationService.js";

export class SimulationController {
  config = async (_req: Request, res: Response) => {
    return res.json(simulationService.getConfig());
  };

  listLogistics = async (req: Request, res: Response) => {
    const channel = typeof req.query.channel === "string" ? req.query.channel : undefined;
    return res.json(await simulationService.listLogisticsOrders(channel));
  };

  placeOrder = async (req: Request, res: Response) => {
    return res.status(201).json(await simulationService.placeOrder(req.body));
  };

  transition = async (req: Request, res: Response) => {
    return res.json(await simulationService.transition(String(req.params.id), req.body));
  };
}

export const simulationController = new SimulationController();
