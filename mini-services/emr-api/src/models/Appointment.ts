import mongoose, { Schema, Document } from 'mongoose';

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'ARRIVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface IAppointment extends Document {
  appointmentCode: string;
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  departmentId: mongoose.Types.ObjectId;
  date: Date;
  slotStart: string; // "HH:mm"
  slotEnd: string; // "HH:mm"
  status: AppointmentStatus;
  purpose?: string;
  notes?: string;
  consultationNotes?: string;
  bookedById?: mongoose.Types.ObjectId;
  bookedAt: Date;
  arrivedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelledById?: mongoose.Types.ObjectId;
  cancelReason?: string;
  updatedById?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new Schema<IAppointment>(
  {
    appointmentCode: { type: String, required: true, unique: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    date: { type: Date, required: true, index: true },
    slotStart: { type: String, required: true },
    slotEnd: { type: String, required: true },
    status: {
      type: String,
      enum: ['SCHEDULED', 'ARRIVED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
      default: 'SCHEDULED',
      index: true,
    },
    purpose: String,
    notes: String,
    consultationNotes: String,
    bookedById: { type: Schema.Types.ObjectId, ref: 'User' },
    bookedAt: { type: Date, default: Date.now },
    arrivedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    cancelledById: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelReason: String,
    updatedById: { type: Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

// Compound indexes for hot query paths.
appointmentSchema.index({ doctorId: 1, date: 1, status: 1 });
appointmentSchema.index({ patientId: 1, date: 1 });
appointmentSchema.index({ departmentId: 1, date: 1 });
appointmentSchema.index({ date: 1, status: 1 });
appointmentSchema.index({ status: 1, date: 1 });

appointmentSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    r.id = r._id;
    delete r._id;
    delete r.__v;
    return r;
  },
});

export const Appointment = mongoose.model<IAppointment>('Appointment', appointmentSchema);
