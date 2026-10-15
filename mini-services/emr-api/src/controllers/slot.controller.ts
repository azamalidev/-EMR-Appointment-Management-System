import type { Response, Request } from 'express';
import { ok } from '../utils/response.js';
import * as slotService from '../services/slot.service.js';

export async function getSlots(req: Request, res: Response): Promise<void> {
  const q = req.query as unknown as { doctorId: string; date: string };
  const result = await slotService.getSlots(q.doctorId, q.date);
  ok(res, result, 'Slots');
}
