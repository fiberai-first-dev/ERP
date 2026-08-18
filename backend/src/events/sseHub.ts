import type { Response } from "express";
import { eventBus } from "./eventBus.js";
import { DomainEvent } from "./types.js";
import { logger } from "../utils/logger.js";

interface SseClient {
  id: string;
  res: Response;
}

class SseHub {
  private clients = new Map<string, SseClient>();
  private started = false;

  start() {
    if (this.started) return;
    this.started = true;
    eventBus.subscribe((event) => this.broadcast(event));
    logger.info("SSE hub started");
  }

  add(res: Response) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    this.clients.set(id, { id, res });

    res.write(`event: connected\ndata: ${JSON.stringify({ id, at: new Date().toISOString() })}\n\n`);
    logger.debug({ clientId: id, total: this.clients.size }, "SSE client connected");

    return id;
  }

  remove(id: string) {
    this.clients.delete(id);
  }

  broadcast(event: DomainEvent) {
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients.values()) {
      try {
        client.res.write(payload);
      } catch {
        this.remove(client.id);
      }
    }
  }

  clientCount() {
    return this.clients.size;
  }
}

export const sseHub = new SseHub();
