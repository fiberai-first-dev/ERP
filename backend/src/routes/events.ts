import { Router } from "express";
import { sseHub } from "../events/sseHub.js";

export const eventsRouter = Router();

eventsRouter.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  // Helps some proxies keep the stream open
  res.flushHeaders?.();

  const clientId = sseHub.add(res);

  const keepAlive = setInterval(() => {
    res.write(`: keepalive ${Date.now()}\n\n`);
  }, 15000);
  keepAlive.unref?.();

  req.on("close", () => {
    clearInterval(keepAlive);
    sseHub.remove(clientId);
  });
});
