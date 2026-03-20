# MedConnect

**Multi-tenant telehealth booking platform** — appointment scheduling, video consultations, payments, real-time messaging, and practice management in a single system.

Built by [SJD Labs, LLC](https://github.com/stephendeslate) as a portfolio piece demonstrating healthcare domain expertise, HIPAA-aware architecture, and production-grade multi-tenant SaaS.

> **Demo Notice:** All patient data in this application is synthetic, generated via [Synthea](https://synthetichealth.github.io/synthea/). No real patient information is stored or displayed.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [API Endpoints](#api-endpoints)
- [Frontend Routes](#frontend-routes)
- [Background Jobs](#background-jobs)
- [Real-Time Events](#real-time-events)
- [Testing](#testing)
- [Deployment](#deployment)
- [Specifications](#specifications)

---

## Overview

MedConnect enables healthcare practices to:

- **Manage providers and services** with role-based access (Owner, Admin, Provider)
- **Accept online bookings** through a public booking page with real-time slot availability
- **Conduct video consultations** via Twilio Video with waiting room, device check, and participant management
- **Process payments** through Stripe Connect with a 1% platform fee
- **Collect intake forms** with customizable JSONB templates submitted before appointments
- **Communicate securely** with real-time messaging between providers and patients
- **Sync calendars** with Google Calendar for availability and appointment management
- **Track everything** with append-only audit logging of all state transitions and PHI access

### Core Flow

```
Patient → Browse providers → Select service → Pick time slot → Complete intake form → Pay → Join video consultation
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Monorepo** | Turborepo + pnpm | pnpm 10.x |
| **Backend** | NestJS | 11.x |
| **Frontend** | Next.js (App Router) | 15.x |
| **Database** | PostgreSQL with Row-Level Security | 16 |
| **ORM** | Prisma | 6.x |
| **Cache/Queue** | Redis + BullMQ | Redis 7.2 |
| **UI Components** | shadcn/ui + Tailwind CSS | Tailwind 4.x |
| **Video** | Twilio Video SDK | Group rooms |
| **Payments** | Stripe Connect Express | PaymentIntents |
| **Real-time** | Socket.io via NestJS Gateway | Redis adapter |
| **Email** | Resend + React Email | 16 templates |
| **Auth** | JWT RS256 + refresh token rotation | 15min/7day |
| **Validation** | Zod | Shared schemas |
| **Testing** | Vitest + Playwright | Unit/Integration/E2E |
| **CI/CD** | GitHub Actions → Fly.io + Vercel | 3 workflows |

---

## Architecture

### Multi-Tenancy

Shared PostgreSQL database with **Row-Level Security (RLS)**. Every practice-scoped table has a `practice_id` column. RLS policies are enforced via session variables set per-request:

```sql
SET LOCAL app.current_practice = '<practice_id>';
SET LOCAL app.current_user = '<user_id>';
```

A Prisma Client Extension automatically sets these variables before any practice-scoped query, ensuring complete tenant isolation at the database level.

### Authentication

- **JWT RS256** with asymmetric key pairs (auto-generated in development)
- **Access tokens**: 15-minute TTL, payload contains `{sub, email, role}`
- **Refresh tokens**: 7-day TTL, SHA-256 hashed in database, rotation on every use
- **Family revocation**: Token reuse triggers revocation of the entire refresh token family
- **Google OAuth**: Passport strategy with account linking by email or `google_id`
- **Rate limiting**: 4 tiers via `@nestjs/throttler` with Redis store (public 100/min, auth 10/min, API 500/min, webhook 200/min)

### Authorization

- **RBAC Guards**: `JwtAuthGuard`, `RolesGuard`, `PracticeRolesGuard`, `ParticipantGuard`
- **Practice Roles**: `OWNER` → `ADMIN` → `PROVIDER` (hierarchical via `tenant_memberships`)
- **Patients**: Users without a `tenant_membership` for a given practice
- **Decorators**: `@Roles()`, `@PracticeRoles()`, `@CurrentUser()`

### Appointment State Machine

```
PENDING → CONFIRMED → IN_PROGRESS → COMPLETED
   ↓          ↓
CANCELLED  CANCELLED
              ↓
           NO_SHOW
```

- **PENDING → CONFIRMED**: Auto (if `AUTO_CONFIRM`) or manual approval within 48 hours
- **CONFIRMED → IN_PROGRESS**: Provider or patient joins video room
- **IN_PROGRESS → COMPLETED**: Auto-detected when video session ends or appointment time passes
- **NO_SHOW**: Auto-detected 15 minutes past end time with no check-in (video appointments)
- **Cancellation**: Allowed from PENDING or CONFIRMED only; policy evaluates free window vs. late fee

### External Service Abstraction

All external services operate behind abstraction layers with mock implementations:

| Service | Interface | Real Provider | Mock Behavior |
|---------|----------|---------------|---------------|
| Video | `VideoProvider` | `TwilioVideoProvider` | `MockVideoProvider` — in-memory rooms |
| Payments | `PaymentService` | Stripe Connect | Mock — always succeeds, logs to console |
| Email | `EmailService` | Resend | Mock — stores in-memory, accessible in tests |
| SMS | `SmsService` | Twilio SMS | Mock — stores in-memory |
| Storage | `UploadService` | Cloudflare R2 | Mock — returns placeholder URLs |
| Calendar | `CalendarService` | Google Calendar API | Stub — no-op sync |

Mock mode activates automatically when the corresponding environment variables are not set.

---

## Features

### For Patients
- Self-service appointment booking with real-time slot availability
- 6-step booking wizard: provider → service → time → patient info → intake form → payment
- 10-minute slot reservation with countdown timer to prevent double-booking
- Video consultation with device check and waiting room
- Secure real-time messaging with providers
- Appointment management (view, cancel, reschedule)
- Payment history and receipts
- Email notifications for confirmations, reminders, and follow-ups

### For Providers
- Daily appointment timeline and patient queue
- Appointment detail view with clinical notes
- Availability management (recurring rules, blocked dates, buffer times)
- Real-time messaging with patients
- Calendar sync with Google Calendar
- Profile management (specialties, bio, credentials)

### For Practice Admins
- Practice onboarding wizard (profile → specialty → first provider → first service)
- Provider invitation and role management
- Service CRUD with intake form template linking
- Appointment oversight with manual approval workflow
- Practice settings (branding, cancellation policy, confirmation mode)
- Analytics dashboard (appointment counts, revenue, utilization)
- Patient and payment management

### Platform
- 22 database models with full referential integrity
- 68 API endpoints across 15 modules
- 30 frontend routes across 4 role-based layouts
- 14 background jobs (recurring + event-driven)
- 11 WebSocket events for real-time updates
- 16 email templates built with React Email
- Append-only audit logging with 25+ action types
- WCAG 2.1 AA accessibility compliance
- Mandatory demo banner on all pages

---

## Project Structure

```
medconnect/
├── apps/
│   ├── api/                          # NestJS backend
│   │   └── src/
│   │       ├── common/               # Guards, pipes, decorators, error classes
│   │       ├── jobs/                  # BullMQ processors, email/SMS services
│   │       ├── modules/              # Feature modules (15 domains)
│   │       │   ├── admin/            # Analytics, patient/payment management
│   │       │   ├── appointments/     # Booking, state machine, slot reservation
│   │       │   ├── audit/            # Append-only audit logging
│   │       │   ├── auth/             # JWT RS256, OAuth, guards
│   │       │   ├── calendar/         # Google Calendar sync
│   │       │   ├── intake/           # Form templates and submissions
│   │       │   ├── messaging/        # Real-time chat, WebSocket gateway
│   │       │   ├── notifications/    # In-app notification system
│   │       │   ├── payments/         # Stripe Connect integration
│   │       │   ├── practices/        # Multi-tenant practice management
│   │       │   ├── providers/        # Provider profiles, availability, invitations
│   │       │   ├── services/         # Healthcare service catalog
│   │       │   ├── uploads/          # File upload presigning, data export
│   │       │   ├── user/             # User profile management
│   │       │   └── video/            # Twilio Video rooms, provider abstraction
│   │       ├── prisma/               # PrismaService with RLS extension
│   │       └── types/                # Ambient type declarations
│   └── web/                          # Next.js frontend
│       └── src/
│           ├── app/                  # App Router pages (30 routes)
│           │   ├── (auth)/           # Login, register, verify, reset
│           │   ├── (dashboard)/      # Patient, provider, admin portals
│           │   ├── book/             # Public booking flow
│           │   └── compliance-roadmap/
│           ├── components/           # Page-specific React components
│           ├── hooks/                # Custom hooks (auth, socket, messages)
│           └── lib/                  # API client, auth context, utilities
├── packages/
│   ├── shared/                       # Zod schemas, TypeScript enums, constants
│   └── ui/                           # shadcn/ui component library
├── prisma/
│   ├── schema.prisma                 # 22 models, 12 enums, RLS policies
│   └── migrations/                   # Prisma migrations
├── scripts/                          # Seed data pipeline
├── specs/                            # 8 specification documents
├── .github/workflows/                # CI/CD (3 workflows)
├── docker-compose.yml                # PostgreSQL 16 + Redis 7.2
└── turbo.json                        # Turborepo pipeline config
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 22.0.0
- **pnpm** >= 10.x (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Docker** and **Docker Compose** (for PostgreSQL and Redis)

### Setup

```bash
# Clone the repository
git clone https://github.com/stephendeslate/telehealth-booking.git
cd telehealth-booking

# Install dependencies
pnpm install

# Start PostgreSQL and Redis
docker-compose up -d

# Copy environment config
cp .env.example .env

# Generate Prisma client
pnpm db:generate

# Run database migrations
pnpm db:migrate

# Start all dev servers
pnpm dev
```

The API runs at `http://localhost:3001` and the web app at `http://localhost:3000`.

### Available Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all dev servers (API + Web) |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | TypeScript check all packages |
| `pnpm test` | Run all tests |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed with synthetic data |
| `pnpm db:reset` | Reset and reseed database |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm clean` | Clean all build outputs |

---

## Environment Variables

All external services operate in mock mode when their environment variables are not set, allowing the full application to run locally with zero external configuration.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_PRIVATE_KEY` | No | RS256 private key (auto-generated in dev) |
| `JWT_PUBLIC_KEY` | No | RS256 public key (auto-generated in dev) |
| `STRIPE_SECRET_KEY` | No | Stripe API key (mock if unset) |
| `STRIPE_PUBLISHABLE_KEY` | No | Stripe public key |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret |
| `TWILIO_ACCOUNT_SID` | No | Twilio account (mock video/SMS if unset) |
| `TWILIO_API_KEY` | No | Twilio API key SID |
| `TWILIO_API_SECRET` | No | Twilio API secret |
| `TWILIO_AUTH_TOKEN` | No | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | No | Twilio SMS sender number |
| `GOOGLE_CLIENT_ID` | No | Google OAuth (mock if unset) |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth secret |
| `GOOGLE_CALENDAR_CLIENT_ID` | No | Calendar sync (stub if unset) |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | No | Calendar sync secret |
| `RESEND_API_KEY` | No | Resend email API key (mock if unset) |
| `FROM_EMAIL` | No | Sender email address |
| `R2_ACCOUNT_ID` | No | Cloudflare R2 (mock if unset) |
| `R2_ACCESS_KEY_ID` | No | R2 access key |
| `R2_SECRET_ACCESS_KEY` | No | R2 secret key |
| `CALENDAR_TOKEN_ENCRYPTION_KEY` | No | AES-256-GCM key for calendar tokens |
| `SENTRY_DSN` | No | Sentry error tracking (disabled if unset) |
| `WEB_URL` | No | Frontend URL (default: `http://localhost:3000`) |
| `API_URL` | No | Backend URL (default: `http://localhost:3001`) |
| `VIDEO_PROVIDER` | No | `twilio` or `mock` (default: `mock`) |

---

## Database

### Schema Overview

**22 models** organized around the core domain:

| Model | Description |
|-------|-------------|
| `User` | Platform users (patients, providers, admins) |
| `Practice` | Tenant — a healthcare business |
| `TenantMembership` | User-practice relationship with role |
| `ProviderProfile` | Healthcare provider details (specialties, bio) |
| `Service` | Bookable healthcare service (duration, price, type) |
| `AvailabilityRule` | Recurring weekly availability slots |
| `BlockedDate` | Provider date-level unavailability |
| `Appointment` | Core transaction entity with state machine |
| `SlotReservation` | 10-minute ephemeral hold on a time slot |
| `VideoRoom` | Twilio video room linked to appointment |
| `VideoParticipant` | Video session participant tracking |
| `IntakeFormTemplate` | JSONB form template linked to services |
| `IntakeSubmission` | Patient-submitted intake data |
| `Message` | Provider-patient messages |
| `PaymentRecord` | Stripe payment with platform fee tracking |
| `CalendarConnection` | Google Calendar OAuth connection |
| `CalendarEvent` | Synced calendar events |
| `Notification` | In-app notifications (10 types) |
| `AppointmentReminder` | Scheduled reminder tracking |
| `AuditLog` | Append-only audit trail |
| `ConsentRecord` | GDPR/compliance consent tracking |
| `RefreshToken` | JWT refresh token with family tracking |
| `InvitationToken` | Provider invitation tokens |

### Key Constraints

- **Double-booking prevention**: `UNIQUE(provider_profile_id, start_time)` on appointments
- **Slot reservation**: `SELECT ... FOR UPDATE` with 10-minute TTL
- **RLS isolation**: All practice-scoped tables filtered by `practice_id` via database policies
- **Audit immutability**: Database trigger prevents UPDATE/DELETE on `audit_logs`

---

## API Endpoints

68 endpoints across 15 modules. All routes are prefixed with `/api`.

### Authentication (`/api/auth`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Email/password login |
| POST | `/auth/refresh` | Rotate refresh token |
| POST | `/auth/logout` | Revoke refresh token |
| POST | `/auth/verify-email` | Verify email with token |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset password with token |
| POST | `/auth/change-password` | Change password (authenticated) |
| GET | `/auth/me` | Get current user |
| GET | `/auth/google` | Initiate Google OAuth |
| GET | `/auth/google/callback` | Google OAuth callback |

### Appointments (`/api/appointments`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/appointments/reserve` | Reserve a time slot (10-min TTL) |
| POST | `/appointments` | Create appointment from reservation |
| GET | `/appointments` | List user's appointments |
| GET | `/appointments/:id` | Get appointment detail |
| POST | `/appointments/:id/confirm` | Confirm (manual approval) |
| POST | `/appointments/:id/cancel` | Cancel with policy evaluation |
| POST | `/appointments/:id/reschedule` | Reschedule to new slot |
| PATCH | `/appointments/:id/notes` | Update clinical notes |

### Providers (`/api/practices/:practiceId/providers`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/providers` | List practice providers |
| GET | `/providers/:id` | Get provider profile |
| PATCH | `/providers/:id` | Update provider profile |
| DELETE | `/providers/:id` | Deactivate provider |
| POST | `/providers/invite` | Send provider invitation |
| GET | `/providers/invitations` | List pending invitations |
| DELETE | `/providers/invitations/:id` | Revoke invitation |
| GET | `/providers/:id/availability` | Get available time slots |
| POST | `/providers/:id/availability` | Create availability rule |
| GET | `/providers/:id/blocked-dates` | List blocked dates |
| POST | `/providers/:id/blocked-dates` | Create blocked date |
| DELETE | `/providers/:id/blocked-dates/:dateId` | Remove blocked date |

### Practices (`/api/practices`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/practices` | Create practice |
| GET | `/practices/mine` | Get user's practices |
| GET | `/practices/public/:slug` | Get public booking page |
| GET | `/practices/:id` | Get practice detail |
| PATCH | `/practices/:id` | Update practice |
| PATCH | `/practices/:id/settings` | Update practice settings |

### Services, Intake, Payments, Messaging, Calendar, Notifications, Video, Admin, Uploads, User

Additional endpoints follow the same RESTful pattern. See API documentation at `/api/docs` (Swagger/OpenAPI) when running the dev server.

---

## Frontend Routes

### Public
| Route | Description |
|-------|-------------|
| `/` | Landing page with features and demo practice links |
| `/book/:slug` | 6-step booking wizard for a practice |
| `/compliance-roadmap` | Compliance and HIPAA information |

### Authentication
| Route | Description |
|-------|-------------|
| `/login` | Email/password + Google OAuth login |
| `/register` | Account registration with consent |
| `/forgot-password` | Password recovery request |
| `/reset-password` | Password reset form |
| `/verify-email` | Email verification handler |
| `/accept-invite` | Provider invitation acceptance |

### Patient Portal
| Route | Description |
|-------|-------------|
| `/dashboard` | Overview with upcoming appointments |
| `/appointments` | Appointment list with filtering |
| `/appointments/:id` | Appointment detail with video join |
| `/messages` | Real-time messaging with providers |
| `/profile` | User profile management |
| `/payments` | Payment history |

### Provider Dashboard
| Route | Description |
|-------|-------------|
| `/provider` | Today's timeline and patient queue |
| `/provider/appointments` | Provider appointment management |
| `/provider/appointments/:id` | Appointment detail with notes |
| `/provider/availability` | Availability rule editor |
| `/provider/profile` | Provider profile management |
| `/provider/calendar` | Google Calendar sync status |

### Admin Dashboard
| Route | Description |
|-------|-------------|
| `/admin` | Analytics overview |
| `/admin/appointments` | Appointment management with approval |
| `/admin/providers` | Provider management and invitations |
| `/admin/services` | Service catalog CRUD |
| `/admin/settings` | Practice settings and branding |
| `/admin/patients` | Patient management |
| `/admin/payments` | Payment management |

### Video
| Route | Description |
|-------|-------------|
| `/video/:appointmentId` | Video consultation room |

---

## Background Jobs

14 background jobs running on BullMQ with Redis, organized into 7 queues:

### Recurring Jobs
| Job | Schedule | Description |
|-----|----------|-------------|
| `cleanExpiredReservations` | Every 1 min | Remove slot reservations past 10-min TTL |
| `processCompletedAppointments` | Every 5 min | Auto-complete in-person/phone appointments past end time |
| `detectNoShows` | Every 5 min | Mark video appointments as NO_SHOW if no check-in 15 min past end |
| `enforceApprovalDeadlines` | Every 1 hr | Cancel PENDING appointments older than 48 hours |

### Event-Driven Jobs
| Job | Trigger | Description |
|-----|---------|-------------|
| `sendAppointmentReminder` | Appointment confirmed | 24h and 1h reminders |
| `sendFollowUpEmail` | Appointment completed | 24h after completion |
| `sendIntakeFormReminder` | Appointment confirmed | 24h before if intake incomplete |
| `sendUnreadMessageEmail` | New message | 5-min debounce, check still unread |

### System Jobs
| Job | Description |
|-----|-------------|
| `calendarPushSync` | Push appointment changes to Google Calendar |
| `calendarInboundSync` | Pull calendar events for availability |
| `calendarTokenRefresh` | Refresh expiring OAuth tokens |
| `patientDataExport` | Compile and upload patient data (rate limited 1/24h) |
| `orphanedUploadCleanup` | Delete uploads not linked within 1 hour |
| `videoRoomCleanup` | End stale video rooms (hard limit, disconnection) |

---

## Real-Time Events

WebSocket communication via Socket.io with JWT authentication on handshake and Redis adapter for horizontal scaling.

### Channels
| Channel | Pattern | Scope |
|---------|---------|-------|
| User notifications | `user:{userId}:notifications` | Per-user |
| Appointment messages | `appointment:{appointmentId}` | Per-appointment |
| Practice queue | `practice:{practiceId}:queue` | Per-practice |
| Provider status | `practice:{practiceId}:providers` | Per-practice |
| Video room | `video:{roomId}` | Per-room |

### Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `notification:new` | Server → Client | New in-app notification |
| `message:new` | Bidirectional | New chat message |
| `message:read` | Client → Server | Mark message as read |
| `message:read_receipt` | Server → Client | Read receipt update |
| `typing:start` | Client → Server | User started typing |
| `typing:indicator` | Server → Client | Typing indicator (5s auto-expire) |
| `appointment:join` | Client → Server | Subscribe to appointment channel |
| `appointment:leave` | Client → Server | Unsubscribe from appointment channel |
| `video:status` | Server → Client | Video room status change |
| `video:participant_joined` | Server → Client | Participant joined video |
| `video:participant_left` | Server → Client | Participant left video |

---

## Testing

### Unit & Integration Tests

```bash
# Run all tests
pnpm test

# Run API tests only
pnpm --filter @medconnect/api test

# Run web tests only
pnpm --filter @medconnect/web test

# Run shared package tests
pnpm --filter @medconnect/shared test
```

- **API**: 148 tests across 6 test suites (auth, phases 3-7)
- **Shared**: Enum completeness and Zod schema validation
- **Web**: Component tests with React Testing Library

### E2E Tests

```bash
# Run Playwright E2E tests
pnpm --filter @medconnect/web test:e2e
```

- Booking flow, auth flow, provider workflow, navigation
- Accessibility checks via `@axe-core/playwright`

### Test Infrastructure
- **Vitest** for unit and integration tests
- **Playwright** for E2E browser tests
- **Factory functions** for test data (`createTestUser`, `createTestPractice`, etc.)
- **Real database** for API integration tests (no mocking of Prisma)
- **BullMQ queues mocked** in test modules

---

## Deployment

### Infrastructure

| Component | Platform | Details |
|-----------|----------|---------|
| **API** | Fly.io | NestJS app with release command for migrations |
| **Frontend** | Vercel | Next.js with automatic builds |
| **Database** | Fly Postgres | PostgreSQL 16 cluster |
| **Redis** | Upstash Redis | Via Fly.io addon |
| **Storage** | Cloudflare R2 | S3-compatible object storage |

### CI/CD Workflows

| Workflow | Trigger | Jobs |
|----------|---------|------|
| `ci.yml` | Push/PR to main/develop | Lint → Typecheck → Test → Build |
| `deploy-api.yml` | Push to main (api/shared/prisma changes) | Deploy to Fly.io |
| `deploy-web.yml` | Push to main (web/shared/ui changes) | Deploy to Vercel |

### Deploy Commands

```bash
# API (Fly.io)
fly apps create medconnect-api
fly postgres create --name medconnect-db
fly postgres attach medconnect-db --app medconnect-api
fly redis create --name medconnect-redis
fly secrets set DATABASE_URL=... REDIS_URL=... JWT_PRIVATE_KEY=...
fly deploy

# Frontend (Vercel)
vercel --prod
```

---

## Specifications

The project is built from 8 detailed specification documents in the `specs/` directory:

| Document | Contents |
|----------|----------|
| **PVD.md** | Product vision, 7 personas, product pillars, risk assessment |
| **BRD.md** | Business requirements, revenue model, subscription tiers, specialty presets |
| **PRD.md** | 121 functional requirements across 15 groups, 16 user stories |
| **SRS-1-ARCHITECTURE.md** | Tech stack, monorepo structure, multi-tenancy, non-functional requirements |
| **SRS-2-DATA-MODEL.md** | Database schema (22 models, 12 enums), API endpoint catalog |
| **SRS-3-BOOKING-VIDEO-PAYMENTS.md** | Appointment state machine, availability algorithm, video/payment flows |
| **SRS-4-COMMS-SECURITY.md** | Messaging, notifications, email templates, audit logging, security |
| **WIREFRAMES.md** | ASCII wireframes for all views with responsive breakpoints |

---

## License

Proprietary — SJD Labs, LLC. All rights reserved.
