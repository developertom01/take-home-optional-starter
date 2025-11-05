# Documentation

## Quick Start

### 👀 Reviewing the Solution?
→ [thought-process.md](./thought-process.md) - Assumptions, edge cases, design decisions

### 🚀 Going to Production?
→ [production-considerations.md](./production-considerations.md) - Prisma, PostgreSQL, scaling strategies

---

## What's Included

### [thought-process.md](./thought-process.md)
- 25 documented assumptions
- Critical edge cases (OCCURRED counting, capacity limits)
- Performance optimization (O(n²) → O(n + d² × s²))
- Testing strategy

### [production-considerations.md](./production-considerations.md)
- Database schema & indexes
- Prisma query patterns with date ranges
- Cursor-based pagination
- SQL CTEs for complex queries
- Concurrency control (optimistic/pessimistic locking)
- Structured logging with Pino
- Monitoring & deployment checklist

---

## Key Decisions

**ADR-001**: Only return clinicians with available slots (better UX)  
**ADR-002**: Count OCCURRED appointments toward capacity (prevents limit violations)  
**ADR-003**: Show all valid assessment pairs (correct for cross-day bookings)  
**ADR-004**: Greedy algorithm for optimization (mathematically optimal, O(n log n))  
**ADR-005**: Group slots by day before pairing (10x performance improvement)
