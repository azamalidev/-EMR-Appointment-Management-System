import type { Response, Request } from 'express';
import { ok, created } from '../utils/response.js';
import * as patientService from '../services/patient.service.js';
import type { AuthedRequest } from '../middlewares/auth.js';

export async function searchPatients(req: Request, res: Response): Promise<void> {
  const q = req.query as unknown as { search?: string; limit?: number };
  const result = await patientService.searchPatients(q.search, q.limit ?? 20);
  ok(res, result, 'Patients');
}

export async function createPatient(req: Request, res: Response): Promise<void> {
  const ctx = (req as AuthedRequest).ctx;
  const result = await patientService.createPatient(req.body, ctx);
  created(res, result, 'Patient created');
}
