import mongoose, { Schema, Document } from 'mongoose';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export interface IPatient extends Document {
  patientCode: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email?: string;
  gender?: Gender;
  dob?: Date;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

const patientSchema = new Schema<IPatient>(
  {
    patientCode: { type: String, required: true, unique: true, index: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, unique: true, index: true },
    email: { type: String, lowercase: true, trim: true },
    gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER'] },
    dob: Date,
    address: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

patientSchema.index({ firstName: 1, lastName: 1 });
// Note: `mobile` already has `unique: true, index: true` at the field level —
// don't add a duplicate schema-level index.

patientSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    r.id = r._id;
    delete r._id;
    delete r.__v;
    return r;
  },
});

export const Patient = mongoose.model<IPatient>('Patient', patientSchema);
