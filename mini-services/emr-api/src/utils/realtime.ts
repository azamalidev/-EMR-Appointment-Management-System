import type { Server } from 'socket.io';

let io: Server | null = null;

export function setIO(server: Server): void {
  io = server;
}

export function getIO(): Server | null {
  return io;
}

/**
 * Broadcast an event globally, or to a specific room if provided.
 * Safe to call from services even before io is set (no-op in that case).
 */
export function broadcast(event: string, payload: unknown, room?: string): void {
  if (!io) return;
  try {
    if (room) {
      io.to(room).emit(event, payload);
    } else {
      io.emit(event, payload);
    }
  } catch (e) {
    console.warn('[realtime] broadcast error', e);
  }
}
