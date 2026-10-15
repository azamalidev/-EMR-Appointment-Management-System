import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.js';
import { requireUser } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/rbac.js';
import { parseBody, parseQuery } from '../middlewares/validate.js';
import {
  createAppointmentSchema,
  updateAppointmentSchema,
  listAppointmentsQuerySchema,
} from '../validators/schemas.js';
import * as apptCtrl from '../controllers/appointment.controller.js';

export const appointmentRouter = Router();

appointmentRouter.post(
  '/',
  requireUser,
  requireRole('SUPER_ADMIN', 'RECEPTIONIST'),
  parseBody(createAppointmentSchema),
  asyncHandler(apptCtrl.createAppointment),
);

appointmentRouter.get(
  '/',
  requireUser,
  parseQuery(listAppointmentsQuerySchema),
  asyncHandler(apptCtrl.listAppointments),
);

appointmentRouter.get('/:id', requireUser, asyncHandler(apptCtrl.getAppointment));

appointmentRouter.put(
  '/:id',
  requireUser,
  parseBody(updateAppointmentSchema),
  asyncHandler(apptCtrl.updateAppointment),
);

appointmentRouter.delete('/:id', requireUser, asyncHandler(apptCtrl.cancelAppointment));

appointmentRouter.post('/:id/arrive', requireUser, asyncHandler(apptCtrl.markArrived));

appointmentRouter.post(
  '/:id/complete',
  requireUser,
  requireRole('SUPER_ADMIN', 'DOCTOR'),
  asyncHandler(apptCtrl.markCompleted),
);
