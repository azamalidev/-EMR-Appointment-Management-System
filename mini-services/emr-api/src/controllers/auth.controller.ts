import type { Response, Request } from 'express';
import { ok, created } from '../utils/response.js';
import * as authService from '../services/auth.service.js';
import type { AuthedRequest } from '../middlewares/auth.js';

export async function login(req: Request, res: Response): Promise<void> {
  const body = req.body as { email: string; password: string };
  const ctx = (req as AuthedRequest).ctx;
  const result = await authService.login(body, ctx);
  ok(res, result, 'Login successful');
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const body = req.body as { refreshToken: string };
  const ctx = (req as AuthedRequest).ctx;
  const result = await authService.refresh(body.refreshToken, ctx);
  ok(res, result, 'Token refreshed');
}

export async function logout(req: Request, res: Response): Promise<void> {
  const body = req.body as { refreshToken: string };
  const ctx = (req as AuthedRequest).ctx;
  await authService.logout(body.refreshToken, ctx);
  ok(res, null, 'Logout successful');
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = (req as AuthedRequest).user!;
  const result = await authService.getCurrentUser(user.id);
  ok(res, result, 'Current user');
}

export async function createDoctor(req: Request, res: Response): Promise<void> {
  const ctx = (req as AuthedRequest).ctx;
  const result = await authService.createDoctorUser(req.body, ctx);
  created(res, result, 'Doctor created');
}

export async function createReceptionist(req: Request, res: Response): Promise<void> {
  const ctx = (req as AuthedRequest).ctx;
  const result = await authService.createReceptionistUser(req.body, ctx);
  created(res, result, 'Receptionist created');
}

export async function createDepartment(req: Request, res: Response): Promise<void> {
  const ctx = (req as AuthedRequest).ctx;
  const result = await authService.createDepartment(req.body, ctx);
  created(res, result, 'Department created');
}

export async function listDepartments(_req: Request, res: Response): Promise<void> {
  const result = await authService.listDepartments();
  ok(res, result, 'Departments');
}
