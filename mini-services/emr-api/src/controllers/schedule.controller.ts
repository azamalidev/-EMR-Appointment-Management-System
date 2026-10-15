import type { Response, Request } from 'express';
import { ok, created } from '../utils/response.js';
import * as doctorService from '../services/doctor.service.js';
import type { AuthedRequest } from '../middlewares/auth.js';

export async function listSchedules(req: Request, res: Response): Promise<void> {
  const result = await doctorService.listSchedules(String(req.params.id));
  ok(res, result, 'Schedules');
}

export async function upsertSchedule(req: Request, res: Response): Promise<void> {
  const ctx = (req as AuthedRequest).ctx;
  const result = await doctorService.upsertSchedule(String(req.params.id), req.body, ctx);
  ok(res, result, 'Schedule saved');
}

export async function deleteSchedule(req: Request, res: Response): Promise<void> {
  const ctx = (req as AuthedRequest).ctx;
  const dayOfWeek = (req.query.dayOfWeek as string) || '';
  await doctorService.deleteSchedule(String(req.params.id), dayOfWeek, ctx);
  ok(res, null, 'Schedule deleted');
}
