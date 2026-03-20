# MedConnect — AI Navigation Guide

## What This Project Is

MedConnect is a multi-tenant telehealth booking platform built by SJD Labs, LLC as a portfolio piece. It demonstrates healthcare domain expertise for freelance acquisition. All patient data is synthetic (Synthea-generated). See `specs/SPEC-INDEX.md` for the full specification index.

## Tech Stack

- **Monorepo:** Turborepo + pnpm
- **Backend:** NestJS 11 + Prisma 6 + PostgreSQL 16 (RLS) — `apps/api/`
- **Frontend:** Next.js 15 App Router + shadcn/ui + Tailwind CSS 4 — `apps/web/`
- **Shared:** Types, Zod schemas, constants — `packages/shared/`
- **UI Kit:** shadcn/ui components — `packages/ui/`
- **Database:** Prisma schema + migrations — `prisma/`
- **Video:** Twilio Video SDK (group rooms, waiting room pattern)
- **Payments:** Stripe Connect Express (1% platform fee)
- **Queue:** BullMQ + Redis (reminders, cleanup, calendar sync)
- **Real-time:** Socket.io via NestJS WebSocket Gateway + Redis adapter
- **Email:** Resend + React Email

## Architecture Quick Reference

**Multi-tenancy:** Shared PostgreSQL with Row-Level Security. Every practice-scoped table has `practice_id`. RLS enforced via `set_config('app.current_practice', id, TRUE)`.

**Auth:** JWT (RS256, 15min access + 7day refresh). Practice roles via `tenant_memberships` (OWNER/ADMIN/PROVIDER). Patients are users without membership.

**Core flow:** Patient → browse providers → select service → pick slot → intake form → pay → video consultation.

## Key Domain Concepts

| Concept | Description |
|---------|-------------|
| Practice | Tenant — a healthcare business. Root aggregate for all scoped data. |
| Provider | Healthcare professional. Has availability_rules, blocked_dates, services. |
| Patient | User with appointments but no tenant_membership for that practice. |
| Appointment | Central transaction entity. State machine: PENDING → CONFIRMED → IN_PROGRESS → COMPLETED. |
| Video Room | Twilio group room tied 1:1 to an appointment. Waiting room is a UI pattern. |
| Intake Form | JSONB template + submission. Linked to service, completed per appointment. |

## Project Structure

```
medconnect/
├── apps/api/              # NestJS backend
│   └── src/
│       ├── modules/       # Feature modules (one per domain)
│       │   ├── auth/
│       │   ├── practices/
│       │   ├── providers/
│       │   ├── services/
│       │   ├── appointments/
│       │   ├── video/
│       │   ├── intake/
│       │   ├── messaging/
│       │   ├── payments/
│       │   ├── notifications/
│       │   ├── calendar/
│       │   └── admin/
│       ├── common/        # Guards, interceptors, pipes, decorators
│       ├── prisma/        # PrismaService, extensions
│       └── jobs/          # BullMQ processors
├── apps/web/              # Next.js frontend
│   └── src/
│       ├── app/           # App Router pages
│       │   ├── (auth)/    # Login, register, verify
│       │   ├── (patient)/ # Patient portal
│       │   ├── (provider)/# Provider dashboard
│       │   ├── (admin)/   # Practice admin
│       │   ├── book/      # Public booking flow
│       │   └── compliance-roadmap/
│       ├── components/    # Page-specific components
│       ├── hooks/         # Custom React hooks
│       └── lib/           # API client, utils
├── packages/shared/       # Zod schemas, types, enums, constants
├── packages/ui/           # shadcn/ui design system
├── prisma/                # schema.prisma + migrations
├── scripts/               # seed.ts, synthea pipeline
└── specs/                 # All specification documents
```

## Specs → Code Mapping

| Spec | Implements |
|------|-----------|
| SRS-1 | Infrastructure, deployment, CI/CD, WebSocket setup |
| SRS-2 | `prisma/schema.prisma`, `packages/shared/` enums/types, API routes |
| SRS-3 | `appointments/`, `video/`, `payments/`, `jobs/`, availability engine |
| SRS-4 | `auth/`, `messaging/`, `notifications/`, `calendar/`, audit middleware |

## Commands

```bash
pnpm dev              # Start all dev servers
pnpm build            # Build all packages
pnpm lint             # Lint all packages
pnpm typecheck        # TypeScript check all packages
pnpm test             # Run all tests
pnpm db:migrate       # Run Prisma migrations
pnpm db:seed          # Seed with Synthea synthetic data
pnpm db:reset         # Reset + reseed database
```

## Coder Agent Limits

These areas are too complex for local coder agents — Opus must handle directly:

| Area | Why |
|------|-----|
| `apps/api/src/modules/appointments/` | Availability engine + slot reservation + state machine — cross-file coordination required |
| `apps/api/src/modules/payments/` | Stripe Connect integration, application fees, webhook processing — financial correctness critical |
| `apps/api/src/modules/video/` | Twilio room lifecycle tied to appointment state machine — timing and state coupling |
| `apps/api/src/common/` | Guards, interceptors, pipes shared across all modules — blast radius of changes is high |
| `apps/api/src/prisma/` | PrismaService, RLS extensions, tenant context — foundational to all data access |
| `prisma/schema.prisma` | Central schema — changes cascade to generated types, migrations, and all modules |
| Prisma migration files | Never edit directly — always use `pnpm db:migrate` |
| `packages/shared/` schemas that touch >3 modules | Zod schemas imported by both API and web — breaking changes propagate everywhere |
| Changes touching RLS policies | Row-Level Security misconfiguration = data leak across practices |
| `apps/web/src/app/book/` | Multi-step booking flow (slot → intake → pay → confirm) — complex client state coordination |

## Non-Obvious Conventions

- **Prisma migrations are immutable** — never edit files in `prisma/migrations/`. Generate new migrations only.
- **RLS context must be set per-request** — `set_config('app.current_practice', id, TRUE)` before any practice-scoped query. Missing this = cross-tenant data leak.
- **Appointment state machine is strict** — PENDING → CONFIRMED → IN_PROGRESS → COMPLETED. No skipping states. Cancellation allowed from PENDING or CONFIRMED only.
- **Video rooms are lazy** — created on CONFIRMED, not on booking. Never pre-allocate Twilio rooms.
- **Slot reservations are ephemeral** — 10-minute TTL, cleaned by a BullMQ job every minute. Don't treat them as durable bookings.
- **Demo banner is mandatory** — all patient data is synthetic (Synthea). Every page must show the demo banner. Never remove it.
- **Stripe fees are exact** — `application_fee_amount` = 1% of payment amount. No rounding shortcuts.
- **Enums live in `packages/shared/`** — both API and web import from there. Never define enums locally in a single app.

## Conventions

- **Module pattern:** Each NestJS module is self-contained: controller, service, DTOs, guards.
- **Validation:** Zod schemas in `packages/shared/`, imported by both API and web.
- **Error handling:** Domain errors extend a base `AppError` class with HTTP status codes.
- **Naming:** snake_case for DB columns, camelCase for TypeScript, kebab-case for files.
- **Testing:** Vitest for unit/integration, Playwright for E2E. Factory functions for test data.
- **Audit:** All state transitions and PHI access logged via `AuditService`.

## Critical Invariants

1. Every practice-scoped table MUST have `practice_id` with RLS enabled
2. Appointment uniqueness: `UNIQUE(provider_profile_id, start_time)` prevents double-booking
3. Slot reservations expire in 10 minutes — `cleanExpiredReservations` job runs every minute
4. Video rooms are created on CONFIRMED, not on booking — room lifecycle follows appointment lifecycle
5. All patient data is synthetic — demo banner on every page is mandatory
6. Stripe `application_fee_amount` = 1% of payment amount on every transaction
