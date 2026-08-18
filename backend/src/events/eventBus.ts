import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { DomainEvent, REDIS_EVENTS_CHANNEL } from "./types.js";

const require = createRequire(import.meta.url);
// ioredis is CJS; NodeNext named/default imports don't construct cleanly.
const Redis = require("ioredis") as {
  new (
    url: string,
    options?: {
      maxRetriesPerRequest?: number;
      enableReadyCheck?: boolean;
      lazyConnect?: boolean;
    }
  ): RedisClient;
};

interface RedisClient {
  status: string;
  connect(): Promise<void>;
  quit(): Promise<"OK">;
  disconnect(): void;
  publish(channel: string, message: string): Promise<number>;
  subscribe(...channels: string[]): Promise<number>;
  on(event: "error", listener: (err: Error) => void): void;
  on(event: "message", listener: (channel: string, message: string) => void): void;
}

type EventHandler = (event: DomainEvent) => void;

/**
 * Redis Pub/Sub event bus with in-process fallback.
 * Publishers never write directly to SSE clients — the SSE hub listens here.
 */
class EventBus {
  private readonly local = new EventEmitter();
  private pub: RedisClient | null = null;
  private sub: RedisClient | null = null;
  private ready = false;

  async start() {
    if (this.ready) return;

    try {
      this.pub = new Redis(env.redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        lazyConnect: true,
      });
      this.sub = new Redis(env.redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        lazyConnect: true,
      });

      this.pub.on("error", (err) => logger.warn({ err }, "Redis publisher error"));
      this.sub.on("error", (err) => logger.warn({ err }, "Redis subscriber error"));

      await this.pub.connect();
      await this.sub.connect();

      this.sub.on("message", (_channel, message) => {
        try {
          const event = JSON.parse(message) as DomainEvent;
          this.local.emit("event", event);
        } catch (err) {
          logger.warn({ err, message }, "Failed to parse domain event");
        }
      });

      await this.sub.subscribe(REDIS_EVENTS_CHANNEL);
      this.ready = true;
      logger.info({ redisUrl: env.redisUrl.replace(/\/\/.*@/, "//***@") }, "Event bus connected to Redis");
    } catch (err) {
      logger.warn({ err }, "Redis unavailable — using in-process event bus fallback");
      await this.teardownRedis();
      this.ready = true;
    }
  }

  async publish(event: DomainEvent) {
    if (!this.ready) await this.start();

    if (this.pub) {
      try {
        await this.pub.publish(REDIS_EVENTS_CHANNEL, JSON.stringify(event));
        return;
      } catch (err) {
        logger.warn({ err, type: event.type }, "Redis publish failed — falling back locally");
      }
    }

    this.local.emit("event", event);
  }

  subscribe(handler: EventHandler) {
    this.local.on("event", handler);
    return () => this.local.off("event", handler);
  }

  isRedisConnected() {
    return Boolean(this.pub?.status === "ready" && this.sub?.status === "ready");
  }

  private async teardownRedis() {
    try {
      await this.sub?.quit();
    } catch {
      this.sub?.disconnect();
    }
    try {
      await this.pub?.quit();
    } catch {
      this.pub?.disconnect();
    }
    this.pub = null;
    this.sub = null;
  }
}

export const eventBus = new EventBus();

export async function publishEvent(
  event: Omit<DomainEvent, "at"> & { at?: string }
): Promise<DomainEvent> {
  const full = {
    ...event,
    at: event.at || new Date().toISOString(),
  } as DomainEvent;
  await eventBus.publish(full);
  return full;
}
