import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  userId?: mongoose.Types.ObjectId;
  userRole?: 'SUPER_ADMIN' | 'RECEPTIONIST' | 'DOCTOR';
  userEmail?: string;
  action: string;
  entity: string;
  entityId?: mongoose.Types.ObjectId;
  metadata?: unknown;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    userRole: { type: String, enum: ['SUPER_ADMIN', 'RECEPTIONIST', 'DOCTOR'] },
    userEmail: String,
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, index: true },
    metadata: { type: Schema.Types.Mixed },
    ip: String,
    userAgent: String,
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);

auditLogSchema.index({ userId: 1, timestamp: 1 });
auditLogSchema.index({ action: 1, timestamp: 1 });
auditLogSchema.index({ entity: 1, entityId: 1 });

auditLogSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    r.id = r._id;
    delete r._id;
    delete r.__v;
    return r;
  },
});

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
