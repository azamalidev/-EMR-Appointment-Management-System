import mongoose, { Schema, Document } from 'mongoose';

export type DayOfWeek = 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';

export interface IDoctorSchedule extends Document {
  doctorId: mongoose.Types.ObjectId;
  dayOfWeek: DayOfWeek;
  slotDurationMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const doctorScheduleSchema = new Schema<IDoctorSchedule>(
  {
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    dayOfWeek: {
      type: String,
      enum: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
      required: true,
    },
    slotDurationMinutes: { type: Number, default: 15, min: 5, max: 120 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

doctorScheduleSchema.index({ doctorId: 1, dayOfWeek: 1 }, { unique: true });

doctorScheduleSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    r.id = r._id;
    delete r._id;
    delete r.__v;
    return r;
  },
});

export const DoctorSchedule = mongoose.model<IDoctorSchedule>('DoctorSchedule', doctorScheduleSchema);
