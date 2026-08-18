import { Request, Response } from "express";
import { orderService } from "../services/OrderService.js";

export class OrderController {
  list = async (_req: Request, res: Response) => {
    return res.json(await orderService.list());
  };

  create = async (req: Request, res: Response) => {
    return res.status(201).json(await orderService.createManual(req.body));
  };

  update = async (req: Request, res: Response) => {
    return res.json(await orderService.update(String(req.params.id), req.body));
  };

  pickupSlots = async (req: Request, res: Response) => {
    return res.json(await orderService.getPickupSlots(String(req.params.id)));
  };

  schedulePickup = async (req: Request, res: Response) => {
    return res.json(await orderService.schedulePickup(String(req.params.id), req.body));
  };
}

export const orderController = new OrderController();
