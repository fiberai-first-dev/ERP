import { useEffect, useRef } from "react";
import { DomainEvent, realtimeClient } from "@/services/realtime.service";

export function useRealtimeEvents(handler: (event: DomainEvent) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return realtimeClient.subscribe((event) => {
      handlerRef.current(event);
    });
  }, []);
}
