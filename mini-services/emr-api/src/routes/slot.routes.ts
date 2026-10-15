import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.js';
import { requireUser } from '../middlewares/auth.js';
import { parseQuery } from '../middlewares/validate.js';
import { slotsQuerySchema } from '../validators/schemas.js';
import * as slotCtrl from '../controllers/slot.controller.js';

export const slotRouter = Router();

slotRouter.get(
  '/',
  requireUser,
  parseQuery(slotsQuerySchema),
  asyncHandler(slotCtrl.getSlots),
);
