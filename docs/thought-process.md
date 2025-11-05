# Thought Process & Analysis

## Requirements Analysis

### Core Business Requirements

1. **Appointment Types**
   - Therapists: 60-minute sessions (THERAPY_INTAKE, THERAPY_SIXTY_MINS)
   - Psychologists: 90-minute sessions (ASSESSMENT_SESSION_1, ASSESSMENT_SESSION_2)

2. **Scheduling Rules**
   - Therapy: Only THERAPY_INTAKE needs online scheduling (one session at a time)
   - Assessment: Book BOTH sessions together, different days, max 7 days apart

3. **Eligibility Constraints**
   - Clinician must operate in patient's state
   - Clinician must accept patient's insurance
   - Clinician type must match service type (therapist for therapy, psychologist for assessments)

4. **Capacity Constraints**
   - `maxDailyAppointments`: Hard limit per day
   - `maxWeeklyAppointments`: Hard limit per week (Monday-Sunday)

---

## Key Assumptions Made

### Time & Calendar Assumptions

1. **All dates/times are in UTC** - No timezone conversions needed for this implementation
2. **Week starts on Monday** - Used ISO 8601 standard for weekly capacity calculations
3. **Day boundaries at midnight UTC** - Not local time zones
4. **"No more than 7 days apart"** means ≤7 calendar days (not business days)
5. **"Different days"** means different calendar dates (could be 1 minute apart at midnight)
6. **Appointments don't span midnight** - An appointment is counted toward only ONE day (based on start time)
   - Example: 11:30 PM - 1:00 AM appointment counts only on the first day
   - Rationale: Healthcare typically avoids midnight-spanning slots; capacity is about daily workload
   - Alternative: Could overlap both days or add constraint to prevent booking after certain hour

### Capacity & Scheduling Assumptions

6. **Multiple appointment statuses count toward capacity**:
   - `UPCOMING`: Future appointments
   - `OCCURRED`: Past appointments (prevents exceeding limits throughout the day)
   - `LATE_CANCELLATION`: Cancelled late but still consumes capacity
   
7. **Excluded from capacity**:
   - `CANCELLED`: Properly cancelled with notice
   - `NO_SHOW`: Patient didn't show up
   - `RE_SCHEDULED`: Moved to different time (frees up this slot)

8. **Both assessment sessions count separately** toward daily/weekly limits

9. **Capacity checks are atomic** - No race condition handling (would need database-level locking in production)

10. **Capacity limit boundary**: Using `>` not `>=` (if at limit, can't add more)

### Slot Optimization Assumptions

11. **Greedy algorithm is optimal** for interval scheduling (mathematically proven)
12. **Slots start exactly at given time** and run for exactly `length` minutes
13. **Adjacent slots don't overlap** - 12:00-1:30 and 1:30-3:00 are valid
14. **Optimization applies per day** for therapy slots
15. **Assessment slots don't get pre-optimized** before pairing (each pair books different days)
16. **Available slots don't cross midnight** - Assumed EHR system won't create slots like 11:30 PM - 1:00 AM

### Business Logic Assumptions

17. **90-minute slots = psychologist, 60-minute slots = therapist** (per README)
18. **Clinician must match BOTH state AND insurance** (not "or")
19. **Patient books exactly 2 assessment sessions** at once
20. **No buffer time** between appointments needed
21. **Slots in availableSlots are pre-validated** by EHR system

### Data & Performance Assumptions

22. **All clinicians loaded into memory** with their slots and appointments
23. **Arrays can be iterated multiple times** (optimization over early implementation)
24. **Dates are valid JavaScript Date objects** (no null/undefined handling)
25. **O(n²) pairing acceptable** initially, optimized to O(n + d² × s²) later

---

## Edge Cases Considered

### Critical Edge Cases

1. **Appointments transitioning from UPCOMING → OCCURRED throughout the day**
   - **Problem**: Without counting OCCURRED appointments, daily limits could be exceeded
   - **Example**: Daily limit 5, already saw 2 (OCCURRED), has 3 UPCOMING
   - **Without fix**: System counts only 3, allows booking 2 more → 7 total (exceeds limit)
   - **Solution**: Count UPCOMING, OCCURRED, and LATE_CANCELLATION toward capacity

2. **Assessment pairs spanning two different weeks**
   - **Problem**: Booking 2 sessions might affect 2 different weekly limits
   - **Solution**: Check weekly capacity for both weeks if sessions span week boundary

3. **Multiple appointments on same day for assessment booking**
   - **Problem**: Both assessment sessions could theoretically be on same day
   - **Solution**: Explicitly enforce different days constraint

4. **Clinician at daily capacity but has available slots**
   - **Problem**: Available slots exist but daily limit reached
   - **Solution**: Pre-filter days without capacity before pairing

5. **Slots more than 7 days apart**
   - **Problem**: Unnecessary computation for invalid pairs
   - **Solution**: Early termination using sorted day list

### Handled Edge Cases

6. **Empty slots arrays** → Return no results
7. **Single slot available** → Can't form assessment pair
8. **All slots on same day** → Can't form assessment pair
9. **Clinician operates in multiple states** → Match patient's state
10. **Clinician accepts multiple insurances** → Match patient's insurance
11. **Week boundary calculations** → Monday 00:00 UTC start
12. **Overlapping therapy slots** → Apply greedy optimization per day
13. **Midnight-spanning appointments** → Counted toward single day (start date only)

### Not Handled (Out of Scope)

14. **Race conditions** during concurrent bookings
15. **Timezone conversions** (assumed UTC everywhere)
16. **Double-booking prevention** at write time
17. **Appointment cancellation workflows**
18. **Recurring appointment scheduling**
19. **Midnight-spanning appointment validation** (assumed EHR prevents this)

---

## Design Decisions

### Why Return Only Clinicians With Available Slots?

**Decision**: Only return clinicians who have bookable appointments

**Rationale**:
- User intent: "which times are available for them to book?"
- Better UX: No point showing clinicians with no availability
- Cleaner API: Consumers get actionable results only

**Alternative considered**: Return all eligible clinicians with `isFullyBooked` flag
- **Rejected**: Adds complexity without clear value for this use case

### Why Not Pre-Optimize Assessment Slots?

**Decision**: Show all valid assessment pairs, even if some slots overlap on same day

**Rationale**:
- Each pair books TWO different days (no same-day overlap issue)
- User chooses one specific pair (both times together)
- Optimization constraint doesn't apply across different days

**Example**: 
- Day 1: 12:00, 12:15, 12:30 (overlapping slots)
- Day 2: 2:00pm
- All Day 1 slots can pair with Day 2 slot validly

### Why Count OCCURRED Appointments?

**Decision**: Include OCCURRED status in capacity calculations

**Rationale**:
- Prevents exceeding daily limits as appointments transition states
- Real-world scenario: Clinician has limited daily capacity regardless of timing
- Example: Daily limit 5, saw 2 patients in morning (OCCURRED), has 3 UPCOMING → can only book 0 more

**Alternative considered**: Only count UPCOMING
- **Rejected**: Allows limit violations as day progresses

### Why Use Greedy Algorithm for Slot Optimization?

**Decision**: Earliest-ending-first greedy algorithm

**Rationale**:
- Mathematically proven optimal for interval scheduling
- O(n log n) complexity (sorting dominates)

**Alternative considered**: Dynamic programming
- **Rejected**: Same result, more complex, same time complexity

---

## Performance Considerations

### Initial Implementation

**Slot Pairing**: O(n²) where n = total slots
```typescript
for each slot1 in assessmentSlots:
  for each slot2 in assessmentSlots:
    // Check constraints and pair
```

**Problems**:
- Redundant `getStartOfDay()` calls (2n² times)
- No early termination
- Checks invalid pairs (same day, >7 days apart)

### Optimized Implementation

**Slot Pairing**: O(n + d² × s²) where d = unique days, s = slots per day

**Optimizations**:
1. **Group by day first** - O(n) grouping, d groups
2. **Pre-filter capacity** - O(d) capacity checks before pairing
3. **Sort days** - O(d log d) for early termination
4. **Early termination** - Break when days >7 apart
5. **Reduced complexity** - d << n typically (100 slots might be 10 days)

**Example Performance**:
- 100 slots across 10 days (10 slots/day)
- **Before**: ~10,000 iterations, 20,000 `getStartOfDay()` calls
- **After**: ~100 day-pair checks, 100 slot combinations per valid pair
- **Result**: ~10x faster

### Memory Optimization

**Initial**: Stored full date arrays in maps
```typescript
const datesByDay = new Map<string, Date[]>();
```

**Optimized**: Store only counts, reconstruct dates from ISO keys
```typescript
const countsByDay = new Map<string, number>();
const representativeDate = new Date(dayKey); // Reconstruct when needed
```

**Benefit**: Less memory, simpler code, same functionality

---

## Testing Strategy

### Test Coverage

1. **Task 1 (Assessment Slots)**
   - Valid pairs matching README example
   - Filter by insurance
   - Filter by state
   - No same-day pairs
   - No pairs >7 days apart
   - Filter non-psychologists

2. **Task 2 (Slot Optimization)**
   - Overlapping slots → optimized
   - Single slot → unchanged
   - Empty array → empty result
   - Already non-overlapping → unchanged
   - Different durations (60 vs 90 minutes)

3. **Task 3 (Capacity Constraints)**
   - Respect maxDailyAppointments
   - Respect maxWeeklyAppointments
   - Count UPCOMING, OCCURRED, LATE_CANCELLATION
   - Exclude CANCELLED, NO_SHOW, RE_SCHEDULED
   - **Critical**: OCCURRED prevents exceeding limits

4. **Therapy Slots**
   - Filter therapists only
   - Optimize slots per day
   - Respect capacity constraints

### Edge Cases Tested

- Multiple appointments on same day
- Appointments spanning multiple weeks
- Days at full capacity
- Clinicians with no availability
- Mix of different appointment statuses

---

## Future Considerations

### Scalability Issues

1. **In-memory limitations**: Current implementation loads all clinicians into memory
2. **No pagination**: Returns all results (could be hundreds of clinicians)
3. **No caching**: Recalculates everything on each request
4. **No concurrent booking protection**: Race conditions possible

### Recommended Improvements

See [production-considerations.md](./production-considerations.md) for detailed database-level implementation strategies using Prisma.

---

## Conclusion

The implementation prioritizes:
- ✅ **Correctness**: All business rules enforced, edge cases handled
- ✅ **Clarity**: Readable code with clear intent
- ✅ **Performance**: Optimized from O(n²) to O(n + d² × s²)
- ✅ **Testability**: Comprehensive test coverage

Trade-offs accepted:
- ⚠️ In-memory processing (acceptable for take-home, needs database for production)
- ⚠️ No race condition handling (requires database-level locking)
- ⚠️ No pagination (simple to add, see production considerations)
