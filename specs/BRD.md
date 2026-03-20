# MedConnect — Business Requirements Document

**Author:** SJD Labs, LLC
**Document:** BRD
**Date:** 2026-03-19

---

## 1. Revenue Model

> **Strategic context:** MedConnect is primarily an SJD Labs portfolio piece — a live telehealth platform that demonstrates healthcare domain expertise for Upwork and freelance client acquisition. Revenue is a secondary benefit; the platform is architected to support real practices if demand materializes, but income expectations are modest.

MedConnect operates under a subscription + usage model targeting small-to-mid healthcare practices:

### Revenue Streams

| Stream | Model | Rate | When |
|--------|-------|------|------|
| **Platform Subscription** | Monthly per-practice | $29-$99/mo by tier | Monthly billing |
| **Payment Processing** | Platform fee on patient payments | 1.0% on top of Stripe's standard fees | Every payment |
| **Video Overage** | Per-minute above tier inclusion | $0.05/minute | Monthly invoice |

### Subscription Tiers

| Feature | Starter ($29/mo) | Practice ($49/mo + $15/provider) | Enterprise (Custom) |
|---------|------------------|----------------------------------|---------------------|
| Providers | 1 | Up to 10 | Unlimited |
| Video minutes/month | 100 | 500 | Unlimited |
| Patients | Unlimited | Unlimited | Unlimited |
| Intake form templates | 3 | Unlimited | Unlimited |
| Appointment reminders | Email only | Email + SMS | Email + SMS |
| Calendar sync | Google Calendar | Google + Outlook | Google + Outlook + EHR |
| Secure messaging | Yes | Yes | Yes |
| Practice analytics | Basic | Advanced | Advanced + custom |
| Payment collection | Yes (1% platform fee) | Yes (1% platform fee) | Yes (negotiable fee) |
| HIPAA BAA | No (demo) | No (demo) | Available (production path) |
| Free trial | 14 days | 14 days | N/A |

> **Pricing rationale:** Starter at $29/mo is competitive with Doxy.me Pro ($35/mo) while offering booking + payments that Doxy.me lacks. Practice tier at $49/mo + $15/provider undercuts SimplePractice ($29-$99/mo per provider) for multi-provider practices. Video minute inclusions are generous — a 30-minute consult at ~$0.005/min Twilio cost means 100 minutes costs ~$0.50 in infrastructure.

> **Demo mode:** Subscription billing is designed and spec'd to run in Stripe test mode — no real charges occur. The billing flow (plan selection, checkout, tier-based feature gating, upgrade/downgrade) is a **Should** priority item (see PRD). When implemented, it will be demonstrable using Stripe test cards. Production activation is gated on HIPAA-eligible infrastructure deployment (see BR-9).

### Revenue Projections (Conservative)

| Scenario | Practices | MRR | ARR |
|----------|-----------|-----|-----|
| **Floor** (portfolio only) | 0 | $0 | $0 |
| **Minimal traction** | 5 Starter | $145 | $1,740 |
| **Modest adoption** | 10 Starter + 3 Practice | $437 | $5,244 |
| **Aspirational** | 20 Starter + 10 Practice + 2 Enterprise | $1,680+ | $20,160+ |

> **Note:** Even the aspirational scenario is modest. Revenue is a validation signal, not a business objective. The real ROI is Upwork contracts at $75-200/hr enabled by the portfolio demonstration.

---

## 2. Core Business Rules

### BR-1: Tenant Data Isolation
No practice may access, view, or modify another practice's data under any circumstance. This includes patient records, appointment data, financial data, and configuration. Enforced by PostgreSQL RLS + application middleware. See SRS-1 §7.

### BR-2: Patient Account Portability
- A single patient account works across multiple practices
- Patient personal data belongs to the patient, not the practice
- Practices see patient booking history only for their own practice
- Patients can view all their appointments across practices in their portal

### BR-3: Appointment Integrity
- A confirmed appointment is a binding reservation
- Double-booking the same provider for the same time slot must be technically impossible (enforced via pessimistic locking on the availability engine)
- Cancellation policies are set by the practice and enforced by the platform
- Video room creation is tied to appointment lifecycle — rooms are created on confirmation, not before

### BR-4: Payment Processing
- All online payments flow through Stripe Connect Express
- Stripe charges its standard processing fee (~2.9% + $0.30) to the connected account
- MedConnect platform fee (1.0%) is collected via Stripe `application_fee_amount` on top of Stripe's fee
- Offline payment is a valid path: appointment confirms, payment collected at visit
- Total effective merchant cost: ~3.9% + $0.30 per online transaction
- Overpayment prevention: payment amount must not exceed appointment cost (validated server-side)
- Refunds follow the practice's cancellation policy and are processed through Stripe's refund API

### BR-5: Video Consultation Rules
- Video rooms are created when an appointment is confirmed (not at booking time)
- Rooms support 1:1 (single patient + single provider) and group sessions (up to 6 participants)
- Group sessions are used for: family consultations, group therapy, consultations with interpreters or caregivers
- Provider must join the room before the patient can leave the waiting room (waiting room pattern)
- Video rooms automatically close: (a) 15 minutes after the scheduled end time if neither party has connected (no-show detection), (b) 5 minutes after both parties disconnect (reconnection grace period), or (c) 30 minutes after the scheduled end time regardless of activity (hard time limit)
- Recording is OFF by default. If enabled by the practice, patients must consent before recording begins.

### BR-6: Intake Form Rules
- Intake forms are tied to services, not individual appointments
- Patients complete intake forms before the appointment (sent with confirmation email)
- Form data is stored as JSONB — structured but flexible
- Practices can create custom templates or use predefined templates (General Health, Dental, Mental Health)
- Completed intake forms are viewable by the provider before and during the appointment
- Incomplete intake forms do not block the appointment — they can be completed at check-in

### BR-7: Messaging Rules
- Messages are scoped to appointment threads (no general chat)
- Both providers and patients can initiate messages within an appointment thread
- Messages are delivered in real-time via WebSocket when both parties are online
- Unread messages trigger push notifications (email for MVP)
- Message history is retained for the life of the appointment record
- Providers can message patients in any appointment status except CANCELLED

### BR-8: Synthetic Data Requirement
- ALL patient data in the demo must be synthetic, generated by Synthea (MITRE open-source)
- No real PHI (Protected Health Information) may exist anywhere in the system
- Every page must display a disclaimer: "Demo application — synthetic data only. Not for clinical use."
- Synthea data is seeded via a reproducible pipeline (FHIR → CSV → Prisma seed)

### BR-9: HIPAA Compliance Boundary
- MedConnect in demo mode is NOT a covered entity and does NOT handle real PHI
- No BAA (Business Associate Agreement) is required for the demo
- HIPAA-eligible hosting (Aptible, AWS with BAA) is NOT required for the demo
- The Compliance Roadmap page documents what production deployment would require
- **Subscription billing is designed and spec'd for Stripe test mode.** The billing system (plan selection, checkout, feature gating, webhook handling) is a **Should** priority stretch goal. When implemented, it will be testable via Stripe test cards but will not process real payments. Production billing activation requires HIPAA-eligible infrastructure first — charging practices for a healthcare platform that isn't HIPAA-compliant would be a liability.
- If MedConnect transitions to production use with real patients:
  - BAAs required with Twilio, hosting provider, and all data processors
  - Migration from Railway → Aptible or AWS with BAA
  - Stripe test mode → live mode (requires HIPAA infrastructure first)
  - Audit logging for all PHI access
  - Encryption at rest (AES-256) and in transit (TLS 1.3)
  - Annual risk assessment

### BR-10: Reminder Rules
- Appointment reminders are sent at configurable intervals (default: 24h and 1h before)
- Reminders include: appointment date/time, provider name, service, video join link (if telehealth), practice address (if in-person)
- Patients can opt out of SMS reminders but not email confirmations
- Reminder delivery failures are retried up to 3 times with exponential backoff

---

## 3. Multi-Tenancy Business Requirements

**Strategy:** Shared Database with Row-Level Security (RLS). Every practice-scoped table includes `practice_id`. Technical implementation in SRS-1 §7.

### Acceptance Criteria (BR-MT-1)
- Each practice has isolated data (no cross-practice leakage)
- Practices can customize branding (logo, colors) on their booking page
- Single codebase, no per-practice deployment
- Adding a practice requires no developer intervention (self-service onboarding)
- Performance not degraded by other practices' load

---

## 4. Practice Onboarding Requirements

### Setup Flow

```
Sign Up → Email Verification → Practice Profile → First Provider → First Service → Booking Page Live

  Practice Profile:
    Required: Practice name, timezone, specialty category
    Optional: Logo, description, address, contact info

  First Provider:
    Required: Name, email, specialties (select from list)
    Optional: Bio, credentials, avatar

  First Service:
    Required: Service name, duration, price (can be $0 for free consultations)
    Optional: Description, intake form template, consultation type (video/in-person/phone/both)

  → Booking page is now LIVE with sensible defaults:
    - Availability: Mon-Fri 9:00 AM - 5:00 PM (practice timezone)
    - Slot duration: matches service duration
    - Confirmation mode: AUTO_CONFIRM
    - Cancellation policy: free cancellation 24h before
    - Reminders: email at 24h and 1h before
```

### Specialty Categories

| Category | Preset Defaults |
|----------|----------------|
| PRIMARY_CARE | Mon-Fri 8-5, 30min slots, General Health intake template |
| MENTAL_HEALTH | Mon-Fri 9-6, 50min slots, Mental Health intake template |
| DENTAL | Mon-Sat 8-5, 30min slots, Dental intake template |
| DERMATOLOGY | Mon-Fri 9-5, 20min slots, General Health intake template |
| PHYSICAL_THERAPY | Mon-Fri 7-6, 45min slots, General Health intake template |
| SPECIALIST | Mon-Fri 9-5, 30min slots, General Health intake template |
| OTHER | Mon-Fri 9-5, 30min slots, General Health intake template |

Category selection triggers a one-time preset function that writes concrete records (availability rules, default intake template link). After preset application, all values are freely modifiable. The preset is not stored as persistent configuration.

### Acceptance Criteria (BR-ONB-1)
- Sign-up to working booking page in under 5 minutes
- No technical knowledge required
- Onboarding can be paused and resumed
- Booking page URL issued immediately upon completing first service setup
- Payment configuration is optional — appointments work without payments connected

---

## 5. Stakeholder Success Criteria

| Stakeholder | Needs | Success Criteria |
|-------------|-------|-----------------|
| **SJD Labs** | Portfolio credibility, healthcare domain demonstration, Upwork signal | Deployed demo with video, payments, compliance page; 3 shipped apps total |
| **Practice Owners** | Easy onboarding, online booking, video consultations, payment collection | Booking page live in <5 min, video consultation working, Stripe connected |
| **Providers** | Unified daily view, video launch from dashboard, patient intake visible pre-appointment | Single dashboard for schedule + video + notes + messages |
| **Patients** | Self-service booking, intake before visit, video from browser, secure messaging | Complete booking <3 min, video join with 1 click, messages delivered real-time |
| **Upwork Evaluators** | Evidence of healthcare domain expertise, shipping velocity, code quality | Live demo URL, compliance roadmap, clean codebase, comprehensive tests |

---

## 6. Constraints

### Technical
- **Solo developer + AI pipeline:** Architecture must be maintainable by one developer with Claude Code (complexity) and Qwen3 (volume). This pipeline is itself a portfolio demonstration.
- **2-week sprint:** Entire platform must ship in ~80 working hours. Module reuse from prior projects accelerates delivery.
- **TypeScript monorepo:** All code must be TypeScript (NestJS backend, Next.js frontend).
- **Twilio trial credits:** ~$15.50 for video rooms. Sufficient for demo and testing, not production scale.
- **Web-only:** No native mobile app. Mobile-responsive web covers all patient booking and video scenarios.
- **Synthetic data only:** No real patient data at any point. Synthea generates all patient records.

### Business
- **Bootstrap funding:** No external funding. Infrastructure costs must be minimal (Railway free/hobby tier, Vercel free tier, Twilio trial).
- **Revenue is secondary:** Platform is designed to generate revenue but income expectations are near-zero initially. The real value is Upwork contract acquisition.
- **No marketing spend:** Discovery is via portfolio demonstration, not paid acquisition.

### Regulatory
- **HIPAA (demo boundary):** Not a covered entity with synthetic data. No BAA required. Compliance Roadmap documents the production path.
- **PCI DSS:** Never store/process/transmit raw card data. Stripe Elements handles all card input.
- **Disclaimer required:** Every page must display "Demo application — synthetic data only. Not for clinical use."
- **GDPR ready:** Consent collection infrastructure in place (consent_records table). Actual GDPR applicability depends on user geography.

---

## 7. Assumptions

1. MedConnect's primary value is as a portfolio asset for SJD Labs — demonstrating healthcare domain expertise for freelance work
2. Telehealth demand continues growing post-COVID, sustaining relevance of the demonstration
3. Small practices (1-10 providers) are underserved by existing tools (too expensive or too complex)
4. Patients prefer self-service booking over phone calls, especially for telehealth
5. Twilio Video SDK provides reliable 1:1 and small-group video at trial credit budget
6. Stripe Connect Express onboarding is straightforward enough for non-technical practice admins
7. Synthea generates sufficiently realistic patient data for a convincing demo
8. Google Calendar is the dominant calendar for small healthcare practices
9. Solo developer + AI pipeline can deliver this scope in 2 weeks (validated by SavSpot and LifePlace delivery history)
10. Healthcare Upwork clients evaluate working demos more than certifications or credentials

---

## 8. Dependencies

| Dependency | Type | Risk | Mitigation |
|-----------|------|------|-----------|
| Twilio Video SDK | External | **High** | SDK 2.x EOL December 5, 2026 (~9 months). Trial credits budget-limited. Mitigation: (1) video provider abstraction layer (SRS-3 §6.10) decouples business logic from Twilio SDK, (2) Daily.co identified as primary migration target (HIPAA BAA, similar API, $30K migration credit for Twilio customers), (3) LiveKit as open-source fallback (self-hostable, HIPAA BAA on Cloud plans). Pre-record demo video as additional fallback. |
| Stripe Connect | External | Low | Well-established. Test mode covers all demo scenarios. Same integration pattern proven in SavSpot. |
| Synthea (MITRE) | External | Low | Open-source, actively maintained. FHIR output format is stable. Budget 4h for data pipeline. |
| Railway | Hosting | Low | Portable NestJS app. Can migrate to Fly.io, Render, or AWS if needed. |
| Vercel | Hosting | Low | Standard Next.js deployment. Portable. |
| Google Calendar API | External | Low | Well-established, high reliability. OAuth token refresh handling is the main concern. |
| Resend | External | Low | Commodity email provider. Easy to switch. |
| Socket.io | Library | Low | Battle-tested WebSocket library. 10+ years of production use. |
| NestJS 11 | Framework | Low | Stable, well-documented. Team has deep experience from SavSpot. |
| Prisma 6 | ORM | Medium | Prisma 7 released (Nov 2025) with breaking changes: ESM-only, new `prisma-client` generator (Rust-free, 90% smaller bundle), required `output` field, `$use()` middleware removed. Project starts on Prisma 6 for stability; migration to v7 planned post-launch (see SRS-1 §2 migration note). |

---

## 9. Glossary

| Term | Definition |
|------|-----------|
| **Practice** | A healthcare business registered on MedConnect (the tenant). Owns providers, services, and appointments. |
| **Provider** | A healthcare professional who sees patients. Belongs to one or more practices via tenant_memberships. |
| **Patient** | A user who books and attends appointments. Can book across multiple practices with a single account. |
| **Appointment** | A scheduled interaction between a provider and patient. May be in-person, video, or phone. |
| **Video Room** | A Twilio Video room associated with an appointment. Created on confirmation, active during the appointment window. |
| **Intake Form** | A structured questionnaire completed by patients before their appointment. Stored as JSONB. |
| **Booking Page** | A practice's public-facing page where patients browse providers, services, and available time slots. |
| **Waiting Room** | The video pre-call state where the patient waits until the provider joins and admits them. |
| **Slot** | A bookable time window calculated from a provider's availability rules minus existing appointments and blocked dates. |
| **PHI** | Protected Health Information — any health data that can identify an individual. MedConnect uses only synthetic PHI. |
| **BAA** | Business Associate Agreement — a HIPAA-required contract between covered entities and their data processors. Not required for MedConnect's demo since no real PHI exists. |
| **Synthea** | An open-source synthetic patient generator from MITRE. Produces realistic FHIR-format patient records. |
| **FHIR** | Fast Healthcare Interoperability Resources — a standard for exchanging healthcare information. Synthea outputs FHIR bundles. |
| **Compliance Roadmap** | An in-app page documenting what HIPAA production deployment would require. A key demo feature. |
| **Tenant** | Synonym for Practice in the multi-tenancy context. Each practice is a tenant with isolated data. |
| **RLS** | Row-Level Security — PostgreSQL feature enforcing data isolation at the database level. |
| **Consultation Type** | Whether an appointment is VIDEO, IN_PERSON, PHONE, or BOTH (patient chooses at booking). Determines whether a Twilio room is created. Services set the consultation type; BOTH resolves to VIDEO or IN_PERSON at booking time. |
| **Group Session** | A video consultation with multiple participants (up to 6). Used for family consultations, group therapy, etc. |

---

**Company:** SJD Labs, LLC | **Founder:** Stephen Deslate
