import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import {
  doctorRouter,
  departmentRouter,
  receptionistRouter,
} from './doctor.routes.js';
import { scheduleRouter } from './schedule.routes.js';
import { slotRouter } from './slot.routes.js';
import { patientRouter } from './patient.routes.js';
import { appointmentRouter } from './appointment.routes.js';
import { auditRouter } from './audit.routes.js';
import { dashboardRouter } from './dashboard.routes.js';

export const router = Router();

// Auth
router.use('/auth', authRouter);

// Departments + receptionists as top-level resources
router.use('/departments', departmentRouter);
router.use('/receptionists', receptionistRouter);

// Doctors (and nested schedule sub-resource)
router.use('/doctors', doctorRouter);
router.use('/doctors/:id/schedules', scheduleRouter);

// Slots
router.use('/slots', slotRouter);

// Patients
router.use('/patients', patientRouter);

// Appointments
router.use('/appointments', appointmentRouter);

// Audit logs
router.use('/audit-logs', auditRouter);

// Dashboard
router.use('/dashboard', dashboardRouter);
