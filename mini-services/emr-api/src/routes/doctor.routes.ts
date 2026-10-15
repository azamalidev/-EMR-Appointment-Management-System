import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.js';
import { requireUser } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/rbac.js';
import { parseBody } from '../middlewares/validate.js';
import {
  createDoctorSchema,
  createDepartmentSchema,
  createReceptionistSchema,
} from '../validators/schemas.js';
import * as doctorCtrl from '../controllers/doctor.controller.js';
import * as authCtrl from '../controllers/auth.controller.js';

export const doctorRouter = Router();

doctorRouter.get('/', requireUser, asyncHandler(doctorCtrl.listDoctors));
doctorRouter.get('/:id', requireUser, asyncHandler(doctorCtrl.getDoctor));
doctorRouter.post(
  '/',
  requireUser,
  requireRole('SUPER_ADMIN'),
  parseBody(createDoctorSchema),
  asyncHandler(doctorCtrl.createDoctor),
);

// Departments (top-level resource)
export const departmentRouter = Router();
departmentRouter.get('/', requireUser, asyncHandler(authCtrl.listDepartments));
departmentRouter.post(
  '/',
  requireUser,
  requireRole('SUPER_ADMIN'),
  parseBody(createDepartmentSchema),
  asyncHandler(authCtrl.createDepartment),
);

// Receptionists (top-level resource, admin-only)
export const receptionistRouter = Router();
receptionistRouter.post(
  '/',
  requireUser,
  requireRole('SUPER_ADMIN'),
  parseBody(createReceptionistSchema),
  asyncHandler(authCtrl.createReceptionist),
);
