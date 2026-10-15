import mongoose, { Schema, Document } from 'mongoose';

export interface IDoctor extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  departmentId: mongoose.Types.ObjectId;
  specialization?: string;
  qualification?: string;
  bio?: string;
  consultationFee?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const doctorSchema = new Schema<IDoctor>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    specialization: String,
    qualification: String,
    bio: String,
    consultationFee: Number,
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

doctorSchema.index({ departmentId: 1, isActive: 1 });
doctorSchema.index({ isActive: 1 });

doctorSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    r.id = r._id;
    delete r._id;
    delete r.__v;
    return r;
  },
});

export const Doctor = mongoose.model<IDoctor>('Doctor', doctorSchema);
