import { Patient } from '../models/Patient.js';
import { Conflict, NotFound } from '../utils/errors.js';
import { audit } from './audit.service.js';
import type { RequestContext } from '../types.js';
import type { CreatePatientInput } from '../validators/schemas.js';

async function nextPatientCode(): Promise<string> {
  // Find the highest existing patient code number.
  const last = await Patient.findOne({})
    .sort({ patientCode: -1 })
    .select('patientCode')
    .lean();
  let next = 1;
  if (last && typeof last.patientCode === 'string') {
    const m = last.patientCode.match(/^P-(\d+)$/);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `P-${String(next).padStart(5, '0')}`;
}

export async function searchPatients(search?: string, limit = 20): Promise<unknown[]> {
  const q: Record<string, unknown>[] = [];
  if (search && search.trim()) {
    const s = search.trim();
    const rx = { $regex: s, $options: 'i' };
    q.push(
      { patientCode: rx },
      { mobile: rx },
      { firstName: rx },
      { lastName: rx },
      { email: rx },
    );
  }
  const filter = q.length ? { $or: q } : {};
  const docs = await Patient.find(filter).sort({ firstName: 1, lastName: 1 }).limit(limit).lean();
  return docs.map((p) => ({ ...p, id: String(p._id) }));
}

export async function createPatient(
  input: CreatePatientInput,
  ctx: RequestContext | undefined,
): Promise<unknown> {
  const mobile = input.mobile.trim();
  const existing = await Patient.findOne({ mobile });
  if (existing) throw Conflict('Mobile number already registered');

  const patientCode = await nextPatientCode();
  const patient = await Patient.create({
    patientCode,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    mobile,
    email: input.email ? input.email : undefined,
    gender: input.gender,
    dob: input.dob ? new Date(input.dob) : undefined,
    address: input.address,
  });
  await audit('PATIENT_CREATED', 'Patient', String(patient._id), { patientCode }, ctx);
  return { ...patient.toObject(), id: String(patient._id) };
}

export async function findOrCreatePatient(
  input: {
    patientId?: string;
    newPatient?: CreatePatientInput;
  },
  ctx: RequestContext | undefined,
): Promise<{ id: string; patientCode: string; firstName: string; lastName: string; mobile: string }> {
  if (input.patientId) {
    const p = await Patient.findById(input.patientId).lean();
    if (!p) throw NotFound('Patient not found');
    return {
      id: String(p._id),
      patientCode: p.patientCode,
      firstName: p.firstName,
      lastName: p.lastName,
      mobile: p.mobile,
    };
  }
  if (input.newPatient) {
    const created = (await createPatient(input.newPatient, ctx)) as {
      _id?: string;
      id?: string;
      patientCode: string;
      firstName: string;
      lastName: string;
      mobile: string;
    };
    return {
      id: (created.id ?? created._id)!,
      patientCode: created.patientCode,
      firstName: created.firstName,
      lastName: created.lastName,
      mobile: created.mobile,
    };
  }
  throw NotFound('Either patientId or newPatient payload is required');
}
