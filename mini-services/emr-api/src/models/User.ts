import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'SUPER_ADMIN' | 'RECEPTIONIST' | 'DOCTOR';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'RECEPTIONIST', 'DOCTOR'],
      required: true,
      index: true,
    },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false, timestamps: false },
);

userSchema.index({ role: 1, isActive: 1 });

// Virtual populate of Doctor profile (only set for DOCTOR role users).
userSchema.virtual('doctor', {
  ref: 'Doctor',
  localField: '_id',
  foreignField: 'userId',
  justOne: true,
});

userSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    delete r.passwordHash;
    r.id = r._id;
    delete r._id;
    delete r.__v;
    return r;
  },
});

export const User = mongoose.model<IUser>('User', userSchema);
