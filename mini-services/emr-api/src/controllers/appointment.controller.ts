import type { Response, Request } from 'express';
import { ok, created } from '../utils/response.js';
import { pageMeta } from '../utils/response.js';
import * as apptService from '../services/appointment.service.js';
import type { AuthedRequest } from '../middlewares/auth.js';

export async function listAppointments(req: Request, res: Response): Promise<void> {
  const q = req.query as unknown as Parameters<typeof apptService.listAppointments>[0];
  const user = (req as AuthedRequest).user;
  const { items, total } = await apptService.listAppointments(q, user);
  ok(res, items, 'Appointments', pageMeta(total, q.page, q.pageSize));
}

export async function getAppointment(req: Request, res: Response): Promise<void> {
  const user = (req as AuthedRequest).user;
  const result = await apptService.getAppointment(String(req.params.id), user);
  ok(res, result, 'Appointment');
}

export async function createAppointment(req: Request, res: Response): Promise<void> {
  const ctx = (req as AuthedRequest).ctx;
  const result = await apptService.createAppointment(req.body, ctx);
  created(res, result, 'Appointment booked');
}

export async function updateAppointment(req: Request, res: Response): Promise<void> {
  const ctx = (req as AuthedRequest).ctx;
  const result = await apptService.updateAppointment(String(req.params.id), req.body, ctx);
  ok(res, result, 'Appointment updated');
}

export async function cancelAppointment(req: Request, res: Response): Promise<void> {
  const ctx = (req as AuthedRequest).ctx;
  const body = (req.body ?? {}) as { cancelReason?: string };
  const result = await apptService.cancelAppointment(String(req.params.id), body.cancelReason, ctx);
  ok(res, result, 'Appointment cancelled');
}

export async function markArrived(req: Request, res: Response): Promise<void> {
  const ctx = (req as AuthedRequest).ctx;
  const result = await apptService.markArrived(String(req.params.id), ctx);
  ok(res, result, 'Patient arrived');
}

export async function markCompleted(req: Request, res: Response): Promise<void> {
  const ctx = (req as AuthedRequest).ctx;
  const result = await apptService.markCompleted(String(req.params.id), ctx);
  ok(res, result, 'Appointment completed');
}
