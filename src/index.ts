import { findAssessmentSlots, findTherapySlots } from "./scheduler";
import { patient } from "./models/mock-patient";
import { clinician } from "./models/mock-clinician";
import { MOCK_SLOT_DATA } from "./models/mock-slot-data";
import { AvailableAppointmentSlot } from "./models/appointment";
import { Clinician } from "./models/clinician";

// Convert mock slot data to proper AvailableAppointmentSlot format
const availableSlots: AvailableAppointmentSlot[] = MOCK_SLOT_DATA.map((slot, index) => ({
  id: `slot-${index}`,
  clinicianId: clinician.id,
  date: new Date(slot.date),
  length: slot.length,
  createdAt: new Date(),
  updatedAt: new Date()
}));

// Create a therapist clinician with 60-minute slots
const therapistSlots: AvailableAppointmentSlot[] = [
  {
    id: "therapy-1",
    clinicianId: "therapist-123",
    date: new Date("2024-08-19T14:00:00.000Z"),
    length: 60,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "therapy-2",
    clinicianId: "therapist-123",
    date: new Date("2024-08-20T10:00:00.000Z"),
    length: 60,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "therapy-3",
    clinicianId: "therapist-123",
    date: new Date("2024-08-20T15:00:00.000Z"),
    length: 60,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "therapy-4",
    clinicianId: "therapist-123",
    date: new Date("2024-08-21T09:00:00.000Z"),
    length: 60,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "therapy-5",
    clinicianId: "therapist-123",
    date: new Date("2024-08-22T16:00:00.000Z"),
    length: 60,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const therapist: Clinician = {
  id: "therapist-123",
  firstName: "Sarah",
  lastName: "Johnson",
  clinicianType: "THERAPIST",
  states: ["NY", "NJ", "CT"],
  insurances: ["AETNA", "UNITED", "BCBS"],
  maxDailyAppointments: 6,
  maxWeeklyAppointments: 25,
  availableSlots: therapistSlots,
  appointments: [],
  createdAt: new Date(),
  updatedAt: new Date()
};

// Assign slots to psychologist
const psychologistWithSlots = {
  ...clinician,
  availableSlots
};

console.log("=".repeat(80));
console.log("PROSPER HEALTH APPOINTMENT SCHEDULER");
console.log("=".repeat(80));

console.log("\n📋 PATIENT INFORMATION");
console.log("-".repeat(80));
console.log(`Name: ${patient.firstName} ${patient.lastName}`);
console.log(`State: ${patient.state}`);
console.log(`Insurance: ${patient.insurance}`);

// ============================================================================
// THERAPY INTAKE SLOTS
// ============================================================================
console.log("\n" + "=".repeat(80));
console.log("🩺 FINDING THERAPY INTAKE SLOTS");
console.log("=".repeat(80));

console.log("\n👨‍⚕️ THERAPIST INFORMATION");
console.log("-".repeat(80));
console.log(`Name: ${therapist.firstName} ${therapist.lastName}`);
console.log(`Type: ${therapist.clinicianType}`);
console.log(`States: ${therapist.states.join(", ")}`);
console.log(`Insurances: ${therapist.insurances.join(", ")}`);
console.log(`Max Daily Appointments: ${therapist.maxDailyAppointments}`);
console.log(`Max Weekly Appointments: ${therapist.maxWeeklyAppointments}`);
console.log(`Available Slots: ${therapist.availableSlots.length}`);

console.log("\n🔍 SEARCHING FOR THERAPY SLOTS...");
console.log("-".repeat(80));

const therapyResults = findTherapySlots(patient, [therapist]);

if (therapyResults.length === 0) {
  console.log("❌ No available therapy slots found.");
} else {
  for (const result of therapyResults) {
    console.log(`\n✅ ${result.clinician.firstName} ${result.clinician.lastName}`);
    console.log(`   Found ${result.availableSlots.length} available therapy intake slots:\n`);
    
    result.availableSlots.forEach((slot, index) => {
      console.log(`   ${index + 1}. ${slot.toISOString()}`);
    });
  }
}

// ============================================================================
// ASSESSMENT SLOTS (PSYCHOLOGIST)
// ============================================================================
console.log("\n" + "=".repeat(80));
console.log("🧠 FINDING ASSESSMENT SLOTS (PSYCHOLOGIST)");
console.log("=".repeat(80));

console.log("\n👨‍⚕️ PSYCHOLOGIST INFORMATION");
console.log("-".repeat(80));
console.log(`Name: Dr. ${psychologistWithSlots.firstName} ${psychologistWithSlots.lastName}`);
console.log(`Type: ${psychologistWithSlots.clinicianType}`);
console.log(`States: ${psychologistWithSlots.states.join(", ")}`);
console.log(`Insurances: ${psychologistWithSlots.insurances.join(", ")}`);
console.log(`Max Daily Appointments: ${psychologistWithSlots.maxDailyAppointments}`);
console.log(`Max Weekly Appointments: ${psychologistWithSlots.maxWeeklyAppointments}`);
console.log(`Current Appointments: ${psychologistWithSlots.appointments.length}`);
console.log(`Available Slots: ${psychologistWithSlots.availableSlots.length}`);

// Find assessment slots
console.log("\n🔍 SEARCHING FOR ASSESSMENT SLOT PAIRS...");
console.log("-".repeat(80));

const assessmentResults = findAssessmentSlots(patient, [psychologistWithSlots]);

if (assessmentResults.length === 0) {
  console.log("❌ No available assessment slots found.");
} else {
  for (const result of assessmentResults) {
    console.log(`\n✅ Dr. ${result.clinician.firstName} ${result.clinician.lastName}`);
    console.log(`   Found ${result.availableSlotPairs.length} valid assessment slot pairs:\n`);
    
    // Show first 10 pairs as examples
    const pairsToShow = result.availableSlotPairs.slice(0, 10);
    
    pairsToShow.forEach((pair, index) => {
      const session1 = pair.session1.toISOString();
      const session2 = pair.session2.toISOString();
      const daysBetween = Math.abs(
        pair.session2.getTime() - pair.session1.getTime()
      ) / (1000 * 60 * 60 * 24);
      
      console.log(`   ${index + 1}. Session 1: ${session1}`);
      console.log(`      Session 2: ${session2}`);
      console.log(`      (${daysBetween.toFixed(1)} days apart)\n`);
    });
    
    if (result.availableSlotPairs.length > 10) {
      console.log(`   ... and ${result.availableSlotPairs.length - 10} more pairs`);
    }
  }
}

console.log("\n" + "=".repeat(80));
console.log("📝 TESTING WITH MULTIPLE CLINICIANS & SCENARIOS");
console.log("=".repeat(80));

// ============================================================================
// Test Clinician 1: The 6 specific slots from README
// ============================================================================
const testSlots1: AvailableAppointmentSlot[] = [
  {
    id: "test1-1",
    clinicianId: "test-clinician-1",
    date: new Date("2024-08-19T12:00:00.000Z"),
    length: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "test1-2",
    clinicianId: "test-clinician-1",
    date: new Date("2024-08-19T12:15:00.000Z"),
    length: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "test1-3",
    clinicianId: "test-clinician-1",
    date: new Date("2024-08-21T12:00:00.000Z"),
    length: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "test1-4",
    clinicianId: "test-clinician-1",
    date: new Date("2024-08-21T15:00:00.000Z"),
    length: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "test1-5",
    clinicianId: "test-clinician-1",
    date: new Date("2024-08-22T15:00:00.000Z"),
    length: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "test1-6",
    clinicianId: "test-clinician-1",
    date: new Date("2024-08-28T12:15:00.000Z"),
    length: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const testClinician1: Clinician = {
  id: "test-clinician-1",
  firstName: "Alice",
  lastName: "Smith",
  clinicianType: "PSYCHOLOGIST",
  states: ["NY"],
  insurances: ["AETNA"],
  maxDailyAppointments: 3,
  maxWeeklyAppointments: 10,
  availableSlots: testSlots1,
  appointments: [],
  createdAt: new Date(),
  updatedAt: new Date()
};

// ============================================================================
// Test Clinician 2: Slots too far apart (>7 days)
// ============================================================================
const testSlots2: AvailableAppointmentSlot[] = [
  {
    id: "test2-1",
    clinicianId: "test-clinician-2",
    date: new Date("2024-08-19T10:00:00.000Z"),
    length: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "test2-2",
    clinicianId: "test-clinician-2",
    date: new Date("2024-08-30T10:00:00.000Z"), // 11 days apart
    length: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const testClinician2: Clinician = {
  id: "test-clinician-2",
  firstName: "Bob",
  lastName: "Wilson",
  clinicianType: "PSYCHOLOGIST",
  states: ["NY"],
  insurances: ["AETNA"],
  maxDailyAppointments: 3,
  maxWeeklyAppointments: 10,
  availableSlots: testSlots2,
  appointments: [],
  createdAt: new Date(),
  updatedAt: new Date()
};

// ============================================================================
// Test Clinician 3: Slots on same day (should be filtered)
// ============================================================================
const testSlots3: AvailableAppointmentSlot[] = [
  {
    id: "test3-1",
    clinicianId: "test-clinician-3",
    date: new Date("2024-08-19T10:00:00.000Z"),
    length: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "test3-2",
    clinicianId: "test-clinician-3",
    date: new Date("2024-08-19T14:00:00.000Z"), // Same day
    length: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "test3-3",
    clinicianId: "test-clinician-3",
    date: new Date("2024-08-20T10:00:00.000Z"),
    length: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const testClinician3: Clinician = {
  id: "test-clinician-3",
  firstName: "Carol",
  lastName: "Davis",
  clinicianType: "PSYCHOLOGIST",
  states: ["NY"],
  insurances: ["AETNA"],
  maxDailyAppointments: 3,
  maxWeeklyAppointments: 10,
  availableSlots: testSlots3,
  appointments: [],
  createdAt: new Date(),
  updatedAt: new Date()
};

// ============================================================================
// Test Clinician 4: Optimal slots (consecutive days)
// ============================================================================
const testSlots4: AvailableAppointmentSlot[] = [
  {
    id: "test4-1",
    clinicianId: "test-clinician-4",
    date: new Date("2024-08-19T09:00:00.000Z"),
    length: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "test4-2",
    clinicianId: "test-clinician-4",
    date: new Date("2024-08-20T09:00:00.000Z"),
    length: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "test4-3",
    clinicianId: "test-clinician-4",
    date: new Date("2024-08-21T09:00:00.000Z"),
    length: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const testClinician4: Clinician = {
  id: "test-clinician-4",
  firstName: "David",
  lastName: "Martinez",
  clinicianType: "PSYCHOLOGIST",
  states: ["NY"],
  insurances: ["AETNA"],
  maxDailyAppointments: 3,
  maxWeeklyAppointments: 10,
  availableSlots: testSlots4,
  appointments: [],
  createdAt: new Date(),
  updatedAt: new Date()
};

// ============================================================================
// Run tests for all clinicians
// ============================================================================
const testClinicians = [testClinician1, testClinician2, testClinician3, testClinician4];
const testResults = findAssessmentSlots(patient, testClinicians);

console.log("\n📊 TEST RESULTS:");
console.log("-".repeat(80));

testResults.forEach((result) => {
  const pairs = result.availableSlotPairs;
  console.log(`\n👨‍⚕️ Dr. ${result.clinician.firstName} ${result.clinician.lastName}`);
  console.log(`   Slots: ${result.clinician.availableSlots.length}`);
  console.log(`   Valid Pairs: ${pairs.length}`);
  
  if (pairs.length > 0) {
    console.log(`   Pairs:`);
    pairs.forEach((pair, index) => {
      const daysBetween = Math.abs(
        pair.session2.getTime() - pair.session1.getTime()
      ) / (1000 * 60 * 60 * 24);
      console.log(`     ${index + 1}. ${pair.session1.toISOString()} → ${pair.session2.toISOString()} (${daysBetween.toFixed(1)} days)`);
    });
  }
});

// ============================================================================
// Verify Test Clinician 1 matches expected pairs from README
// ============================================================================
console.log("\n" + "-".repeat(80));
console.log("✅ VALIDATION: Test Clinician 1 (6 slots from README)");
console.log("-".repeat(80));

const clinician1Result = testResults.find(r => r.clinician.id === "test-clinician-1");
if (clinician1Result) {
  const pairs = clinician1Result.availableSlotPairs;
  const expectedCount = 11;
  
  console.log(`Expected: ${expectedCount} pairs`);
  console.log(`Found: ${pairs.length} pairs`);
  console.log(`${pairs.length === expectedCount ? "✅" : "❌"} Match: ${pairs.length === expectedCount ? "PASS" : "FAIL"}`);
} else {
  console.log("❌ No results for Test Clinician 1");
}

console.log("\n" + "=".repeat(80));
