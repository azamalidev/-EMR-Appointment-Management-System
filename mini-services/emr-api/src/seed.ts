import { User } from './models/User.js';
import { Department } from './models/Department.js';
import { Doctor } from './models/Doctor.js';
import { DoctorSchedule } from './models/DoctorSchedule.js';
import { ScheduleSession } from './models/ScheduleSession.js';
import { Patient } from './models/Patient.js';
import { Appointment } from './models/Appointment.js';
import { BookedSlot } from './models/BookedSlot.js';
import { hashPassword } from './utils/crypto.js';
import {
  fromDateKey,
  generateSlots,
  startOfDay,
  weekdayOf,
  isPastSlot,
} from './utils/slots.js';
import type { DayOfWeek } from './types.js';

const DAYS: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

interface SessionSeed {
  name: string;
  type: 'WORK' | 'BREAK';
  startTime: string;
  endTime: string;
  sortOrder: number;
}

const SEED_SESSIONS: SessionSeed[] = [
  { name: 'Morning', type: 'WORK', startTime: '09:00', endTime: '12:00', sortOrder: 0 },
  { name: 'Lunch', type: 'BREAK', startTime: '12:00', endTime: '13:00', sortOrder: 1 },
  { name: 'Evening', type: 'WORK', startTime: '13:00', endTime: '17:00', sortOrder: 2 },
];

/**
 * Idempotent seed: checks if data already exists before inserting.
 */
export async function runSeed(): Promise<void> {
  const userCount = await User.countDocuments();
  if (userCount > 0) {
    console.log('[seed] Users already present — skipping seed.');
    return;
  }

  // Departments
  const departments = await Department.create([
    { name: 'Cardiology', description: 'Heart and cardiovascular care' },
    { name: 'General Medicine', description: 'Primary care and general consultations' },
    { name: 'Dermatology', description: 'Skin, hair and nail care' },
    { name: 'Pediatrics', description: 'Child and adolescent medicine' },
  ]);
  const cardiology = departments[0];
  const generalMed = departments[1];
  console.log('[seed] Departments created:', departments.map((d) => d.name).join(', '));

  // Users
  const adminHash = await hashPassword('Admin@123');
  const receptionHash = await hashPassword('Reception@123');
  const doctorHash = await hashPassword('Doctor@123');

  const admin = await User.create({
    email: 'admin@emr.local',
    passwordHash: adminHash,
    name: 'Super Admin',
    role: 'SUPER_ADMIN',
    isActive: true,
  });
  const receptionist = await User.create({
    email: 'reception@emr.local',
    passwordHash: receptionHash,
    name: 'Front Desk',
    role: 'RECEPTIONIST',
    isActive: true,
  });
  const drKhanUser = await User.create({
    email: 'dr.khan@emr.local',
    passwordHash: doctorHash,
    name: 'Dr. Ayesha Khan',
    role: 'DOCTOR',
    isActive: true,
  });
  const drAhmedUser = await User.create({
    email: 'dr.ahmed@emr.local',
    passwordHash: doctorHash,
    name: 'Dr. Bilal Ahmed',
    role: 'DOCTOR',
    isActive: true,
  });

  // Doctors
  const drKhan = await Doctor.create({
    userId: drKhanUser._id,
    name: 'Dr. Ayesha Khan',
    departmentId: cardiology._id,
    specialization: 'Interventional Cardiology',
    qualification: 'MBBS, FCPS (Cardiology)',
    bio: 'Senior interventional cardiologist with 12+ years of experience.',
    consultationFee: 2500,
    isActive: true,
  });
  const drAhmed = await Doctor.create({
    userId: drAhmedUser._id,
    name: 'Dr. Bilal Ahmed',
    departmentId: generalMed._id,
    specialization: 'General Physician',
    qualification: 'MBBS, MD',
    bio: 'Family physician focused on preventive care.',
    consultationFee: 1500,
    isActive: true,
  });
  console.log('[seed] Users + Doctors created.');

  // Schedules (Mon-Fri) for both doctors.
  for (const doctor of [drKhan, drAhmed]) {
    for (const day of DAYS) {
      const sched = await DoctorSchedule.create({
        doctorId: doctor._id,
        dayOfWeek: day,
        slotDurationMinutes: 15,
        isActive: true,
      });
      await ScheduleSession.insertMany(
        SEED_SESSIONS.map((s) => ({ ...s, scheduleId: sched._id })),
      );
    }
  }
  console.log('[seed] Schedules created for both doctors (Mon-Fri, 09-17 with lunch break).');

  // Patients
  const patients = await Patient.create([
    {
      patientCode: 'P-00001',
      firstName: 'John',
      lastName: 'Doe',
      mobile: '03001234567',
      email: 'john.doe@example.com',
      gender: 'MALE',
      dob: new Date('1988-04-12T00:00:00Z'),
      address: '123 Main Street, Karachi',
    },
    {
      patientCode: 'P-00002',
      firstName: 'Fatima',
      lastName: 'Noor',
      mobile: '03007654321',
      email: 'fatima.noor@example.com',
      gender: 'FEMALE',
      dob: new Date('1995-09-22T00:00:00Z'),
      address: '45 Garden Town, Lahore',
    },
    {
      patientCode: 'P-00003',
      firstName: 'Imran',
      lastName: 'Siddiqui',
      mobile: '03219876543',
      email: 'imran.s@example.com',
      gender: 'MALE',
      dob: new Date('1979-01-05T00:00:00Z'),
      address: '12 F-8 Markaz, Islamabad',
    },
    {
      patientCode: 'P-00004',
      firstName: 'Sara',
      lastName: 'Khan',
      mobile: '03334567890',
      email: 'sara.khan@example.com',
      gender: 'FEMALE',
      dob: new Date('2001-12-30T00:00:00Z'),
      address: '78 Clifton, Karachi',
    },
  ]);
  console.log('[seed] Patients created: 4');

  // Sample appointments for today: book the 2nd and 4th FUTURE slot for each doctor
  // with the first two patients.
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayDate = fromDateKey(todayKey);
  const dayOfWeek = weekdayOf(todayDate);

  // If today is a weekend, fall back to booking on the next Monday.
  let bookingDate = todayDate;
  let bookingDay = dayOfWeek;
  if (dayOfWeek === 'SAT' || dayOfWeek === 'SUN') {
    const monday = new Date(todayDate);
    const addDays = dayOfWeek === 'SAT' ? 2 : 1;
    monday.setDate(monday.getDate() + addDays);
    bookingDate = monday;
    bookingDay = weekdayOf(monday);
  }

  const bookingDateMidnight = startOfDay(bookingDate);

  for (const doctor of [drKhan, drAhmed]) {
    const schedule = await DoctorSchedule.findOne({
      doctorId: doctor._id,
      dayOfWeek: bookingDay,
    });
    if (!schedule) continue;
    const sessions = await ScheduleSession.find({ scheduleId: schedule._id })
      .sort({ sortOrder: 1 })
      .lean();
    const allSlots = generateSlots(
      sessions.map((s) => ({ type: s.type, startTime: s.startTime, endTime: s.endTime })),
      schedule.slotDurationMinutes,
    );
    // Pick the 2nd and 4th future slots (relative to "now" if booking today, else all).
    const useNow = bookingKey(bookingDate) === todayKey ? new Date() : null;
    const futureSlots = useNow
      ? allSlots.filter((s) => !isPastSlot(bookingKey(bookingDate), s.start, useNow))
      : allSlots;
    const picks = [futureSlots[1], futureSlots[3]].filter(Boolean);
    let apptNum = 1;
    for (const slot of picks) {
      const patient = patients[(apptNum - 1) % patients.length];
      const apptCode = `AP-${String(await nextApptNum()).padStart(5, '0')}`;
      const appt = await Appointment.create({
        appointmentCode: apptCode,
        patientId: patient._id,
        doctorId: doctor._id,
        departmentId: doctor.departmentId,
        date: bookingDateMidnight,
        slotStart: slot.start,
        slotEnd: slot.end,
        status: 'SCHEDULED',
        purpose: 'Routine checkup',
        notes: 'Seeded appointment',
        bookedById: receptionist._id,
        bookedAt: new Date(),
      });
      await BookedSlot.create({
        doctorId: doctor._id,
        date: bookingDateMidnight,
        slotStart: slot.start,
        slotEnd: slot.end,
        appointmentId: appt._id,
      });
      apptNum++;
    }
  }

  console.log('[seed] Sample appointments booked for', bookingDay, bookingKey(bookingDate));

  console.log('\n[seed] ===== Demo Credentials =====');
  console.log('  Super Admin    : admin@emr.local / Admin@123');
  console.log('  Receptionist   : reception@emr.local / Reception@123');
  console.log('  Doctor (Khan)  : dr.khan@emr.local / Doctor@123');
  console.log('  Doctor (Ahmed) : dr.ahmed@emr.local / Doctor@123');
  console.log('[seed] ============================\n');
}

function bookingKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let apptCounter = 0;
async function nextApptNum(): Promise<number> {
  if (apptCounter === 0) {
    const last = await Appointment.findOne({})
      .sort({ appointmentCode: -1 })
      .select('appointmentCode')
      .lean();
    if (last && last.appointmentCode) {
      const m = last.appointmentCode.match(/^AP-(\d+)$/);
      if (m) apptCounter = parseInt(m[1], 10);
    }
  }
  apptCounter++;
  return apptCounter;
}


