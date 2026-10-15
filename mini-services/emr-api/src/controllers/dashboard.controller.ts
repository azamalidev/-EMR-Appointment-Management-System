import type { Response, Request } from 'express';
import { ok } from '../utils/response.js';
import { getStats } from '../services/dashboard.service.js';
import type { AuthedRequest } from '../middlewares/auth.js';

export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  const user = (req as AuthedRequest).user;
  const result = await getStats(user);
  ok(res, result, 'Dashboard stats');
}
