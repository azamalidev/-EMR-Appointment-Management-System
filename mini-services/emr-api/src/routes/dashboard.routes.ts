import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.js';
import { requireUser } from '../middlewares/auth.js';
import * as dashboardCtrl from '../controllers/dashboard.controller.js';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', requireUser, asyncHandler(dashboardCtrl.getDashboardStats));
