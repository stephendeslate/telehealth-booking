# MedConnect Specification Index

## Core Specs

| Document | Description |
|----------|-------------|
| [PVD.md](PVD.md) | Product Vision Document — vision statement, personas, competitive landscape, success metrics, portfolio objectives |
| [BRD.md](BRD.md) | Business Requirements Document — revenue model, 10 core business rules, multi-tenancy, onboarding, constraints, dependencies |
| [PRD.md](PRD.md) | Product Requirements Document — 15 functional requirement groups (FR-*), user stories, acceptance criteria |
| [SRS-1-ARCHITECTURE.md](SRS-1-ARCHITECTURE.md) | Software Requirements Specification — tech stack, architecture, multi-tenancy RLS, deployment, CI/CD, testing, WebSocket, NFRs |
| [SRS-2-DATA-MODEL.md](SRS-2-DATA-MODEL.md) | Software Requirements Specification — 14 enums, 19+ table schemas, relationships, RLS policies, API endpoint summary |
| [SRS-3-BOOKING-VIDEO-PAYMENTS.md](SRS-3-BOOKING-VIDEO-PAYMENTS.md) | Software Requirements Specification — appointment state machine, availability engine, Twilio Video lifecycle, Stripe Connect, BullMQ jobs |
| [SRS-4-COMMS-SECURITY.md](SRS-4-COMMS-SECURITY.md) | Software Requirements Specification — email/SMS notifications, WebSocket messaging, auth/authz, HIPAA compliance, calendar sync, audit logging |
| [WIREFRAMES.md](WIREFRAMES.md) | ASCII wireframes for all critical views — auth, booking flow, provider dashboard, video UI, patient portal, admin, compliance roadmap, responsive breakpoints |

## Reading Order

For new contributors or AI assistants navigating this codebase:

1. **PVD** — Understand what MedConnect is and why it exists
2. **BRD** — Understand the business rules and constraints
3. **PRD** — Understand what needs to be built (functional requirements)
4. **SRS-1** — Understand the architecture and infrastructure
5. **SRS-2** — Understand the data model and API surface
6. **SRS-3** — Understand the core domain logic (booking, video, payments)
7. **SRS-4** — Understand communications, security, and compliance

## Cross-Reference Map

```
PVD ─── defines vision ──────────────────┐
BRD ─── defines business rules ──────────┤
PRD ─── defines functional requirements ─┤
                                         v
SRS-1 (Architecture) ◄──────────────── references FR-* IDs
  │                                    from PRD and BR-*
  ├── SRS-2 (Data Model)               from BRD
  │     │
  │     ├── SRS-3 (Booking/Video/Pay)
  │     │     └── references SRS-2 tables, SRS-1 infra
  │     │
  │     └── SRS-4 (Comms/Security)
  │           └── references SRS-2 tables, SRS-3 events
  │
  └── All SRS docs reference each other via §-sections
```

## Document Statistics

| Document | Sections | Key Artifacts |
|----------|----------|---------------|
| PVD | 11 | 7 personas, 7 product pillars, 10 risks (incl. Twilio EOL migration path) |
| BRD | 9 | 10 business rules, 3 subscription tiers, 7 specialty presets, 10 dependencies (Twilio High risk, Prisma Medium) |
| PRD | 5 | 15 FR groups (~121 requirements incl. FR-PP-9 data export), 16 user stories |
| SRS-1 | 14 | Architecture diagram, monorepo structure, 5 WebSocket channels, 10+ NFRs, §13.6 WCAG 2.1 AA (10 accessibility NFRs) |
| SRS-2 | 14 | 14 enums, 19+ tables, ~46 API endpoints |
| SRS-3 | 11 | 2 state machines, availability algorithm, 12 BullMQ jobs, §6.10 video provider abstraction layer |
| SRS-4 | 12 | 15 email templates, 12 WebSocket events, 25+ audit actions, HIPAA checklist, §8.7 PHI-Stripe prevention, §10.3 patient data export, §11 R2 file upload flow |
| WIREFRAMES | 9 | 2 global layouts, 2 auth pages, 6-step booking wizard, provider dashboard + timeline, video consultation UI, patient portal, admin dashboard, responsive breakpoints |
