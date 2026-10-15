import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.js';
import { requireUser } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/rbac.js';
import { parseBody, parseQuery } from '../middlewares/validate.js';
import { createPatientSchema, patientsQuerySchema } from '../validators/schemas.js';
import * as patientCtrl from '../controllers/patient.controller.js';

export const patientRouter = Router();

patientRouter.get(
  '/',
  requireUser,
  parseQuery(patientsQuerySchema),
  asyncHandler(patientCtrl.searchPatients),
);
patientRouter.post(
  '/',
  requireUser,
  requireRole('SUPER_ADMIN', 'RECEPTIONIST'),
  parseBody(createPatientSchema),
  asyncHandler(patientCtrl.createPatient),
);
