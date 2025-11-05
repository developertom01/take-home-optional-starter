import { optimizeSlots, findAssessmentSlots, findTherapySlots } from "../scheduler";
import { Patient } from "../models/patient";
import { Clinician } from "../models/clinician";
import { AvailableAppointmentSlot } from "../models/appointment";

describe("Scheduler", () => {
  describe("Task 2: optimizeSlots", () => {
    it("should return non-overlapping slots that maximize appointments", () => {
      const dates = [
        new Date("2024-08-19T12:00:00.000Z"),
        new Date("2024-08-19T12:15:00.000Z"),
        new Date("2024-08-19T12:30:00.000Z"),
        new Date("2024-08-19T12:45:00.000Z"),
        new Date("2024-08-19T13:00:00.000Z"),
        new Date("2024-08-19T13:15:00.000Z"),
        new Date("2024-08-19T13:30:00.000Z")
      ];

      const result = optimizeSlots(dates, 90);

      expect(result).toHaveLength(2);
      expect(result[0].toISOString()).toBe("2024-08-19T12:00:00.000Z");
      expect(result[1].toISOString()).toBe("2024-08-19T13:30:00.000Z");
    });

    it("should handle single slot", () => {
      const dates = [new Date("2024-08-19T12:00:00.000Z")];
      const result = optimizeSlots(dates, 90);

      expect(result).toHaveLength(1);
      expect(result[0].toISOString()).toBe("2024-08-19T12:00:00.000Z");
    });

    it("should handle empty array", () => {
      const result = optimizeSlots([], 90);
      expect(result).toHaveLength(0);
    });

    it("should handle already non-overlapping slots", () => {
      const dates = [
        new Date("2024-08-19T12:00:00.000Z"),
        new Date("2024-08-19T14:00:00.000Z"),
        new Date("2024-08-19T16:00:00.000Z")
      ];

      const result = optimizeSlots(dates, 90);
      expect(result).toHaveLength(3);
    });

    it("should work with 60-minute appointments", () => {
      const dates = [
        new Date("2024-08-19T12:00:00.000Z"),
        new Date("2024-08-19T12:30:00.000Z"),
        new Date("2024-08-19T13:00:00.000Z"),
        new Date("2024-08-19T13:30:00.000Z")
      ];

      const result = optimizeSlots(dates, 60);
      expect(result).toHaveLength(2);
      expect(result[0].toISOString()).toBe("2024-08-19T12:00:00.000Z");
      expect(result[1].toISOString()).toBe("2024-08-19T13:00:00.000Z");
    });
  });

  describe("Task 1 & 3: findAssessmentSlots", () => {
    let patient: Patient;
    let psychologist: Clinician;

    beforeEach(() => {
      patient = {
        id: "patient-1",
        firstName: "Byrne",
        lastName: "Hollander",
        state: "NY",
        insurance: "AETNA",
        createdAt: new Date(),
        updatedAt: new Date()
      };

      psychologist = {
        id: "psychologist-1",
        firstName: "Jane",
        lastName: "Doe",
        states: ["NY", "CA"],
        insurances: ["AETNA", "CIGNA"],
        clinicianType: "PSYCHOLOGIST",
        appointments: [],
        availableSlots: [],
        maxDailyAppointments: 2,
        maxWeeklyAppointments: 8,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    it("should find valid assessment slot pairs matching the README example", () => {
      const slots: AvailableAppointmentSlot[] = [
        {
          id: "1",
          clinicianId: psychologist.id,
          date: new Date("2024-08-19T12:00:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "2",
          clinicianId: psychologist.id,
          date: new Date("2024-08-19T12:15:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "3",
          clinicianId: psychologist.id,
          date: new Date("2024-08-21T12:00:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "4",
          clinicianId: psychologist.id,
          date: new Date("2024-08-21T15:00:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "5",
          clinicianId: psychologist.id,
          date: new Date("2024-08-22T15:00:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "6",
          clinicianId: psychologist.id,
          date: new Date("2024-08-28T12:15:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      psychologist.availableSlots = slots;

      const results = findAssessmentSlots(patient, [psychologist]);

      expect(results).toHaveLength(1);
      expect(results[0].clinician.id).toBe(psychologist.id);
      expect(results[0].availableSlotPairs).toHaveLength(11);

      // Verify specific pairs from the README
      const pairs = results[0].availableSlotPairs;
      const pairStrings = pairs.map(p => 
        `${p.session1.toISOString()},${p.session2.toISOString()}`
      );

      expect(pairStrings).toContain("2024-08-19T12:00:00.000Z,2024-08-21T12:00:00.000Z");
      expect(pairStrings).toContain("2024-08-19T12:00:00.000Z,2024-08-21T15:00:00.000Z");
      expect(pairStrings).toContain("2024-08-22T15:00:00.000Z,2024-08-28T12:15:00.000Z");
    });

    it("should filter out psychologists who don't accept patient insurance", () => {
      psychologist.insurances = ["CIGNA", "BCBS"];
      psychologist.availableSlots = [
        {
          id: "1",
          clinicianId: psychologist.id,
          date: new Date("2024-08-19T12:00:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "2",
          clinicianId: psychologist.id,
          date: new Date("2024-08-21T12:00:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const results = findAssessmentSlots(patient, [psychologist]);
      expect(results).toHaveLength(0);
    });

    it("should filter out psychologists who don't operate in patient state", () => {
      psychologist.states = ["CA", "FL"];
      psychologist.availableSlots = [
        {
          id: "1",
          clinicianId: psychologist.id,
          date: new Date("2024-08-19T12:00:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "2",
          clinicianId: psychologist.id,
          date: new Date("2024-08-21T12:00:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const results = findAssessmentSlots(patient, [psychologist]);
      expect(results).toHaveLength(0);
    });

    it("should not pair slots on the same day", () => {
      psychologist.availableSlots = [
        {
          id: "1",
          clinicianId: psychologist.id,
          date: new Date("2024-08-19T12:00:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "2",
          clinicianId: psychologist.id,
          date: new Date("2024-08-19T15:00:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const results = findAssessmentSlots(patient, [psychologist]);
      expect(results).toHaveLength(0);
    });

    it("should not pair slots more than 7 days apart", () => {
      psychologist.availableSlots = [
        {
          id: "1",
          clinicianId: psychologist.id,
          date: new Date("2024-08-19T12:00:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "2",
          clinicianId: psychologist.id,
          date: new Date("2024-08-27T12:00:00.000Z"), // 8 days later
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const results = findAssessmentSlots(patient, [psychologist]);
      expect(results).toHaveLength(0);
    });

    it("should respect maxDailyAppointments constraint", () => {
      psychologist.maxDailyAppointments = 1;
      psychologist.appointments = [
        {
          id: "apt-1",
          patientId: "other-patient",
          clinicianId: psychologist.id,
          scheduledFor: new Date("2024-08-19T10:00:00.000Z"),
          appointmentType: "ASSESSMENT_SESSION_1",
          status: "UPCOMING",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      psychologist.availableSlots = [
        {
          id: "1",
          clinicianId: psychologist.id,
          date: new Date("2024-08-19T12:00:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "2",
          clinicianId: psychologist.id,
          date: new Date("2024-08-21T12:00:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const results = findAssessmentSlots(patient, [psychologist]);
      
      // Should not include any pairs with 2024-08-19 since it already has 1 appointment
      expect(results).toHaveLength(0);
    });

    it("should respect maxWeeklyAppointments constraint", () => {
      psychologist.maxWeeklyAppointments = 2;
      
      // Add 2 appointments in the week of Aug 19-25
      psychologist.appointments = [
        {
          id: "apt-1",
          patientId: "other-patient",
          clinicianId: psychologist.id,
          scheduledFor: new Date("2024-08-20T10:00:00.000Z"),
          appointmentType: "ASSESSMENT_SESSION_1",
          status: "UPCOMING",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "apt-2",
          patientId: "other-patient",
          clinicianId: psychologist.id,
          scheduledFor: new Date("2024-08-23T10:00:00.000Z"),
          appointmentType: "ASSESSMENT_SESSION_2",
          status: "UPCOMING",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      psychologist.availableSlots = [
        {
          id: "1",
          clinicianId: psychologist.id,
          date: new Date("2024-08-19T12:00:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "2",
          clinicianId: psychologist.id,
          date: new Date("2024-08-21T12:00:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const results = findAssessmentSlots(patient, [psychologist]);
      
      // Week is already full (2 appointments, max is 2), so can't add 2 more
      expect(results).toHaveLength(0);
    });

    it("should not count CANCELLED, NO_SHOW, or RE_SCHEDULED appointments for capacity", () => {
      psychologist.maxDailyAppointments = 2;
      psychologist.appointments = [
        {
          id: "apt-1",
          patientId: "other-patient",
          clinicianId: psychologist.id,
          scheduledFor: new Date("2024-08-19T10:00:00.000Z"),
          appointmentType: "ASSESSMENT_SESSION_1",
          status: "CANCELLED", // Not upcoming
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      psychologist.availableSlots = [
        {
          id: "1",
          clinicianId: psychologist.id,
          date: new Date("2024-08-19T12:00:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "2",
          clinicianId: psychologist.id,
          date: new Date("2024-08-21T12:00:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const results = findAssessmentSlots(patient, [psychologist]);
      
      // Cancelled appointment shouldn't count, so this should work
      expect(results).toHaveLength(1);
      expect(results[0].availableSlotPairs.length).toBeGreaterThan(0);
    });

    it("should count OCCURRED appointments toward capacity to prevent exceeding daily limit", () => {
      psychologist.maxDailyAppointments = 5;
      psychologist.appointments = [
        // 2 appointments already OCCURRED this morning
        {
          id: "apt-1",
          patientId: "other-patient-1",
          clinicianId: psychologist.id,
          scheduledFor: new Date("2024-08-19T09:00:00.000Z"),
          appointmentType: "ASSESSMENT_SESSION_1",
          status: "OCCURRED",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "apt-2",
          patientId: "other-patient-2",
          clinicianId: psychologist.id,
          scheduledFor: new Date("2024-08-19T10:00:00.000Z"),
          appointmentType: "ASSESSMENT_SESSION_1",
          status: "OCCURRED",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        // 2 UPCOMING appointments later
        {
          id: "apt-3",
          patientId: "other-patient-3",
          clinicianId: psychologist.id,
          scheduledFor: new Date("2024-08-19T14:00:00.000Z"),
          appointmentType: "ASSESSMENT_SESSION_1",
          status: "UPCOMING",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "apt-4",
          patientId: "other-patient-4",
          clinicianId: psychologist.id,
          scheduledFor: new Date("2024-08-19T16:00:00.000Z"),
          appointmentType: "ASSESSMENT_SESSION_1",
          status: "UPCOMING",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      psychologist.availableSlots = [
        {
          id: "1",
          clinicianId: psychologist.id,
          date: new Date("2024-08-19T12:00:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "2",
          clinicianId: psychologist.id,
          date: new Date("2024-08-21T12:00:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const results = findAssessmentSlots(patient, [psychologist]);
      
      // Already has 4 appointments on Aug 19 (2 OCCURRED + 2 UPCOMING)
      // Max is 5, but we need to book 1 more on Aug 19, which would make it 5 total
      // This should work - 4 existing + 1 new = 5 (at limit, but not over)
      expect(results).toHaveLength(1);
      expect(results[0].availableSlotPairs.length).toBeGreaterThan(0);
      
      // Now test when it should be blocked
      psychologist.appointments.push({
        id: "apt-5",
        patientId: "other-patient-5",
        clinicianId: psychologist.id,
        scheduledFor: new Date("2024-08-19T18:00:00.000Z"),
        appointmentType: "ASSESSMENT_SESSION_1",
        status: "UPCOMING",
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const results2 = findAssessmentSlots(patient, [psychologist]);
      
      // Now has 5 appointments on Aug 19 (2 OCCURRED + 3 UPCOMING)
      // Can't book another one on Aug 19 as it would exceed the limit
      expect(results2).toHaveLength(0);
    });

    it("should count LATE_CANCELLATION appointments toward capacity", () => {
      psychologist.maxDailyAppointments = 2;
      psychologist.appointments = [
        {
          id: "apt-1",
          patientId: "other-patient",
          clinicianId: psychologist.id,
          scheduledFor: new Date("2024-08-19T10:00:00.000Z"),
          appointmentType: "ASSESSMENT_SESSION_1",
          status: "LATE_CANCELLATION", // Still counts toward capacity
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      psychologist.availableSlots = [
        {
          id: "1",
          clinicianId: psychologist.id,
          date: new Date("2024-08-19T12:00:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "2",
          clinicianId: psychologist.id,
          date: new Date("2024-08-21T12:00:00.000Z"),
          length: 90,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const results = findAssessmentSlots(patient, [psychologist]);
      
      // 1 LATE_CANCELLATION + 1 new appointment = 2 (at limit)
      expect(results).toHaveLength(1);
      expect(results[0].availableSlotPairs.length).toBeGreaterThan(0);
    });

    it("should filter out therapists (only psychologists for assessments)", () => {
      const therapist: Clinician = {
        ...psychologist,
        id: "therapist-1",
        clinicianType: "THERAPIST",
        availableSlots: [
          {
            id: "1",
            clinicianId: "therapist-1",
            date: new Date("2024-08-19T12:00:00.000Z"),
            length: 60,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      };

      const results = findAssessmentSlots(patient, [therapist]);
      expect(results).toHaveLength(0);
    });
  });

  describe("findTherapySlots", () => {
    let patient: Patient;
    let therapist: Clinician;

    beforeEach(() => {
      patient = {
        id: "patient-1",
        firstName: "John",
        lastName: "Doe",
        state: "NY",
        insurance: "AETNA",
        createdAt: new Date(),
        updatedAt: new Date()
      };

      therapist = {
        id: "therapist-1",
        firstName: "Sarah",
        lastName: "Smith",
        states: ["NY"],
        insurances: ["AETNA"],
        clinicianType: "THERAPIST",
        appointments: [],
        availableSlots: [],
        maxDailyAppointments: 5,
        maxWeeklyAppointments: 20,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    it("should find therapy slots for eligible therapist", () => {
      therapist.availableSlots = [
        {
          id: "1",
          clinicianId: therapist.id,
          date: new Date("2024-08-19T12:00:00.000Z"),
          length: 60,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "2",
          clinicianId: therapist.id,
          date: new Date("2024-08-19T13:00:00.000Z"),
          length: 60,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const results = findTherapySlots(patient, [therapist]);

      expect(results).toHaveLength(1);
      expect(results[0].clinician.id).toBe(therapist.id);
      expect(results[0].availableSlots).toHaveLength(2);
    });

    it("should filter out psychologists (only therapists for therapy)", () => {
      const psychologist: Clinician = {
        ...therapist,
        id: "psychologist-1",
        clinicianType: "PSYCHOLOGIST",
        availableSlots: [
          {
            id: "1",
            clinicianId: "psychologist-1",
            date: new Date("2024-08-19T12:00:00.000Z"),
            length: 90,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      };

      const results = findTherapySlots(patient, [psychologist]);
      expect(results).toHaveLength(0);
    });

    it("should respect capacity constraints for therapy slots", () => {
      therapist.maxDailyAppointments = 1;
      therapist.appointments = [
        {
          id: "apt-1",
          patientId: "other-patient",
          clinicianId: therapist.id,
          scheduledFor: new Date("2024-08-19T10:00:00.000Z"),
          appointmentType: "THERAPY_INTAKE",
          status: "UPCOMING",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      therapist.availableSlots = [
        {
          id: "1",
          clinicianId: therapist.id,
          date: new Date("2024-08-19T12:00:00.000Z"),
          length: 60,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "2",
          clinicianId: therapist.id,
          date: new Date("2024-08-20T12:00:00.000Z"),
          length: 60,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const results = findTherapySlots(patient, [therapist]);

      // Should only show slot on Aug 20 (Aug 19 is at capacity)
      expect(results).toHaveLength(1);
      expect(results[0].availableSlots).toHaveLength(1);
      expect(results[0].availableSlots[0].toISOString()).toBe("2024-08-20T12:00:00.000Z");
    });
  });
});
