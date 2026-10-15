import mongoose, { Schema, Document } from 'mongoose';

export type SessionType = 'WORK' | 'BREAK';

export interface IScheduleSession extends Document {
  scheduleId: mongoose.Types.ObjectId;
  name: string;
  type: SessionType;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  sortOrder: number;
}

const scheduleSessionSchema = new Schema<IScheduleSession>(
  {
    scheduleId: { type: Schema.Types.ObjectId, ref: 'DoctorSchedule', required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['WORK', 'BREAK'], required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
  },
  { versionKey: false },
);

scheduleSessionSchema.index({ scheduleId: 1, sortOrder: 1 });

export const ScheduleSession = mongoose.model<IScheduleSession>('ScheduleSession', scheduleSessionSchema);
