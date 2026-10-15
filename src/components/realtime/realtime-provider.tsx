"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Connects to the Socket.IO realtime mini-service and translates inbound
 * appointment/schedule events into React Query cache invalidations. This means
 * every open view (scheduler, appointments list, dashboard) re-fetches its
 * slice of data the instant something changes server-side — no manual refresh,
 * no per-view socket wiring.
 *
 * Connection: io("/?XTransformPort=3003") so Caddy forwards to the mini-service.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Local dev: connect directly to the Express backend.
    // Sandbox: route through the Caddy gateway with ?XTransformPort=4000.
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
    const socket = backendUrl
      ? io(backendUrl, {
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: Infinity,
        })
      : io("/?XTransformPort=4000", {
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: Infinity,
        });
    socketRef.current = socket;

    const invalidate = (keys: string[][]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));

    const onAppt = () =>
      invalidate([
        ["slots"],
        ["appointments"],
        ["dashboard"],
        ["appointment"],
      ]);

    socket.on("connect", () => console.info("[rt] connected", socket.id));
    socket.on("disconnect", (r) => console.info("[rt] disconnected", r));
    socket.on("appointment:created", onAppt);
    socket.on("appointment:updated", onAppt);
    socket.on("appointment:cancelled", onAppt);
    socket.on("appointment:arrived", onAppt);
    socket.on("appointment:completed", onAppt);
    socket.on("schedule:updated", () => invalidate([["slots"], ["doctors"], ["schedules"]]));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [qc]);

  return <>{children}</>;
}
