import type { Response, Request } from 'express';
import { ok, pageMeta } from '../utils/response.js';
import { listAuditLogs } from '../services/audit.service.js';

export async function listAudit(req: Request, res: Response): Promise<void> {
  const q = req.query as unknown as {
    page: number;
    pageSize: number;
    action?: string;
    entity?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
  };
  const { items, total } = await listAuditLogs(q);
  ok(res, items, 'Audit logs', pageMeta(total, q.page, q.pageSize));
}
