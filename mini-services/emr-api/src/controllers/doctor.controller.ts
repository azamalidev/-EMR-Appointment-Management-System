import type { Response, Request } from 'express';
import { ok, created } from '../utils/response.js';
import * as doctorService from '../services/doctor.service.js';
import * as authService from '../services/auth.service.js';
import type { AuthedRequest } from '../middlewares/auth.js';

export async function listDoctors(_req: Request, res: Response): Promise<void> {
  const result = await doctorService.listDoctors();
  ok(res, result, 'Doctors');
}

export async function getDoctor(req: Request, res: Response): Promise<void> {
  const result = await doctorService.getDoctor(String(req.params.id));
  ok(res, result, 'Doctor');
}

export async function createDoctor(req: Request, res: Response): Promise<void> {
  const ctx = (req as AuthedRequest).ctx;
  // Delegate to auth service which also creates the User record.
  const result = await authService.createDoctorUser(req.body, ctx);
  created(res, result, 'Doctor created');
}

export async function listDepartments(_req: Request, res: Response): Promise<void> {
  const result = await authService.listDepartments();
  ok(res, result, 'Departments');
}

export async function createDepartment(req: Request, res: Response): Promise<void> {
  const ctx = (req as AuthedRequest).ctx;
  const result = await authService.createDepartment(req.body, ctx);
  created(res, result, 'Department created');
}

export async function createReceptionist(req: Request, res: Response): Promise<void> {
  const ctx = (req as AuthedRequest).ctx;
  const result = await authService.createReceptionistUser(req.body, ctx);
  created(res, result, 'Receptionist created');
}
