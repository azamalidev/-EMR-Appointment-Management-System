import { AuditLog } from '../models/AuditLog.js';
import type { RequestContext } from '../types.js';

/**
 * Write an audit log entry. NEVER throws — failures are logged and swallowed
 * so they cannot break the main operation's success path.
 */
export async function audit(
  action: string,
  entity: string,
  entityId: string | null | undefined,
  metadata: Record<string, unknown> | undefined,
  ctx: RequestContext | undefined,
): Promise<void> {
  try {
    await AuditLog.create({
      userId: ctx?.user?.id ?? undefined,
      userRole: ctx?.user?.role ?? undefined,
      userEmail: ctx?.user?.email ?? undefined,
      action,
      entity,
      entityId: entityId ?? undefined,
      metadata: metadata ?? undefined,
      ip: ctx?.ip ?? undefined,
      userAgent: ctx?.userAgent ?? undefined,
      timestamp: new Date(),
    });
  } catch (e) {
    console.warn('[audit] failed to write log entry', action, entity, e);
  }
}

export interface AuditListResult {
  items: unknown[];
  total: number;
}

export async function listAuditLogs(params: {
  page: number;
  pageSize: number;
  action?: string;
  entity?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<AuditListResult> {
  const filter: Record<string, unknown> = {};
  if (params.action) filter.action = params.action;
  if (params.entity) filter.entity = params.entity;
  if (params.userId) filter.userId = params.userId;
  if (params.dateFrom || params.dateTo) {
    const ts: Record<string, Date> = {};
    if (params.dateFrom) ts.$gte = new Date(params.dateFrom + 'T00:00:00');
    if (params.dateTo) ts.$lte = new Date(params.dateTo + 'T23:59:59.999');
    filter.timestamp = ts;
  }
  const skip = (params.page - 1) * params.pageSize;
  const [docs, total] = await Promise.all([
    AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(params.pageSize).lean(),
    AuditLog.countDocuments(filter),
  ]);
  const items = docs.map((d) => ({ ...d, id: String(d._id) }));
  return { items, total };
}
