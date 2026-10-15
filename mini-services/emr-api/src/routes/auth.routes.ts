import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.js';
import { requireUser, optionalUser } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/rbac.js';
import { parseBody } from '../middlewares/validate.js';
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  createDoctorSchema,
  createReceptionistSchema,
  createDepartmentSchema,
} from '../validators/schemas.js';
import * as authCtrl from '../controllers/auth.controller.js';

export const authRouter = Router();

authRouter.post('/login', parseBody(loginSchema), asyncHandler(authCtrl.login));
authRouter.post('/refresh', parseBody(refreshSchema), asyncHandler(authCtrl.refresh));
authRouter.post('/logout', optionalUser, parseBody(logoutSchema), asyncHandler(authCtrl.logout));
authRouter.get('/me', requireUser, asyncHandler(authCtrl.me));

// User management — also mounted under /auth for convenience.
authRouter.post(
  '/doctors',
  requireUser,
  requireRole('SUPER_ADMIN'),
  parseBody(createDoctorSchema),
  asyncHandler(authCtrl.createDoctor),
);
authRouter.post(
  '/receptionists',
  requireUser,
  requireRole('SUPER_ADMIN'),
  parseBody(createReceptionistSchema),
  asyncHandler(authCtrl.createReceptionist),
);
authRouter.post(
  '/departments',
  requireUser,
  requireRole('SUPER_ADMIN'),
  parseBody(createDepartmentSchema),
  asyncHandler(authCtrl.createDepartment),
);
