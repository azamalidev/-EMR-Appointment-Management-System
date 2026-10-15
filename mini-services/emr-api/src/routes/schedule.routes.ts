import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.js';
import { requireUser } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/rbac.js';
import { parseBody } from '../middlewares/validate.js';
import { upsertScheduleSchema } from '../validators/schemas.js';
import * as scheduleCtrl from '../controllers/schedule.controller.js';

export const scheduleRouter = Router({ mergeParams: true });

// Note: this router is mounted at /doctors/:id/schedules
scheduleRouter.get('/', requireUser, asyncHandler(scheduleCtrl.listSchedules));
scheduleRouter.post(
  '/',
  requireUser,
  requireRole('SUPER_ADMIN'),
  parseBody(upsertScheduleSchema),
  asyncHandler(scheduleCtrl.upsertSchedule),
);
scheduleRouter.delete(
  '/',
  requireUser,
  requireRole('SUPER_ADMIN'),
  asyncHandler(scheduleCtrl.deleteSchedule),
);
