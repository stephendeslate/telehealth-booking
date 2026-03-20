# MedConnect — Software Requirements Specification: Architecture & Infrastructure

**Author:** SJD Labs, LLC
**Document:** SRS Part 1 of 4

---

## 1. Scope

This document covers the technology stack, system architecture, multi-tenancy implementation, deployment strategy, CI/CD pipeline, testing strategy, monitoring and observability, and non-functional requirements for the MedConnect telehealth booking platform. Data models are defined in **SRS-2**. Booking, video, and payment logic are in **SRS-3**. Communications, security, and messaging are in **SRS-4**.

---

## 2. Core Tech Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Language | TypeScript | 5.8+ | Single language across stack; type safety for healthcare data |
| Backend | NestJS | 11+ | Modular, DI-based, supports WebSocket gateway natively |
| ORM | Prisma | 6+ | Type-safe queries, declarative migrations, PostgreSQL RLS support. Prisma 7 released (ESM-only, Rust-free client, 90% smaller bundle) — project starts on v6 for stability; post-launch migration path documented below. |
| Frontend | Next.js App Router | 15+ | RSC, server actions, SSR for booking pages |
| UI | shadcn/ui + Radix | Latest | Accessible, Tailwind-based, clean medical UI aesthetic |
| Styling | Tailwind CSS | 4+ | Utility-first, design tokens for medical branding |
| State | TanStack Query v5 + Context API | v5 | Server state via TanStack Query, local state via Context |
| Forms | React Hook Form + Zod | Latest | Type-safe validation, shared schemas between client and server |
| Database | PostgreSQL | 16+ | ACID compliance, RLS, JSONB for intake form data |
| Cache/Queue | Redis 7.2+ or Valkey 8+ | 7.2+ | BullMQ broker, caching, WebSocket adapter (Socket.io). Redis 7.4+ uses RSALv2/SSPLv1 license (Redis 8+ adds AGPLv3 option). Valkey (Linux Foundation, BSD-3) is a drop-in alternative if license constraints apply. Railway provides managed Redis; self-hosted deployments may prefer Valkey. |
| Job Queue | BullMQ | 5+ | Redis-backed, TypeScript-native, appointment reminders and jobs |
| Real-time | Socket.io + NestJS WebSocket Gateway | 4+ | Bidirectional messaging, typing indicators, notifications |
| Video | Twilio Video SDK | 2.x | HIPAA-eligible (production), group rooms, screen sharing. **EOL Dec 5, 2026.** Accessed via video provider abstraction layer (SRS-3 §6.10) to enable migration to Daily.co or LiveKit. |

---

## 3. External Services

| Service | Provider | Purpose |
|---------|----------|---------|
| Video | Twilio Video | 1:1 and group video consultations, screen sharing |
| Payments | Stripe Connect Express | Payment processing, practice payouts, platform fees |
| Email | Resend | Transactional email (confirmations, reminders, receipts) |
| Object Storage | Cloudflare R2 | S3-compatible storage (avatars, practice logos, cover photos) |
| Error Tracking | Sentry | Error tracking + performance monitoring |
| Calendar | Google Calendar API v3 | OAuth 2.0, outbound + inbound sync |
| Calendar | Microsoft Graph API | OAuth 2.0, Outlook calendar sync |
| Auth | Custom NestJS + Passport.js | JWT, OAuth 2.0 (Google) |
| DNS/CDN | Cloudflare | DNS, CDN, DDoS protection |
| Synthetic Data | Synthea (MITRE) | FHIR-format synthetic patient generation |

---

## 4. Development & Infrastructure Tools

| Tool | Purpose |
|------|---------|
| Turborepo + pnpm | Monorepo management and dependency resolution |
| GitHub Actions | CI/CD pipeline automation |
| Railway | Backend hosting (API + PostgreSQL + Redis) |
| Vercel | Frontend hosting (Next.js SSR/SSG) |
| Docker | Local development environment |
| ESLint, Prettier | Code linting and formatting |
| TypeScript strict mode | Type safety enforcement across all packages |
| Vitest, Playwright | Unit/integration testing, E2E web testing |
| Swagger/OpenAPI | API documentation auto-generated from NestJS decorators |

---

## 5. High-Level Architecture

```
                    +-------------------------------------+
                    |           Cloudflare CDN             |
                    +----------+----------+---------------+
                               |          |
                    +----------v--+  +----v--------------+
                    |   Vercel    |  |   WebSocket        |
                    |  (Next.js)  |  |   (Socket.io)      |
                    | Booking Page|  | Messaging + Notifs  |
                    |Patient Portal  +--------+-----------+
                    |Provider Dash|           |
                    |Practice Admin           |
                    +------+------+           |
                           |                  |
                    +------v------------------v-----------+
                    |           Railway Platform           |
                    |  +------------------------------+   |
                    |  |    NestJS API Server          |   |
                    |  |    (REST API + WS Gateway)    |   |
                    |  +----------+-------------------+   |
                    |             |                        |
                    |  +----------v-------------------+   |
                    |  |    PostgreSQL 16 (RLS)        |   |
                    |  +------------------------------+   |
                    |  +------------------------------+   |
                    |  |    Redis                      |   |
                    |  +------------------------------+   |
                    |  +------------------------------+   |
                    |  |    BullMQ Workers             |   |
                    |  +------------------------------+   |
                    +--------------------------------------+
                               |
              +----------------+----------------+
              |                |                |
     +--------v---+  +--------v---+  +---------v----+
     |   Stripe   |  |   Resend   |  |   Twilio     |
     |  Connect   |  |   (Email)  |  |   Video      |
     +------------+  +------------+  +--------------+
```

**Request Flow:** Clients hit Cloudflare CDN → Vercel (Next.js pages) → Railway NestJS API. WebSocket connections for messaging and notifications go through the NestJS WebSocket Gateway (Socket.io), using Redis as the adapter for horizontal scaling. Video consultations are peer-to-peer via Twilio's infrastructure — the NestJS API only handles room creation and token generation.

---

## 6. Monorepo Structure

```
medconnect/
├── apps/
│   ├── api/                  # NestJS backend (REST API + WebSocket Gateway)
│   └── web/                  # Next.js frontend (all pages)
├── packages/
│   ├── shared/               # Shared types, Zod schemas, constants, enums
│   └── ui/                   # shadcn/ui components, design tokens
├── prisma/
│   └── schema.prisma         # Database schema + migrations
├── scripts/
│   ├── seed.ts               # Deterministic seed script
│   └── synthea/              # Synthea FHIR → Prisma mapping pipeline
├── docker-compose.yml        # Local dev (PostgreSQL, Redis)
├── turbo.json                # Turborepo pipeline config
├── pnpm-workspace.yaml       # pnpm workspace definition
├── tsconfig.base.json        # Shared TypeScript config
├── .eslintrc.js              # Shared ESLint config
├── CLAUDE.md                 # AI assistant context
└── .github/
    └── workflows/
        ├── ci.yml            # Lint, typecheck, test
        ├── deploy-api.yml    # Deploy API to Railway
        └── deploy-web.yml    # Deploy web to Vercel
```

---

## 7. Multi-Tenancy Implementation

### Strategy: Shared Database with Row-Level Security

All practices share a single PostgreSQL database. Isolation is enforced at the database level via RLS policies.

**RLS Policy Example:**

```sql
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY practice_isolation ON appointments
  FOR ALL
  TO application_role
  USING (practice_id = current_setting('app.current_practice')::UUID);
```

### Implementation Steps

1. **Resolve practice** from JWT claims or URL slug on every request.
2. **NestJS middleware** sets `app.current_practice` on the PostgreSQL session via `select set_config('app.current_practice', practiceId, TRUE)` (transaction-local, compatible with Prisma interactive transactions).
3. **Prisma Client Extension** auto-filters all queries by `practice_id` at the application layer.
4. **RLS acts as a database-level safety net** — even if application code has a bug, data cannot leak across practices.

### Practice Resolution by Context

| Context | Resolution Method |
|---------|-------------------|
| Provider Dashboard | Extracted from JWT `practice_id` claim |
| Practice Admin | Extracted from JWT `practice_id` claim |
| Patient Portal | JWT `user_id` — patient sees own data across all practices |
| Booking Page | URL slug (e.g., `/book/{slug}`) — read-only public access |
| API (authenticated) | JWT claims |

### Cross-Practice Patient Access

Patients are NOT isolated by practice. A patient's user record and their appointment list span all practices. The patient portal queries appointments by `patient_id` (the user's ID), not by `practice_id`. Practice-scoped data (provider notes, intake forms) is still RLS-protected — patients can only see data they are authorized to see.

---

## 8. Deployment Environments

| Environment | Infrastructure | Trigger |
|-------------|---------------|---------|
| Local | Docker Compose (PostgreSQL, Redis), NestJS dev server, Next.js dev server | Manual (`pnpm dev`) |
| Preview | Vercel Preview + Railway preview | Pull request opened/updated |
| Production | Railway (API + PostgreSQL + Redis) + Vercel (Next.js) | Push to `main` branch |

---

## 9. CI/CD Pipeline

### Pipeline Flow

```
Install ──> Lint + Typecheck ──> Test ──> Build ──> Deploy
```

### Pipeline Steps

| Step | Command | Description |
|------|---------|-------------|
| Install | `pnpm install --frozen-lockfile` | Deterministic dependency install |
| Lint | `turbo run lint` | ESLint + Prettier across all packages |
| Typecheck | `turbo run typecheck` | `tsc --noEmit` across all packages |
| Unit Tests | `turbo run test` | Vitest unit + integration tests |
| E2E Tests | `turbo run test:e2e` | Playwright browser tests |
| Build | `turbo run build` | Build all apps and packages |
| Deploy API | Railway auto-deploy | Triggered by Git push to main |
| Deploy Web | Vercel auto-deploy | Triggered by Git push to main |

### Database Migration Strategy

| Environment | Command | Strategy |
|-------------|---------|----------|
| Local | `prisma migrate dev` | Create + apply migrations interactively |
| Production | `prisma migrate deploy` | Apply pending migrations only |
| Railway | Release command in config | Runs `prisma migrate deploy` before new instances start |
| Zero-downtime | Expand-and-contract | Add columns/tables first, backfill, then remove old columns in a subsequent release |

---

## 10. Testing Strategy

### Testing Pyramid

| Level | Tool | Scope | Coverage Target |
|-------|------|-------|-----------------|
| Unit | Vitest | Functions, services, utils, Zod schemas | 80%+ |
| Integration | Vitest + Prisma | API endpoints, database queries, service interactions | 70%+ |
| Component | Vitest + Testing Library | React components, hooks, form validation | 70%+ |
| E2E | Playwright | Full user flows (booking, video page, admin) | Critical paths |

### Test Data Strategy

| Strategy | Description |
|----------|-------------|
| Factory functions | TypeScript factories (e.g., `createTestAppointment()`) for consistent test data |
| Seeded database | `prisma db seed` with Synthea-derived synthetic data |
| Stripe test mode | Test API keys, test card numbers, test webhook events |
| Mocked services | Twilio Video, Resend mocked in test environment |
| Seed scripts | `pnpm db:seed` populates local with realistic demo data |

### Twilio Video Testing

Video integration testing uses Twilio's test credentials (`test-*` SIDs) which don't create real rooms or consume credits. E2E video tests verify:
- Room creation API returns valid SID
- Token generation returns valid JWT
- Room status transitions (CREATED → IN_PROGRESS → COMPLETED)
- Participant connect/disconnect events

Browser-level video testing (camera/mic) is limited to Playwright's media stub support. Manual testing covers the full video experience.

---

## 11. Monitoring & Observability

| Concern | Tool | Details |
|---------|------|---------|
| Error Tracking | Sentry | Source maps, breadcrumbs, release tracking |
| Infrastructure | Railway Metrics | CPU, memory, disk per service |
| Uptime | UptimeRobot | HTTP health endpoint (`/health`), 1-min interval |
| Logs | Railway Log Drain | Structured JSON logs |
| Alerting | Sentry Alerts | Error spike alerts via email |

### Health Endpoint

`GET /health` returns:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "database": "connected",
  "redis": "connected",
  "twilio": "reachable",
  "uptime_seconds": 86400
}
```

---

## 12. WebSocket Architecture

### Socket.io Integration

MedConnect uses Socket.io (via NestJS `@WebSocketGateway`) for real-time features:

| Feature | Channel Pattern | Direction |
|---------|-----------------|-----------|
| Messaging | `appointment:{id}:messages` | Bidirectional |
| Typing indicator | `appointment:{id}:typing` | Bidirectional |
| Notifications | `user:{id}:notifications` | Server → Client |
| Video room status | `appointment:{id}:video` | Server → Client |
| Provider queue | `practice:{id}:queue` | Server → Client |

### Connection Lifecycle

1. Client connects with JWT in handshake auth header.
2. Server validates JWT, resolves user and practice context.
3. Client subscribes to relevant channels (user notifications, active appointment threads).
4. Server pushes events to subscribed channels.
5. On disconnect, server cleans up subscriptions. Offline messages accumulate in DB.

### Redis Adapter

Socket.io uses the Redis adapter (`@socket.io/redis-adapter`) for multi-instance support. All WebSocket events are published through Redis Pub/Sub, enabling horizontal scaling of the NestJS API without sticky sessions.

---

## 13. Non-Functional Requirements

### 13.1 Performance Targets

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-PERF-1 | First Contentful Paint (booking page) | < 2 seconds |
| NFR-PERF-2 | API response time (p95 reads / writes) | < 200ms reads, < 500ms writes |
| NFR-PERF-3 | Video connection establishment | < 5 seconds |
| NFR-PERF-4 | WebSocket message delivery (both online) | < 200ms |
| NFR-PERF-5 | Concurrent WebSocket connections | 1,000+ |
| NFR-PERF-6 | Booking flow step transition (client-perceived) | < 300ms |

### 13.2 Scalability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-SCALE-1 | Multi-tenant capacity | 1,000+ practices on shared infrastructure |
| NFR-SCALE-2 | Concurrent video rooms | 100+ simultaneous rooms (Twilio limit: account-level) |
| NFR-SCALE-3 | Job processing throughput | 500+ jobs/minute via BullMQ workers |
| NFR-SCALE-4 | Database scaling | Read replicas via Railway PostgreSQL |

### 13.3 Security

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-SEC-1 | Data in transit | TLS 1.3 for all HTTP/WS; DTLS-SRTP for Twilio Video |
| NFR-SEC-2 | Data at rest | AES-256 encryption on PostgreSQL (Railway managed) |
| NFR-SEC-3 | Authentication tokens | JWT with RS256 signing, 15 min access token, 7 day refresh |
| NFR-SEC-4 | Password storage | bcrypt with minimum 12 rounds |
| NFR-SEC-5 | API rate limiting | 100 req/min per IP (public endpoints), 500 req/min per user (authenticated) |
| NFR-SEC-6 | CORS | Strict origin whitelist (production domains only) |
| NFR-SEC-7 | Input validation | Zod schemas on all API inputs; reject invalid payloads at the controller level |
| NFR-SEC-8 | SQL injection | Prisma parameterized queries; no raw SQL without explicit review |
| NFR-SEC-9 | XSS prevention | React's built-in escaping + DOMPurify for any rich text rendering |
| NFR-SEC-10 | Webhook verification | Stripe webhook signature verification; reject unverified payloads |

### 13.4 Reliability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-RELY-1 | Platform uptime | 99.5% monthly |
| NFR-RELY-2 | Video call success rate | 95%+ successful connections |
| NFR-RELY-3 | Recovery Time Objective (RTO) | ≤1 hour |
| NFR-RELY-4 | Recovery Point Objective (RPO) | ≤1 hour |

### 13.5 Backup & Disaster Recovery

| ID | Requirement | Specification |
|----|-------------|---------------|
| NFR-DR-1 | Database backups | Railway managed PostgreSQL daily snapshots |
| NFR-DR-2 | Backup retention | 7 daily snapshots |
| NFR-DR-3 | Redis data loss tolerance | Redis is cache/session layer; all authoritative data in PostgreSQL |
| NFR-DR-4 | Rollback procedure | Deploy previous image; expand-and-contract migrations ensure backward compatibility |

### 13.6 Accessibility (WCAG 2.1 Level AA)

MedConnect targets WCAG 2.1 Level AA conformance. The DOJ's April 2024 ruling under ADA Title II requires WCAG 2.1 AA compliance for state and local government web content (effective April 2026-2027), and federal courts increasingly use WCAG 2.1 AA as the benchmark for ADA Title III (private sector) claims. Conformance at launch is a portfolio differentiator and a prerequisite for any production healthcare deployment.

| ID | Requirement | Specification |
|----|-------------|---------------|
| NFR-A11Y-1 | Keyboard navigation | All interactive elements (buttons, links, form fields, modals, video controls) must be operable via keyboard alone. No keyboard traps. Logical tab order matches visual order. |
| NFR-A11Y-2 | Focus management | Focus moves to newly rendered content (modal dialogs, toast notifications, booking flow step transitions). Focus is returned to the triggering element on dismiss. Skip-to-content link on all pages. |
| NFR-A11Y-3 | Color contrast | Text: minimum 4.5:1 contrast ratio (3:1 for large text ≥18pt / 14pt bold). UI components and graphical objects: minimum 3:1 against adjacent colors. |
| NFR-A11Y-4 | Screen reader support | All images have descriptive `alt` text. Form inputs have associated `<label>` elements. ARIA landmarks (`main`, `nav`, `banner`, `complementary`) on all pages. Dynamic status changes announced via `aria-live` regions. |
| NFR-A11Y-5 | Video UI accessibility | Video call controls (mute, camera, screen share, end call, leave waiting room) have visible text labels or `aria-label`. Audio/video state changes announced to screen readers. Captions toggle visible in video toolbar (caption rendering dependent on provider SDK support). |
| NFR-A11Y-6 | Form accessibility | Inline validation errors programmatically associated with inputs via `aria-describedby`. Required fields indicated with both visual indicator and `aria-required`. Error summary at top of form on submit failure, with links to each invalid field. |
| NFR-A11Y-7 | Motion and animation | Respects `prefers-reduced-motion` media query. No content flashes more than 3 times per second. Auto-playing animations (loading spinners excluded) provide pause/stop mechanism. |
| NFR-A11Y-8 | Text scaling | Content reflows without loss of functionality up to 200% browser zoom. No horizontal scrolling at 320px CSS viewport width (mobile equivalent). |
| NFR-A11Y-9 | Touch targets | Interactive touch targets minimum 44×44 CSS pixels on mobile viewports. Sufficient spacing between adjacent targets to prevent mis-taps. |
| NFR-A11Y-10 | Automated testing | axe-core integrated into CI pipeline (Vitest + @axe-core/react for component tests, Playwright + @axe-core/playwright for E2E). Zero critical or serious violations allowed in CI. |

**Implementation approach:** shadcn/ui + Radix UI primitives provide built-in keyboard navigation, focus management, and ARIA attributes for most components (dialogs, dropdowns, tabs, tooltips). Custom components (video controls, booking calendar, intake form builder) require manual ARIA implementation per the requirements above.

---

## Cross-References

- **SRS-2 (Data Model):** Entity definitions, Prisma schema, enums, relationships.
- **SRS-3 (Booking, Video & Payments):** Appointment lifecycle, availability engine, Twilio Video integration, Stripe Connect workflows.
- **SRS-4 (Communications & Security):** Email/SMS notifications, WebSocket messaging protocol, auth/authz, HIPAA compliance architecture, calendar sync, audit logging.
- **BRD:** Business rules, multi-tenancy requirements, HIPAA compliance boundary.
- **PRD:** Functional requirements referenced by FR-* identifiers.
