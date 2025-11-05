import { findAssessmentSlots } from "./scheduler";
import { patient } from "./models/mock-patient";
import { clinician } from "./models/mock-clinician";
import { MOCK_SLOT_DATA } from "./models/mock-slot-data";
import { AvailableAppointmentSlot } from "./models/appointment";

// Convert mock slot data to proper AvailableAppointmentSlot format
const availableSlots: AvailableAppointmentSlot[] = MOCK_SLOT_DATA.map((slot, index) => ({
  id: `slot-${index}`,
  clinicianId: clinician.id,
  date: new Date(slot.date),
  length: slot.length,
  createdAt: new Date(),
  updatedAt: new Date()
}));

// Assign slots to clinician
const clinicianWithSlots = {
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

console.log("\n👨‍⚕️ CLINICIAN INFORMATION");
console.log("-".repeat(80));
console.log(`Name: Dr. ${clinicianWithSlots.firstName} ${clinicianWithSlots.lastName}`);
console.log(`Type: ${clinicianWithSlots.clinicianType}`);
console.log(`States: ${clinicianWithSlots.states.join(", ")}`);
console.log(`Insurances: ${clinicianWithSlots.insurances.join(", ")}`);
console.log(`Max Daily Appointments: ${clinicianWithSlots.maxDailyAppointments}`);
console.log(`Max Weekly Appointments: ${clinicianWithSlots.maxWeeklyAppointments}`);
console.log(`Current Appointments: ${clinicianWithSlots.appointments.length}`);
console.log(`Available Slots: ${clinicianWithSlots.availableSlots.length}`);

// Find assessment slots
console.log("\n🔍 FINDING ASSESSMENT SLOTS...");
console.log("-".repeat(80));

const assessmentResults = findAssessmentSlots(patient, [clinicianWithSlots]);

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
console.log("Example: Testing with the 6 specific slots from the README");
console.log("=".repeat(80));

// Create a test scenario with the exact 6 slots mentioned in the README
const testSlots: AvailableAppointmentSlot[] = [
  {
    id: "test-1",
    clinicianId: clinician.id,
    date: new Date("2024-08-19T12:00:00.000Z"),
    length: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "test-2",
    clinicianId: clinician.id,
    date: new Date("2024-08-19T12:15:00.000Z"),
    length: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "test-3",
    clinicianId: clinician.id,
    date: new Date("2024-08-21T12:00:00.000Z"),
    length: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "test-4",
    clinicianId: clinician.id,
    date: new Date("2024-08-21T15:00:00.000Z"),
    length: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "test-5",
    clinicianId: clinician.id,
    date: new Date("2024-08-22T15:00:00.000Z"),
    length: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "test-6",
    clinicianId: clinician.id,
    date: new Date("2024-08-28T12:15:00.000Z"),
    length: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const testClinician = {
  ...clinician,
  availableSlots: testSlots
};

const testResults = findAssessmentSlots(patient, [testClinician]);

console.log("\n📊 TEST RESULTS:");
console.log("-".repeat(80));

if (testResults.length > 0) {
  const pairs = testResults[0].availableSlotPairs;
  console.log(`✅ Found ${pairs.length} valid pairs (Expected: 11)\n`);
  
  pairs.forEach((pair, index) => {
    console.log(`${index + 1}. ("${pair.session1.toISOString()}", "${pair.session2.toISOString()}")`);
  });
  
  // Verify we got the expected pairs
  const expectedPairs = [
    ["2024-08-19T12:00:00.000Z", "2024-08-21T12:00:00.000Z"],
    ["2024-08-19T12:00:00.000Z", "2024-08-21T15:00:00.000Z"],
    ["2024-08-19T12:00:00.000Z", "2024-08-22T15:00:00.000Z"],
    ["2024-08-19T12:15:00.000Z", "2024-08-21T12:00:00.000Z"],
    ["2024-08-19T12:15:00.000Z", "2024-08-21T15:00:00.000Z"],
    ["2024-08-19T12:15:00.000Z", "2024-08-22T15:00:00.000Z"],
    ["2024-08-21T12:00:00.000Z", "2024-08-22T15:00:00.000Z"],
    ["2024-08-21T12:00:00.000Z", "2024-08-28T12:15:00.000Z"],
    ["2024-08-21T15:00:00.000Z", "2024-08-22T15:00:00.000Z"],
    ["2024-08-21T15:00:00.000Z", "2024-08-28T12:15:00.000Z"],
    ["2024-08-22T15:00:00.000Z", "2024-08-28T12:15:00.000Z"]
  ];
  
  console.log(`\n${pairs.length === expectedPairs.length ? "✅" : "❌"} Match: ${pairs.length === expectedPairs.length ? "Yes" : "No"}`);
} else {
  console.log("❌ No pairs found (Expected: 11)");
}

console.log("\n" + "=".repeat(80));
