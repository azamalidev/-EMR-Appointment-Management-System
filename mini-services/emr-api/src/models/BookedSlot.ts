import mongoose, { Schema, Document } from 'mongoose';

export interface IBookedSlot extends Document {
  doctorId: mongoose.Types.ObjectId;
  date: Date;
  slotStart: string; // "HH:mm"
  slotEnd: string;
  appointmentId: mongoose.Types.ObjectId;
}

/**
 * BookedSlot — the DOUBLE-BOOKING GUARD.
 *
 * UNIQUE compound index on { doctorId, date, slotStart } ensures that
 * even under concurrent inserts, only one appointment can claim a given
 * doctor+date+slot. Mongoose/mongo throws E11000 on the second insert;
 * the appointment service catches that and returns 409 Conflict.
 */
const bookedSlotSchema = new Schema<IBookedSlot>(
  {
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    date: { type: Date, required: true },
    slotStart: { type: String, required: true },
    slotEnd: { type: String, required: true },
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      unique: true,
    },
  },
  { versionKey: false },
);

// THE GUARD: unique compound index.
bookedSlotSchema.index({ doctorId: 1, date: 1, slotStart: 1 }, { unique: true });
// Lookup helper.
bookedSlotSchema.index({ doctorId: 1, date: 1 });

export const BookedSlot = mongoose.model<IBookedSlot>('BookedSlot', bookedSlotSchema);
