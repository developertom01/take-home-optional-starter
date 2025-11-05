# Production Considerations & Optimizations

## Overview

This document outlines how to scale the current in-memory implementation to a production-ready system using **Prisma ORM** and **PostgreSQL**. It covers database design, query optimization, caching strategies, and concurrency handling.

---

## Current Implementation Limitations

### 1. In-Memory Processing
- ❌ Loads all clinicians, slots, and appointments into memory
- ❌ Doesn't scale beyond ~1,000 clinicians
- ❌ No pagination support
- ❌ Recalculates everything on each request

### 2. No Concurrency Control
- ❌ Race conditions possible during concurrent bookings
- ❌ No optimistic/pessimistic locking
- ❌ Could double-book slots

### 3. Performance Issues
- ❌ O(n) filtering per request
- ❌ Complex business logic in application layer
- ❌ No query optimization
- ❌ No caching layer

---

## Production Architecture

### Tech Stack

```
┌─────────────────────────────────────────────┐
│           Load Balancer (AWS ALB)           │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│        API Layer (Node.js + Express)        │
│  - Rate limiting                            │
│  - Input validation                         │
│  - Authentication/Authorization             │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│      Business Logic (TypeScript)            │
│  - Prisma ORM                               │
│  - Redis for caching                        │
│  - Bull for job queues                      │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼──────┐    ┌────────▼─────────┐
│  PostgreSQL  │    │   Redis Cache    │
│  (Primary)   │    │  - Query cache   │
│              │    │  - Session data  │
└──────────────┘    └──────────────────┘
```

---

## Database Optimization with Prisma

### 1. Efficient Slot Querying

#### Problem: Fetching Only Eligible Clinicians

**Current**: Fetch all clinicians, filter in code
```typescript
const allClinicians = await prisma.clinician.findMany({
  include: { availableSlots: true, appointments: true }
});
// Filter in application code
```

**Optimized**: Use Prisma's filtering
```typescript
const eligibleClinicians = await prisma.clinician.findMany({
  where: {
    clinicianType: 'PSYCHOLOGIST',
    states: {
      has: patient.state  // Array contains check
    },
    insurances: {
      has: patient.insurance
    },
    availableSlots: {
      some: {
        length: 90,
        date: {
          gte: new Date(),  // Only future slots
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)  // Next 30 days
        }
      }
    }
  },
  include: {
    availableSlots: {
      where: {
        length: 90,
        date: {
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { date: 'asc' }
    },
    appointments: {
      where: {
        status: { in: ['UPCOMING', 'OCCURRED', 'LATE_CANCELLATION'] },
        scheduledFor: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),  // Last 7 days
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)  // Next 30 days
        }
      }
    }
  },
  take: 50  // Pagination
});
```

**Benefits**:
- ✅ Only fetches relevant data
- ✅ Database does the filtering (faster)
- ✅ Reduces network transfer
- ✅ Supports pagination out of the box

---

### 2. Pagination Strategy

#### Cursor-Based Pagination (Recommended)

```typescript
async function findAssessmentSlotsWithPagination(
  patient: Patient,
  cursor?: string,
  pageSize: number = 10
): Promise<{
  results: ClinicianAvailability[];
  nextCursor?: string;
  hasMore: boolean;
}> {
  const results: ClinicianAvailability[] = [];
  let processedClinicians = 0;
  let currentCursor = cursor;
  
  while (results.length < pageSize && processedClinicians < 100) {
    // Fetch batch of eligible clinicians
    const clinicians = await prisma.clinician.findMany({
      where: {
        clinicianType: 'PSYCHOLOGIST',
        states: { has: patient.state },
        insurances: { has: patient.insurance },
        ...(currentCursor && {
          id: { gt: currentCursor }  // Cursor-based pagination
        })
      },
      include: {
        availableSlots: { /* ... */ },
        appointments: { /* ... */ }
      },
      take: 20,  // Fetch in batches
      orderBy: { id: 'asc' }
    });
    
    if (clinicians.length === 0) break;
    
    // Process each clinician
    for (const clinician of clinicians) {
      processedClinicians++;
      const validPairs = findValidPairsForClinician(clinician, patient);
      
      if (validPairs.length > 0) {
        results.push({ clinician, availableSlotPairs: validPairs });
        if (results.length >= pageSize) break;
      }
    }
    
    currentCursor = clinicians[clinicians.length - 1].id;
  }
  
  return {
    results,
    nextCursor: results.length >= pageSize ? currentCursor : undefined,
    hasMore: results.length >= pageSize
  };
}
```

**Benefits**:
- ✅ Consistent performance (no OFFSET scan)
- ✅ Works with filters
- ✅ No page drift issues
- ✅ Efficient for deep pagination

---

### 3. Complex Query Optimization

#### Use Raw SQL for Complex Capacity Checks

For production, move capacity checks to database level:

```typescript
// Prisma raw SQL with CTEs
const availableClinicians = await prisma.$queryRaw`
  WITH 
  -- Filter eligible clinicians
  eligible_clinicians AS (
    SELECT c.id, c."firstName", c."lastName", 
           c."maxDailyAppointments", c."maxWeeklyAppointments"
    FROM clinician c
    WHERE c."clinicianType" = 'PSYCHOLOGIST'
      AND ${patient.state}::text = ANY(c.states)
      AND ${patient.insurance}::text = ANY(c.insurances)
  ),
  
  -- Get 90-min slots
  assessment_slots AS (
    SELECT s.id, s."clinicianId", s.date,
           DATE_TRUNC('day', s.date) AS day,
           DATE_TRUNC('week', s.date) AS week
    FROM "AvailableSlot" s
    INNER JOIN eligible_clinicians ec ON s."clinicianId" = ec.id
    WHERE s.length = 90
      AND s.date >= NOW()
      AND s.date <= NOW() + INTERVAL '30 days'
  ),
  
  -- Count existing appointments by day
  appointments_per_day AS (
    SELECT a."clinicianId",
           DATE_TRUNC('day', a."scheduledFor") AS day,
           COUNT(*) AS count
    FROM "Appointment" a
    INNER JOIN eligible_clinicians ec ON a."clinicianId" = ec.id
    WHERE a.status IN ('UPCOMING', 'OCCURRED', 'LATE_CANCELLATION')
      AND a."scheduledFor" >= NOW()
      AND a."scheduledFor" <= NOW() + INTERVAL '30 days'
    GROUP BY a."clinicianId", DATE_TRUNC('day', a."scheduledFor")
  ),
  
  -- Count existing appointments by week
  appointments_per_week AS (
    SELECT a."clinicianId",
           DATE_TRUNC('week', a."scheduledFor") AS week,
           COUNT(*) AS count
    FROM "Appointment" a
    INNER JOIN eligible_clinicians ec ON a."clinicianId" = ec.id
    WHERE a.status IN ('UPCOMING', 'OCCURRED', 'LATE_CANCELLATION')
      AND a."scheduledFor" >= NOW()
      AND a."scheduledFor" <= NOW() + INTERVAL '30 days'
    GROUP BY a."clinicianId", DATE_TRUNC('week', a."scheduledFor")
  ),
  
  -- Filter slots that respect capacity
  available_slots AS (
    SELECT s.*
    FROM assessment_slots s
    INNER JOIN eligible_clinicians ec ON s."clinicianId" = ec.id
    LEFT JOIN appointments_per_day apd 
      ON s."clinicianId" = apd."clinicianId" AND s.day = apd.day
    LEFT JOIN appointments_per_week apw
      ON s."clinicianId" = apw."clinicianId" AND s.week = apw.week
    WHERE 
      -- Check daily capacity
      COALESCE(apd.count, 0) + 1 <= ec."maxDailyAppointments"
      -- Check weekly capacity
      AND COALESCE(apw.count, 0) + 1 <= ec."maxWeeklyAppointments"
  ),
  
  -- Create valid pairs
  slot_pairs AS (
    SELECT 
      s1."clinicianId",
      s1.date AS session1,
      s2.date AS session2
    FROM available_slots s1
    INNER JOIN available_slots s2 
      ON s1."clinicianId" = s2."clinicianId"
      AND s1.date < s2.date
      AND s1.day != s2.day
      AND s2.date - s1.date <= INTERVAL '7 days'
  )
  
  -- Return clinicians with slot pairs
  SELECT 
    ec.*,
    JSON_AGG(
      JSON_BUILD_OBJECT(
        'session1', sp.session1,
        'session2', sp.session2
      ) ORDER BY sp.session1, sp.session2
    ) AS "slotPairs"
  FROM eligible_clinicians ec
  INNER JOIN slot_pairs sp ON ec.id = sp."clinicianId"
  GROUP BY ec.id, ec."firstName", ec."lastName", 
           ec."maxDailyAppointments", ec."maxWeeklyAppointments"
  LIMIT ${pageSize}
  OFFSET ${(page - 1) * pageSize};
`;
```

**Benefits**:
- ✅ Single database round trip
- ✅ Leverages database indexes
- ✅ Complex logic handled by PostgreSQL
- ✅ Much faster than application-level filtering

---

### 4. Database Indexes

```prisma
model Clinician {
  id                    String   @id @default(uuid())
  clinicianType         ClinicianType
  states                UsState[]
  insurances            InsurancePayer[]
  maxDailyAppointments  Int
  maxWeeklyAppointments Int
  
  @@index([clinicianType, states, insurances])  // Composite index for filtering
  @@index([id, clinicianType])                  // For pagination
}

model AvailableSlot {
  id          String   @id @default(uuid())
  clinicianId String
  date        DateTime
  length      Int
  
  @@index([clinicianId, date, length])  // Primary query pattern
  @@index([date, length])                // For date range queries
}

model Appointment {
  id           String            @id @default(uuid())
  clinicianId  String
  scheduledFor DateTime
  status       AppointmentStatus
  
  @@index([clinicianId, scheduledFor, status])  // Capacity checks
  @@index([scheduledFor, status])               // Date range queries
}
```

---

## Caching Strategy

### 1. Redis Caching Layer

```typescript
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function findAssessmentSlotsWithCache(
  patient: Patient,
  page: number = 1
): Promise<ClinicianAvailability[]> {
  // Cache key based on patient criteria
  const cacheKey = `slots:assessment:${patient.state}:${patient.insurance}:page:${page}`;
  
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Cache miss - compute results
  const results = await findAssessmentSlots(patient, page);
  
  // Cache for 5 minutes (slots don't change frequently)
  await redis.setex(cacheKey, 300, JSON.stringify(results));
  
  return results;
}

// Invalidate cache when slots change
async function onSlotBooked(clinicianId: string) {
  // Invalidate all relevant cache keys
  const pattern = `slots:*`;
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
```

**Cache Strategy**:
- ✅ Cache query results for 5 minutes
- ✅ Invalidate on bookings/cancellations
- ✅ Separate cache per state/insurance combination
- ✅ Use Redis clusters for high availability

---

### 2. Materialized Views

For frequently accessed aggregations:

```sql
-- Create materialized view for daily capacity
CREATE MATERIALIZED VIEW clinician_daily_capacity AS
SELECT 
  c.id,
  DATE_TRUNC('day', a."scheduledFor") AS day,
  COUNT(*) AS appointment_count,
  c."maxDailyAppointments" - COUNT(*) AS remaining_capacity
FROM clinician c
LEFT JOIN "Appointment" a 
  ON c.id = a."clinicianId" 
  AND a.status IN ('UPCOMING', 'OCCURRED', 'LATE_CANCELLATION')
  AND a."scheduledFor" >= NOW()
  AND a."scheduledFor" <= NOW() + INTERVAL '30 days'
GROUP BY c.id, DATE_TRUNC('day', a."scheduledFor");

-- Refresh periodically (every 5 minutes)
REFRESH MATERIALIZED VIEW CONCURRENTLY clinician_daily_capacity;
```

**Benefits**:
- ✅ Pre-computed capacity data
- ✅ Much faster queries
- ✅ Refresh in background
- ✅ Read replicas can use views

---

## Concurrency Control

### 1. Optimistic Locking with Prisma

```typescript
// Add version field to schema
model AvailableSlot {
  id          String   @id @default(uuid())
  clinicianId String
  date        DateTime
  length      Int
  version     Int      @default(0)  // Optimistic lock version
  isBooked    Boolean  @default(false)
  
  @@unique([clinicianId, date, isBooked])
}

// Book with optimistic locking
async function bookAssessmentSlot(
  slotId: string,
  currentVersion: number
): Promise<boolean> {
  try {
    const result = await prisma.availableSlot.updateMany({
      where: {
        id: slotId,
        version: currentVersion,
        isBooked: false
      },
      data: {
        isBooked: true,
        version: { increment: 1 }
      }
    });
    
    return result.count > 0;  // True if update succeeded
  } catch (error) {
    // Concurrent modification detected
    return false;
  }
}
```

---

### 2. Pessimistic Locking (for Critical Sections)

```typescript
async function bookAssessmentWithLock(
  clinicianId: string,
  slot1Date: Date,
  slot2Date: Date,
  patientId: string
): Promise<boolean> {
  return await prisma.$transaction(async (tx) => {
    // Lock clinician row
    const clinician = await tx.clinician.findUnique({
      where: { id: clinicianId },
      include: {
        appointments: {
          where: {
            status: { in: ['UPCOMING', 'OCCURRED', 'LATE_CANCELLATION'] }
          }
        }
      }
    });
    
    if (!clinician) throw new Error('Clinician not found');
    
    // Re-check capacity with locked data
    if (!canAccommodateAppointments(clinician, [slot1Date, slot2Date])) {
      throw new Error('Capacity exceeded');
    }
    
    // Lock slots
    const slots = await tx.availableSlot.findMany({
      where: {
        clinicianId,
        date: { in: [slot1Date, slot2Date] },
        isBooked: false
      }
    });
    
    if (slots.length !== 2) {
      throw new Error('Slots no longer available');
    }
    
    // Create appointments
    await tx.appointment.createMany({
      data: [
        {
          patientId,
          clinicianId,
          scheduledFor: slot1Date,
          appointmentType: 'ASSESSMENT_SESSION_1',
          status: 'UPCOMING'
        },
        {
          patientId,
          clinicianId,
          scheduledFor: slot2Date,
          appointmentType: 'ASSESSMENT_SESSION_2',
          status: 'UPCOMING'
        }
      ]
    });
    
    // Mark slots as booked
    await tx.availableSlot.updateMany({
      where: {
        id: { in: slots.map(s => s.id) }
      },
      data: { isBooked: true }
    });
    
    return true;
  }, {
    isolationLevel: 'Serializable',  // Highest isolation level
    timeout: 10000  // 10 second timeout
  });
}
```

**Benefits**:
- ✅ Prevents double-booking
- ✅ Ensures capacity limits
- ✅ Atomic operation
- ✅ Automatic rollback on error

---

## Monitoring & Observability

### 1. Query Performance Monitoring

```typescript
// Prisma middleware for logging
prisma.$use(async (params, next) => {
  const before = Date.now();
  const result = await next(params);
  const after = Date.now();
  
  console.log(`Query ${params.model}.${params.action} took ${after - before}ms`);
  
  // Alert on slow queries
  if (after - before > 1000) {
    console.warn(`SLOW QUERY: ${params.model}.${params.action}`);
  }
  
  return result;
});
```

### 2. Key Metrics to Track

- Query response time (p50, p95, p99)
- Cache hit rate
- Database connection pool utilization
- Booking success rate
- Double-booking incidents
- API endpoint latency

---

## Deployment Checklist

### Database
- ✅ Set up read replicas for read-heavy queries
- ✅ Configure connection pooling (PgBouncer)
- ✅ Enable query logging for slow queries
- ✅ Set up automated backups
- ✅ Create indexes on foreign keys

### Application
- ✅ Implement rate limiting (per user/IP)
- ✅ Add request timeouts
- ✅ Configure connection pools
- ✅ Set up health checks
- ✅ Enable distributed tracing

### Caching
- ✅ Deploy Redis cluster
- ✅ Configure eviction policies
- ✅ Set up cache warming on deploy
- ✅ Monitor cache hit rates

### Monitoring
- ✅ Set up Datadog/New Relic
- ✅ Configure alerts for errors
- ✅ Track business metrics
- ✅ Set up log aggregation

---

## Cost Optimization

### 1. Database Costs
- Use read replicas for queries
- Archive old appointments (>6 months)
- Partition large tables by date
- Use appropriate instance sizes

### 2. Caching Costs
- Cache only frequently accessed data
- Use appropriate TTLs
- Monitor cache memory usage
- Consider CDN for static data

### 3. Compute Costs
- Auto-scale based on traffic
- Use spot instances for background jobs
- Optimize cold starts (serverless)
- Profile and optimize hot paths

---

## Summary

**For Production**:
1. ✅ Use Prisma with PostgreSQL for data layer
2. ✅ Implement cursor-based pagination
3. ✅ Move complex logic to SQL (CTEs)
4. ✅ Add Redis caching layer
5. ✅ Use transactions with optimistic locking
6. ✅ Create proper database indexes
7. ✅ Monitor query performance
8. ✅ Implement rate limiting
9. ✅ Set up read replicas
10. ✅ Use connection pooling

**Performance Targets**:
- API response time: <500ms (p95)
- Database queries: <100ms (p95)
- Cache hit rate: >80%
- Zero double-bookings
- 99.9% uptime

**Next Steps**:
1. Load test with realistic data (10,000+ clinicians)
2. Profile critical paths
3. Implement monitoring dashboards
4. Set up alerts for anomalies
5. Document runbook for incidents
