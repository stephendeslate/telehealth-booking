# Telehealth Booking Platform — Build Plan

## Verified Score: ~9.10 (upgraded from 8.90 post-legal review)
| CD | DI | TS | VI | SY | BF |
|----|----|----|----|----|-----|
| 9  | 8.5| 9.5| 9  | 9  | 8   |

## Overview
A multi-tenant platform for healthcare providers to manage virtual appointments. Provider profiles, availability management, video consultation booking, patient intake forms, secure messaging, appointment reminders, payment collection, and a patient portal. Includes a "Production Compliance Roadmap" page demonstrating HIPAA architecture awareness.

## Legal Caveats
- HIPAA does NOT apply to synthetic-data demos by non-covered-entity developers (HHS confirmed)
- No BAA required, no HIPAA-eligible hosting needed for demo
- Use Synthea (MITRE open-source) for realistic synthetic patient data
- FDA SaMD does NOT apply to scheduling/admin software — avoid clinical decision features
- Add disclaimer on every page: "Demo application — synthetic data only. Not for clinical use."
- MUST include "Production Compliance Roadmap" page — this turns regulatory complexity into a portfolio ASSET

## Tech Stack
- **Backend:** NestJS 11 + Prisma 6 + PostgreSQL 16 (RLS)
- **Frontend:** Next.js 15 App Router + shadcn/ui + Tailwind CSS 4
- **Video:** Twilio Video SDK (trial credits ~$15.50, HIPAA-eligible in production)
- **Payments:** Stripe (appointment payment collection)
- **Queue:** BullMQ + Redis (reminders, follow-ups)
- **Synthetic Data:** Synthea (MITRE) for patient profiles
- **Testing:** Vitest
- **Deployment:** Vercel (frontend) + Railway (API + PostgreSQL + Redis)

## Architecture

### Booking Flow
```
Patient → Browse providers → Select service → Check availability
  → Fill intake form → Select time slot → Pay (optional)
  → Confirmation + calendar invite + reminder scheduled
  → Join video room at appointment time
  → Post-appointment: notes, follow-up scheduling
```

### Multi-Tenancy Model
Each healthcare practice = one tenant. Providers belong to practices.
Patients can book across practices (shared patient pool with consent).

### Data Model (Key Entities)
- `Practice` (tenant — name, branding, settings, subscriptionTier)
- `Provider` (practiceId, specialties, credentials, bio, avatarUrl)
- `Patient` (name, dateOfBirth, contactInfo — ALL SYNTHETIC via Synthea)
- `Appointment` (providerId, patientId, startTime, endTime, status, videoRoomSid)
- `IntakeForm` (appointmentId, formData JSONB, completedAt)
- `AvailabilityRule` (providerId, dayOfWeek, startTime, endTime, slotDuration)
- `Message` (senderId, receiverId, appointmentId, content, readAt)
- `PaymentRecord` (appointmentId, amount, stripePaymentIntentId, status)

## SavSpot Module Reuse Map

| SavSpot Module | Reuse | Adaptation Needed |
|----------------|-------|-------------------|
| `availability/` | Direct | Provider availability rules engine |
| `booking-flow/` | Adapt | Simplify steps: provider → service → time → intake → pay |
| `bookings/` | Adapt | Rename to appointments, add video room association |
| `booking-sessions/` | Direct | Temporary hold on time slots during booking |
| `payments/` | Direct | Appointment payment collection via Stripe |
| `communications/` | Direct | Appointment confirmations, reminders |
| `sms/` | Direct | SMS reminders |
| `notifications/` | Direct | In-app notifications |
| `calendar/` | Direct | Google Calendar + Outlook sync for providers |
| `client-portal/` | Adapt | Becomes patient portal |
| `auth/` | Direct | Email/password + OAuth, role-based (admin, provider, patient) |
| `tenant-context/` | Direct | Practice-scoped data isolation |

### New Code Required
- **Video consultation room** — Twilio Video SDK integration (waiting room, 1:1 call, end call)
- **Patient intake forms** — Dynamic form builder with JSONB storage
- **Provider profile pages** — Specialties, credentials, availability preview
- **Compliance Roadmap page** — HIPAA architecture documentation as a demo feature
- **Synthea data seeding** — Generate and import synthetic patient records

## 2-Week Sprint Plan

### Week 1: Core Booking + Availability
| Day | Task | Hours |
|-----|------|-------|
| 1 | Project scaffold + Prisma schema (Practice, Provider, Patient, Appointment) | 6 |
| 1-2 | Synthea integration — generate 50 synthetic patients, FHIR→CSV→Prisma seed | 4 |
| 2 | Availability rules engine (reuse from SavSpot) | 4 |
| 2 | Slot calculation with timezone handling | 4 |
| 3 | Booking flow API — slot selection, intake, payment, confirmation | 8 |
| 4 | Provider profiles page (specialties, bio, availability preview) | 4 |
| 4 | Patient booking UI — provider browse, service select, time picker | 4 |
| 5 | Intake form builder (predefined templates: general, dental, therapy) | 4 |
| 5 | Appointment confirmation + Google Calendar event creation | 4 |

### Week 2: Video, Portal, Compliance
| Day | Task | Hours |
|-----|------|-------|
| 6 | Twilio Video integration — room creation, token generation | 4 |
| 6 | Video consultation UI — waiting room, call controls, end call | 4 |
| 7 | Patient portal — upcoming appointments, messages, intake history | 6 |
| 7 | Secure messaging (provider ↔ patient, per-appointment threads) | 2 |
| 8 | Provider dashboard — today's appointments, patient queue, notes | 6 |
| 8 | BullMQ: appointment reminders (24h, 1h before) via email + SMS | 2 |
| 9 | Practice admin dashboard — provider management, appointment analytics | 4 |
| 9 | Production Compliance Roadmap page (HIPAA controls documentation) | 4 |
| 10 | Seed data polish (5 practices, 15 providers, 200 appointments) | 3 |
| 10 | Demo banner, disclaimer on all pages, README, deploy | 5 |

## Compliance Roadmap Page (Key Demo Feature)
This page is part of the demo itself — demonstrating HIPAA architecture awareness:

### What It Documents
- **Encryption:** AES-256 at rest, TLS 1.3 in transit, DTLS-SRTP for video
- **Access Controls:** RBAC with minimum necessary access principle
- **Audit Logging:** All PHI access logged with user, timestamp, action, resource
- **BAA Requirements:** Twilio (HIPAA-eligible), AWS/Vercel Enterprise, PostgreSQL hosting
- **Data Retention:** Configurable retention policies per data category
- **Incident Response:** Breach notification workflow (72-hour GDPR, 60-day HIPAA)
- **Infrastructure:** Migration path from Railway → Aptible/AWS with BAA

## Demo Strategy
- **Hero screenshot:** Video consultation in progress with patient info sidebar
- **Key flows:** Patient books → fills intake → joins video → provider takes notes
- **Compliance page:** Show the architecture documentation (screenshot this for Upwork profile)
- **Mobile responsive:** Patient booking flow on mobile viewport
- **Calendar integration:** Show synced appointments in Google Calendar

## Key Dependencies
```json
{
  "twilio": "^5.x",
  "twilio-video": "^2.x",
  "stripe": "^17.x",
  "@nestjs/bullmq": "^11.x",
  "@prisma/client": "^6.x",
  "recharts": "^3.x",
  "date-fns": "^4.x",
  "@date-fns/tz": "^1.x"
}
```

## Risk Mitigation
| Risk | Mitigation |
|------|------------|
| Twilio Video complexity | Use twilio-video SDK (unscoped npm package) + 1:1 calls only; budget Day 6-7 buffer |
| Synthea data format | Pre-process Synthea FHIR output → flat CSV → Prisma seed (budget 4h, not 2h) |
| Intake form flexibility | Start with 3 predefined templates, not a custom builder |
| HIPAA misunderstanding | Compliance Roadmap page proactively addresses "is this HIPAA compliant?" |
| Video quality in demo | Record a polished screen capture rather than relying on live demo |
| Twilio trial limits | Trial credits ~$15.50 for video rooms; sufficient for demo, not "free tier" |
