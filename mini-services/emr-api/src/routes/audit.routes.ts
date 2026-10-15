import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.js';
import { requireUser } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/rbac.js';
import { parseQuery } from '../middlewares/validate.js';
import { auditQuerySchema } from '../validators/schemas.js';
import * as auditCtrl from '../controllers/audit.controller.js';

export const auditRouter = Router();

auditRouter.get(
  '/',
  requireUser,
  requireRole('SUPER_ADMIN'),
  parseQuery(auditQuerySchema),
  asyncHandler(auditCtrl.listAudit),
);
