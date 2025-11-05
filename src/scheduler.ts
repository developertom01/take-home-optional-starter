import { Patient } from "./models/patient";
import { Clinician } from "./models/clinician";
import { AppointmentStatus } from "./models/appointment";

/**
 * IMPORTANT: Capacity Counting Logic
 * 
 * When checking clinician capacity (maxDailyAppointments, maxWeeklyAppointments),
 * we count appointments with these statuses:
 * - UPCOMING: Future appointments
 * - OCCURRED: Past appointments that already happened (prevents exceeding daily limit)
 * - LATE_CANCELLATION: Late cancellations still consume capacity
 * 
 * We DO NOT count:
 * - CANCELLED: Properly cancelled with notice (frees up capacity)
 * - NO_SHOW: Patient didn't show up (frees up capacity)
 * - RE_SCHEDULED: Moved to different time (frees up this slot)
 * 
 * Rationale: Without counting OCCURRED appointments, a clinician could exceed their
 * daily limit if appointments transition from UPCOMING → OCCURRED throughout the day.
 * Example: Daily limit of 5, already saw 2 patients (OCCURRED), has 3 UPCOMING.
 * If we only counted UPCOMING (3), system would allow booking 2 more, exceeding limit.
 * 
 * ASSUMPTION: Appointments don't span across midnight
 * - An appointment scheduled at 11:30 PM is counted only toward that day's capacity
 * - We assume the EHR system won't create slots that cross midnight (e.g., 11:30 PM - 1:00 AM)
 * - This simplifies capacity logic and matches typical healthcare scheduling practices
 * - Alternative: Could count appointment toward both days or add validation to prevent late slots
 */

export interface AssessmentSlotPair {
  session1: Date;
  session2: Date;
}

export interface ClinicianAvailability {
  clinician: Clinician;
  availableSlotPairs: AssessmentSlotPair[];
}

/**
 * Task 2: Optimizes slots by filtering out overlapping times to maximize appointments per day
 * 
 * This function implements an interval scheduling algorithm that selects non-overlapping
 * time slots to maximize the number of appointments that can be scheduled.
 * 
 * @param dates - Array of Date objects representing available time slots
 * @param durationMinutes - Duration of each appointment in minutes
 * @returns Array of Date objects that don't overlap when considering appointment duration
 */
export function optimizeSlots(dates: Date[], durationMinutes: number): Date[] {
  if (dates.length === 0) return [];
  const intervals = dates
    .map(d => ({ start: d, end: new Date(d.getTime() + durationMinutes * 60_000) }))
    .sort((a, b) => a.end.getTime() - b.end.getTime());

  const selected: Date[] = [];
  let lastEnd = -Infinity;
  for (const itv of intervals) {
    if (itv.start.getTime() >= lastEnd) {
      selected.push(itv.start);
      lastEnd = itv.end.getTime();
    }
  }
  return selected;
}

/**
 * Checks if a clinician is eligible to serve a patient based on state and insurance
 */
function isClinicianEligible(clinician: Clinician, patient: Patient): boolean {
  return (
    clinician.states.includes(patient.state) &&
    clinician.insurances.includes(patient.insurance)
  );
}

/**
 * Gets the start of day (midnight UTC) for a given date
 */
function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Gets the start of week (Monday midnight UTC) for a given date
 */
function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Task 3: Counts appointments for a clinician on a specific day
 * 
 * Counts all appointments that consume capacity for the day, including:
 * - UPCOMING: Future appointments that will happen
 * - OCCURRED: Past appointments that already happened (still count toward daily limit)
 * - LATE_CANCELLATION: Cancelled late but still count toward capacity
 * 
 * Excludes:
 * - CANCELLED: Properly cancelled with notice
 * - NO_SHOW: Patient didn't show up
 * - RE_SCHEDULED: Moved to a different time (frees up this slot)
 */
function getAppointmentsOnDay(clinician: Clinician, date: Date): number {
  const dayStart = getStartOfDay(date).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;

  const COUNTABLE_STATUSES: AppointmentStatus[] = [
    "UPCOMING",
    "OCCURRED",
    "LATE_CANCELLATION"
  ];

  return clinician.appointments.filter(apt => {
    const aptTime = apt.scheduledFor.getTime();
    const inTimeRange = aptTime >= dayStart && aptTime < dayEnd;
    return inTimeRange && COUNTABLE_STATUSES.includes(apt.status);
  }).length;
}

/**
 * Task 3: Counts appointments for a clinician in the week containing the given date
 * 
 * Logic:
 * - A week starts on Monday at 00:00 UTC and ends on the following Monday at 00:00 UTC
 * - Counts all appointments that consume capacity (UPCOMING, OCCURRED, LATE_CANCELLATION)
 * - Excludes cancelled, no-shows, and rescheduled appointments
 */
function getAppointmentsInWeek(clinician: Clinician, date: Date): number {
  const weekStart = getStartOfWeek(date).getTime();
  const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;

  const COUNTABLE_STATUSES: AppointmentStatus[] = [
    "UPCOMING",
    "OCCURRED",
    "LATE_CANCELLATION"
  ];

  return clinician.appointments.filter(apt => {
    const aptTime = apt.scheduledFor.getTime();
    const inTimeRange = aptTime >= weekStart && aptTime < weekEnd;
    return inTimeRange && COUNTABLE_STATUSES.includes(apt.status);
  }).length;
}

/**
 * Task 3: Checks if a clinician can accept appointments on given dates
 * considering their maxDailyAppointments and maxWeeklyAppointments constraints
 * 
 * Logic:
 * - Group dates by day to check daily limits
 * - Group dates by week to check weekly limits
 * - Returns false if any limit would be exceeded
 */
function canAccommodateAppointments(
  clinician: Clinician,
  dates: Date[]
): boolean {
  // Group dates by day - just count per day
  const countsByDay = new Map<string, number>();
  
  for (const date of dates) {
    const dayKey = getStartOfDay(date).toISOString();
    countsByDay.set(dayKey, (countsByDay.get(dayKey) || 0) + 1);
  }

  // Check daily limits for each day
  for (const [dayKey, count] of countsByDay.entries()) {
    const representativeDate = new Date(dayKey); // Reconstruct from ISO string
    const existingCount = getAppointmentsOnDay(clinician, representativeDate);
    
    if (existingCount + count > clinician.maxDailyAppointments) {
      return false;
    }
  }

  // Group dates by week - just count per week
  const countsByWeek = new Map<string, number>();
  
  for (const date of dates) {
    const weekKey = getStartOfWeek(date).toISOString();
    countsByWeek.set(weekKey, (countsByWeek.get(weekKey) || 0) + 1);
  }

  // Check weekly limits for each week
  for (const [weekKey, count] of countsByWeek.entries()) {
    const representativeDate = new Date(weekKey); // Reconstruct from ISO string
    const appointmentsInWeek = getAppointmentsInWeek(clinician, representativeDate);

    if (appointmentsInWeek + count > clinician.maxWeeklyAppointments) {
      return false;
    }
  }

  return true;
}

/**
 * Task 1: Finds all valid pairs of assessment slots for a patient
 * 
 * Assessment requirements:
 * - Both sessions must be 90 minutes long
 * - Sessions must be on different days
 * - Sessions must be no more than 7 days apart
 * - Clinician must be a psychologist
 * - Clinician must accept patient's insurance and operate in patient's state
 * 
 * Performance optimizations:
 * - Groups slots by day to reduce redundant getStartOfDay() calls from O(n²) to O(n)
 * - Pre-filters days without capacity to avoid unnecessary pairing attempts
 * - Sorts days chronologically for early termination when >7 days apart
 * - Complexity: O(n + d² × s²) where d = eligible days, s = slots per day (d << n typically)
 * 
 * Note: For assessments, we show all possible pairs even if some slots on the same day
 * would overlap if both were booked. This is because each pair represents booking TWO
 * specific time slots (one on each of two different days), so the optimization constraint
 * about overlapping slots on the same day doesn't apply in the same way.
 * 
 * @param patient - The patient seeking assessment
 * @param clinicians - Array of all clinicians
 * @returns Array of clinician availability with valid slot pairs
 */
export function findAssessmentSlots(
  patient: Patient,
  clinicians: Clinician[]
): ClinicianAvailability[] {
  const results: ClinicianAvailability[] = [];

  for (const clinician of clinicians) {
    // Filter: must be a psychologist
    if (clinician.clinicianType !== "PSYCHOLOGIST") {
      continue;
    }

    // Filter: must accept patient's insurance and operate in their state
    if (!isClinicianEligible(clinician, patient)) {
      continue;
    }

    // Get 90-minute slots only (psychologist assessment slots)
    const assessmentSlots = clinician.availableSlots
      .filter(slot => slot.length === 90)
      .map(slot => slot.date)
      .sort((a, b) => a.getTime() - b.getTime());

    if (assessmentSlots.length < 2) {
      continue; // Need at least 2 slots for an assessment
    }

    // Optimization: Group slots by day to reduce redundant calculations
    const slotsByDay = new Map<string, Date[]>();
    for (const slot of assessmentSlots) {
      const dayKey = getStartOfDay(slot).toISOString();
      if (!slotsByDay.has(dayKey)) {
        slotsByDay.set(dayKey, []);
      }
      slotsByDay.get(dayKey)!.push(slot);
    }

    // Pre-filter days that have capacity and prepare for efficient pairing
    const eligibleDays: Array<{ dayKey: string; dayTime: number; slots: Date[] }> = [];

    for (const [dayKey, slots] of slotsByDay.entries()) {
      const representativeDate = new Date(dayKey);
      const existingCount = getAppointmentsOnDay(clinician, representativeDate);
      
      // Only include days where at least 1 more appointment can be scheduled
      if (existingCount + 1 <= clinician.maxDailyAppointments) {
        eligibleDays.push({
          dayKey,
          dayTime: representativeDate.getTime(),
          slots
        });
      }
    }

    // Need at least 2 eligible days to form pairs
    if (eligibleDays.length < 2) {
      continue;
    }

    // Sort by date for early termination optimization
    eligibleDays.sort((a, b) => a.dayTime - b.dayTime);

    // Find all valid pairs with optimizations
    const validPairs: AssessmentSlotPair[] = [];
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    
    for (let i = 0; i < eligibleDays.length; i++) {
      const day1 = eligibleDays[i];
      
      for (let j = i + 1; j < eligibleDays.length; j++) {
        const day2 = eligibleDays[j];
        
        // Early termination: if this day is >7 days from day1, all remaining will be too
        const daysDiff = day2.dayTime - day1.dayTime;
        if (daysDiff > sevenDaysMs) {
          break; // No need to check remaining days for this day1
        }
        
        // Create pairs from all slot combinations between these two days
        // We only need to check weekly capacity now (daily already verified)
        for (const slot1 of day1.slots) {
          for (const slot2 of day2.slots) {
            // Check if clinician can accommodate both appointments (weekly limits)
            if (!canAccommodateAppointments(clinician, [slot1, slot2])) {
              continue;
            }
            
            validPairs.push({
              session1: slot1,
              session2: slot2
            });
          }
        }
      }
    }

    if (validPairs.length > 0) {
      results.push({
        clinician,
        availableSlotPairs: validPairs
      });
    }
  }

  return results;
}

/**
 * Finds available therapy intake slots for a patient
 * 
 * @param patient - The patient seeking therapy
 * @param clinicians - Array of all clinicians
 * @returns Array of clinician availability with therapy slots
 */
export function findTherapySlots(
  patient: Patient,
  clinicians: Clinician[]
): { clinician: Clinician; availableSlots: Date[] }[] {
  const results: { clinician: Clinician; availableSlots: Date[] }[] = [];

  for (const clinician of clinicians) {
    // Filter: must be a therapist
    if (clinician.clinicianType !== "THERAPIST") {
      continue;
    }

    // Filter: must accept patient's insurance and operate in their state
    if (!isClinicianEligible(clinician, patient)) {
      continue;
    }

    // Get 60-minute slots only (therapy slots)
    const therapySlots = clinician.availableSlots
      .filter(slot => slot.length === 60)
      .map(slot => slot.date)
      .sort((a, b) => a.getTime() - b.getTime());

    if (therapySlots.length === 0) {
      continue;
    }

    // Group by day and optimize
    const slotsByDay = new Map<string, Date[]>();
    for (const slot of therapySlots) {
      const dayKey = getStartOfDay(slot).toISOString();
      if (!slotsByDay.has(dayKey)) {
        slotsByDay.set(dayKey, []);
      }
      slotsByDay.get(dayKey)!.push(slot);
    }

    const optimizedSlots: Date[] = [];
    for (const daySlots of slotsByDay.values()) {
      const optimized = optimizeSlots(daySlots, 60);
      optimizedSlots.push(...optimized);
    }

    optimizedSlots.sort((a, b) => a.getTime() - b.getTime());

    // Filter slots based on capacity constraints
    const availableSlots = optimizedSlots.filter(slot => 
      canAccommodateAppointments(clinician, [slot])
    );

    if (availableSlots.length > 0) {
      results.push({
        clinician,
        availableSlots
      });
    }
  }

  return results;
}
