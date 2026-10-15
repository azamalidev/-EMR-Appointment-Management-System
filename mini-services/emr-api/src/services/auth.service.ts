import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { Doctor } from '../models/Doctor.js';
import { Department } from '../models/Department.js';
import { hashPassword, verifyPassword, hashToken, generateRefreshToken } from '../utils/crypto.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';
import { AppError, Conflict, NotFound, Unauthorized } from '../utils/errors.js';
import { audit } from './audit.service.js';
import type { RequestContext, Role } from '../types.js';
import type { CreateDoctorInput, CreateReceptionistInput, LoginInput } from '../validators/schemas.js';

const ACCESS_TTL_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TTL_DAYS = 7;
const REFRESH_TTL_MS = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    isActive: boolean;
    doctorId: string | null;
  };
}

async function issueTokens(user: {
  id: string;
  email: string;
  name: string;
  role: Role;
  doctorId: string | null;
}, ctx: RequestContext | undefined): Promise<AuthResult> {
  // The refresh token IS a JWT. We store its SHA-256 hash in the DB so the
  // raw token is never persisted. On refresh, we verify the JWT signature,
  // re-hash the raw token, and look up the stored row by that hash.
  const jti = generateRefreshToken(); // CSPRNG random — used as the JWT jti
  const refreshToken = signRefreshToken(user.id, jti);
  const tokenHash = hashToken(refreshToken); // SHA-256 of the JWT string
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await RefreshToken.create({
    userId: user.id,
    tokenHash,
    userAgent: ctx?.userAgent,
    ip: ctx?.ip,
    expiresAt,
    revokedAt: null,
  });

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
    doctorId: user.doctorId,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TTL_SECONDS,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: true,
      doctorId: user.doctorId,
    },
  };
}

export async function login(
  input: LoginInput,
  ctx: RequestContext | undefined,
): Promise<AuthResult> {
  const user = await User.findOne({ email: input.email.toLowerCase() }).select('+passwordHash');
  if (!user || !user.isActive) {
    throw Unauthorized('Invalid credentials');
  }
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    throw Unauthorized('Invalid credentials');
  }
  const doctor = user.role === 'DOCTOR' ? await Doctor.findOne({ userId: user._id }).lean() : null;
  const result = await issueTokens(
    {
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      doctorId: doctor ? String(doctor._id) : null,
    },
    ctx,
  );
  await audit('AUTH_LOGIN', 'User', String(user._id), { email: user.email }, ctx);
  return result;
}

export async function refresh(
  rawRefresh: string,
  ctx: RequestContext | undefined,
): Promise<AuthResult> {
  // Verify JWT structure first.
  const payload = verifyRefreshToken(rawRefresh);
  const tokenHash = hashToken(rawRefresh);

  const stored = await RefreshToken.findOne({ tokenHash });
  if (!stored) {
    // Token not in DB — possible reuse with a non-issued token. Reject.
    throw Unauthorized('Invalid refresh token');
  }

  // REUSE DETECTION: if this token was already revoked, the user (or attacker)
  // is replaying an old token. Revoke ALL of that user's tokens to be safe.
  if (stored.revokedAt) {
    console.warn(
      `[auth] refresh token reuse detected for user ${stored.userId}; revoking all tokens`,
    );
    await RefreshToken.updateMany(
      { userId: stored.userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    await audit(
      'AUTH_REFRESH_REUSE',
      'User',
      String(stored.userId),
      { tokenHash },
      ctx,
    );
    throw Unauthorized('Refresh token reuse detected — all sessions revoked');
  }

  if (stored.expiresAt.getTime() < Date.now()) {
    throw Unauthorized('Refresh token expired');
  }

  // Rotate: revoke this token, issue a new pair.
  stored.revokedAt = new Date();
  await stored.save();

  const user = await User.findById(stored.userId).select('_id role email name isActive');
  if (!user || !user.isActive) {
    throw Unauthorized('User not found or inactive');
  }
  const doctor =
    user.role === 'DOCTOR' ? await Doctor.findOne({ userId: user._id }).lean() : null;

  const result = await issueTokens(
    {
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      doctorId: doctor ? String(doctor._id) : null,
    },
    ctx,
  );
  await audit('AUTH_REFRESH', 'User', String(user._id), {}, ctx);
  return result;
}

export async function logout(
  rawRefresh: string,
  ctx: RequestContext | undefined,
): Promise<void> {
  if (!rawRefresh) return;
  try {
    const tokenHash = hashToken(rawRefresh);
    const stored = await RefreshToken.findOne({ tokenHash });
    if (stored && !stored.revokedAt) {
      stored.revokedAt = new Date();
      await stored.save();
    }
    if (stored && ctx?.user) {
      await audit('AUTH_LOGOUT', 'User', String(stored.userId), {}, ctx);
    }
  } catch (e) {
    console.warn('[auth] logout failed', e);
  }
}

export async function getCurrentUser(userId: string): Promise<{
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  doctorId: string | null;
  doctor?: unknown;
}> {
  const user = await User.findById(userId).select('_id email name role isActive');
  if (!user) throw NotFound('User not found');
  const doctor =
    user.role === 'DOCTOR' ? await Doctor.findOne({ userId: user._id }).lean() : null;
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    doctorId: doctor ? String(doctor._id) : null,
    doctor: doctor ?? undefined,
  };
}

export async function createDoctorUser(
  input: CreateDoctorInput,
  ctx: RequestContext | undefined,
): Promise<{ user: unknown; doctor: unknown }> {
  // Validate department
  const dept = await Department.findById(input.departmentId);
  if (!dept) throw NotFound('Department not found');

  // Check for existing email
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) throw Conflict('Email already in use');

  const passwordHash = await hashPassword(input.password);

  // Create user (role DOCTOR)
  const user = await User.create({
    email: input.email.toLowerCase(),
    passwordHash,
    name: input.name,
    role: 'DOCTOR',
    isActive: true,
  });

  try {
    const doctor = await Doctor.create({
      userId: user._id,
      name: input.name,
      departmentId: input.departmentId,
      specialization: input.specialization,
      qualification: input.qualification,
      bio: input.bio,
      consultationFee: input.consultationFee,
      isActive: true,
    });
    await audit(
      'USER_CREATED_DOCTOR',
      'User',
      String(user._id),
      { email: user.email, doctorId: String(doctor._id), departmentId: input.departmentId },
      ctx,
    );
    const u = user.toObject();
    return {
      user: {
        id: String(u._id),
        email: u.email,
        name: u.name,
        role: u.role,
        isActive: u.isActive,
      },
      doctor: doctor.toObject(),
    };
  } catch (e) {
    // Rollback the user if doctor creation fails
    await User.deleteOne({ _id: user._id });
    throw e instanceof Error ? new AppError(500, 'DOCTOR_CREATE_FAILED', e.message) : e;
  }
}

export async function createReceptionistUser(
  input: CreateReceptionistInput,
  ctx: RequestContext | undefined,
): Promise<{ user: unknown }> {
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) throw Conflict('Email already in use');

  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    email: input.email.toLowerCase(),
    passwordHash,
    name: input.name,
    role: 'RECEPTIONIST',
    isActive: true,
  });
  await audit(
    'USER_CREATED_RECEPTIONIST',
    'User',
    String(user._id),
    { email: user.email },
    ctx,
  );
  const u = user.toObject();
  return {
    user: {
      id: String(u._id),
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
    },
  };
}

export async function createDepartment(
  input: { name: string; description?: string },
  ctx: RequestContext | undefined,
): Promise<unknown> {
  const existing = await Department.findOne({ name: input.name });
  if (existing) throw Conflict('Department already exists');
  const dept = await Department.create({
    name: input.name,
    description: input.description,
  });
  await audit('DEPARTMENT_CREATED', 'Department', String(dept._id), { name: input.name }, ctx);
  return dept.toObject();
}

export async function listDepartments(): Promise<unknown[]> {
  const docs = await Department.find().sort({ name: 1 }).lean();
  return docs.map((d) => ({ ...d, id: String(d._id) }));
}


