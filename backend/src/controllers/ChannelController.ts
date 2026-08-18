import { Request, Response } from "express";
import { channelService } from "../services/ChannelService.js";

export class ChannelController {
  list = async (_req: Request, res: Response) => {
    return res.json(await channelService.listPublic());
  };

  connect = async (req: Request, res: Response) => {
    return res.json(await channelService.connect(String(req.params.channel), req.body));
  };

  disconnect = async (req: Request, res: Response) => {
    return res.json(await channelService.disconnect(String(req.params.channel)));
  };

  sync = async (req: Request, res: Response) => {
    return res.json(await channelService.sync(String(req.params.channel)));
  };

  syncAll = async (_req: Request, res: Response) => {
    return res.json(await channelService.syncAll());
  };

  updateFulfillmentType = async (req: Request, res: Response) => {
    return res.json(
      await channelService.updateFulfillmentType(String(req.params.channel), req.body)
    );
  };
}

export const channelController = new ChannelController();
