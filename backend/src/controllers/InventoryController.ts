import { Request, Response } from "express";
import { inventoryService } from "../services/InventoryService.js";

export class InventoryController {
  list = async (_req: Request, res: Response) => {
    return res.json(await inventoryService.list());
  };

  create = async (req: Request, res: Response) => {
    return res.status(201).json(await inventoryService.create(req.body));
  };

  update = async (req: Request, res: Response) => {
    return res.json(await inventoryService.update(String(req.params.id), req.body));
  };

  remove = async (req: Request, res: Response) => {
    await inventoryService.delete(String(req.params.id));
    return res.status(204).send();
  };

  adjust = async (req: Request, res: Response) => {
    return res.json(await inventoryService.adjust(String(req.params.id), Number(req.body?.delta)));
  };

  bulk = async (req: Request, res: Response) => {
    return res.json(await inventoryService.bulkReplace(req.body || []));
  };

  pushAll = async (_req: Request, res: Response) => {
    return res.json(await inventoryService.pushAllToChannels());
  };
}

export const inventoryController = new InventoryController();
