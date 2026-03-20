# MedConnect — Product Vision Document

**Author:** SJD Labs, LLC
**Document:** PVD
**Date:** 2026-03-19

---

## 1. Vision Statement

**"Healthcare, connected. Anywhere."**

MedConnect is a multi-tenant telehealth booking platform that enables healthcare practices to manage virtual and in-person appointments, conduct video consultations, collect payments, and communicate securely with patients — all from a single platform. Built by SJD Labs as a live portfolio piece demonstrating full-stack healthcare domain expertise, HIPAA-aware architecture, real-time video integration, and production-grade multi-tenant SaaS.

MedConnect serves two purposes simultaneously: (1) a technically impressive portfolio artifact for SJD Labs' freelance business on Upwork and beyond, demonstrating healthcare domain capability, and (2) a legitimate product that could onboard real healthcare practices if demand materializes.

---

## 2. Problem Statement

### What MedConnect Demonstrates

MedConnect proves that AI-assisted solo development can produce healthcare-grade software — a multi-tenant platform with video consultation, HIPAA-aware architecture, real-time messaging, payment processing, and calendar integration. The healthcare/telehealth domain provides the proving ground: it is genuinely hard (video reliability, compliance requirements, multi-party scheduling, patient data sensitivity) and produces a product that works for real practices.

### For Healthcare Practices (Supply Side)
- Scheduling fragmented across phone calls, email, and paper calendars — leading to double-bookings and no-shows
- No integrated video consultation capability despite growing patient demand for telehealth
- Patient intake forms still paper-based or handled through disconnected systems
- No unified view of appointments, payments, and patient communications
- HIPAA compliance requirements create fear of adopting new technology

### For Patients (Demand Side)
- Booking a healthcare appointment requires phone calls during business hours
- No self-service rescheduling or cancellation
- Intake forms must be filled out on arrival, wasting appointment time
- No secure way to message providers between appointments
- Video consultations require downloading unfamiliar apps (Zoom, Doxy.me) with no integration to the practice's workflow

### For the Market
- Telehealth adoption accelerated post-COVID but tooling remains fragmented
- Most telehealth platforms are video-only (Doxy.me) or EHR-integrated monoliths (Epic, Athenahealth)
- No open-source, self-hostable telehealth booking platform exists for small practices
- Healthcare is a high-paying vertical on freelance platforms — demonstrating domain expertise unlocks premium contracts

---

## 3. Target Audience

MedConnect's primary audience is technical evaluators who assess SJD Labs' capabilities. The product also serves healthcare practices, but the strategic framing prioritizes who is *looking at* MedConnect, not just who is *using* it.

### Primary Audience (Portfolio & Credibility)

| Audience | What They Evaluate | What Convinces Them |
|----------|-------------------|---------------------|
| **Upwork clients (healthcare)** | Healthcare domain knowledge, HIPAA awareness, video integration capability | Live demo with video consultation, compliance roadmap page, Twilio + Stripe integration |
| **Upwork clients (general)** | Full-stack capability, shipping velocity, architecture quality | Multi-tenant platform, real-time WebSocket messaging, comprehensive test suite |
| **Developers & architects** | Code quality, architecture decisions, technology choices | Clean codebase, NestJS + Prisma patterns, RLS multi-tenancy, comprehensive specs |
| **Potential SJD Labs clients** | Can this developer build what I need? | Three shipped portfolio apps (SavSpot, LifePlace, MedConnect) spanning different domains |

### Secondary Audience (Product Users)

| Segment | Examples |
|---------|----------|
| Small Practices | Solo practitioners, therapists, counselors, nutritionists |
| Group Practices | Multi-provider clinics (2-10 providers), dental offices, urgent care |
| Specialty Providers | Dermatology (visual telehealth), psychiatry, physical therapy |
| Allied Health | Speech therapy, occupational therapy, dietetics |

> **Market context:** The global telehealth market was valued at $87.4B in 2024 and is projected to reach $286.2B by 2030 (Grand View Research). MedConnect chose this domain because (1) healthcare is a premium freelance vertical, (2) the technical challenges (video, compliance, real-time scheduling) are genuinely impressive, and (3) the market need is real.

---

## 4. User Personas

### Primary Personas (Portfolio Audience)

| Persona | Role | What They're Evaluating | What They Do |
|---------|------|------------------------|--------------|
| **Hiring Hannah** (38, CTO at health-tech startup) | Potential Upwork client | Healthcare domain expertise, HIPAA architecture knowledge, Twilio/Stripe integration | Reviews MedConnect demo, reads compliance roadmap, evaluates code quality |
| **Dev Dana** (30, senior engineer) | Developer evaluating the codebase | Architecture quality, NestJS patterns, RLS multi-tenancy, WebSocket implementation | Browses GitHub, reads specs, evaluates code patterns |

### Secondary Personas (Product Users)

| Persona | Role | Pain | Goal |
|---------|------|------|------|
| **Dr. Sarah** (42, therapist, solo practice) | Practice Owner/Provider | Manages appointments via phone + Google Calendar, uses Zoom separately for video, no integrated payments | Single platform for booking, video, payments, patient communication |
| **Dr. Patel** (55, practice owner, 4 providers) | Practice Admin | Coordinates 4 providers' schedules manually, patients call front desk for all bookings, no online presence | Self-service patient booking, centralized provider management, practice analytics |
| **Nurse Kim** (28, provider at group practice) | Provider | Switches between EHR, calendar app, video tool, and messaging app for each patient | Unified dashboard: today's appointments, video join button, patient notes, messages |
| **Patient Alex** (34, working professional) | Patient | Can only call during lunch break to book appointments, fills out same forms every visit, doesn't know if provider offers telehealth | Book online anytime, fill intake forms before the visit, join video from phone |
| **Maya** (26, patient with anxiety) | Patient | Avoids calling to schedule, prefers text-based communication, wants telehealth but finds the process confusing | Book entirely online, message provider, join video consultation with one click |

---

## 5. Competitive Landscape

| Competitor | Pricing | Video | Booking | Payments | Open Source |
|-----------|---------|-------|---------|----------|-------------|
| **Doxy.me** | Free + $35/mo Pro | Yes (core) | No | No | No |
| **SimplePractice** | $29-$99/mo | Yes | Yes | Yes | No |
| **Jane App** | $54-$99/mo | Yes | Yes | Yes | No |
| **Zoom for Healthcare** | $13.33/mo/user | Yes (core) | No | No | No |
| **Healthie** | $59-$149/mo | Yes | Yes | Yes | No |
| **Athenahealth** | Enterprise | Yes | Yes | Yes | No |
| **OpenMRS** | Free (OSS) | No | No | No | Yes |

### Why This Domain Matters for SJD Labs

1. **Premium freelance vertical** — Healthcare projects on Upwork command $75-200/hr rates. Demonstrating domain expertise with a live platform is the strongest possible signal.
2. **Genuine technical complexity** — Real-time video (Twilio), HIPAA-aware architecture, WebSocket messaging, multi-party scheduling, payment processing. These are the same problems enterprise health-tech companies solve.
3. **Skill stacking** — Adds Twilio Video, WebSocket, healthcare compliance, and calendar sync to the portfolio. Combined with SavSpot (Stripe Connect, multi-tenant booking) and LifePlace, creates a comprehensive technical profile.
4. **No open-source competitor** — There is no open-source telehealth booking platform. OpenMRS is an EHR. Doxy.me is video-only. MedConnect occupies an empty niche.

### Differentiation

1. **All-in-one** — Booking + Video + Payments + Messaging + Intake Forms in a single platform (vs. Doxy.me video-only or Zoom video-only)
2. **Multi-tenant architecture** — Shared infrastructure, isolated data via RLS (vs. SimplePractice/Jane App single-tenant per deployment)
3. **HIPAA Compliance Roadmap** — Transparent documentation of what production compliance requires (vs. competitors who just say "HIPAA compliant")
4. **Self-service patient experience** — Patients book, fill intake forms, and join video without provider coordination
5. **Synthetic data demo** — Realistic demo with Synthea-generated patient data (vs. empty demos that require imagination)

---

## 6. Product Pillars

1. **Video-First Consultation** — 1:1 and group sessions (up to 6 participants), with waiting room, call controls, and screen sharing. Initial implementation uses Twilio Video SDK; abstraction layer supports migration to Daily.co or LiveKit (see SRS-3 §6.10).
2. **Self-Service Booking** — Patients browse providers, select services, check availability, fill intake forms, pay, and receive confirmation — no phone call needed
3. **Patient Portal** — Upcoming appointments, video join links, message threads, intake history, payment receipts
4. **Provider Dashboard** — Today's schedule, patient queue, video consultation launch, appointment notes, messaging
5. **Practice Admin** — Provider management, appointment analytics, payment reporting, practice settings
6. **Secure Messaging** — Real-time WebSocket messaging between providers and patients, scoped to appointment threads
7. **HIPAA Compliance Roadmap** — In-app documentation page demonstrating production-path compliance architecture — the demo feature that turns regulatory complexity into a portfolio asset

---

## 7. Success Metrics

### Primary Metrics (Portfolio & Credibility)

| Metric | Target | What It Proves |
|--------|--------|----------------|
| Demo quality | Polished, realistic data, all flows working | Can ship production-grade healthcare software |
| Compliance roadmap completeness | Covers all HIPAA safeguards | Understands healthcare compliance deeply |
| Video consultation reliability | 95%+ successful connections in demo | Can integrate real-time video reliably |
| Code quality | >85% test coverage, <200ms p95 reads / <500ms p95 writes | Enterprise-grade engineering |
| Upwork profile impact | Increased profile views, interview requests | Healthcare domain signal resonates |
| Time to ship | 2 weeks from start to deployed demo | AI-augmented shipping velocity |

### Secondary Metrics (Product Validation)

| Metric | Target | What It Validates |
|--------|--------|-------------------|
| Active practices | 5+ (if launched) | Product solves real problems |
| Appointments booked | 50+ | Booking flow works end-to-end |
| Video consultations completed | 10+ | Video integration is reliable |
| Patient satisfaction | Positive feedback | UX is intuitive |

**North Star Metric:** Completed Video Consultations — this is the single metric that proves the entire flow works (booking → intake → video → notes → payment → follow-up).

---

## 8. Portfolio Objectives

| # | Objective | Target | Timeline |
|---|-----------|--------|----------|
| PO-1 | Deployed, demo-ready platform | All user flows working with synthetic data | Week 2 |
| PO-2 | Video consultation showcase | Polished video UI with waiting room, controls, group support | Week 2 |
| PO-3 | HIPAA compliance roadmap page | Comprehensive production compliance documentation | Week 2 |
| PO-4 | Upwork profile integration | Screenshots, demo link, project description on profile | Week 3 |
| PO-5 | Portfolio skill demonstration | Twilio Video + WebSocket + Stripe Connect + Calendar Sync | Week 2 |
| PO-6 | Third shipped app | MedConnect joins SavSpot + LifePlace in portfolio | Week 2 |

---

## 9. Development Philosophy

- **Two-Tier AI Development Pipeline:**

| Tier | Tool | Work Type |
|------|------|-----------|
| **Complexity tier** | Claude Code (cloud) | Architecture, multi-file coordination, video integration, payment flows, compliance documentation |
| **Volume tier** | Qwen3 (local, zero marginal cost) | CRUD endpoints, React components, Prisma schemas, test factories, Zod schemas |

- **Solo Developer + AI:** SJD Labs, LLC (Stephen Deslate). Validated by prior art (SavSpot — 920 tests, live at savspot.co; LifePlace — shipped).
- **TypeScript everywhere** | **Multi-tenant from day one** | **API-first** | **Healthcare domain patterns**
- **Synthetic data** — All patient data generated by Synthea (MITRE). No real PHI at any point.
- **2-week sprint** — Compressed timeline demonstrates AI-augmented shipping velocity

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Twilio Video complexity | Use twilio-video SDK for 1:1/group; budget extra time for video UI. Pre-record demo video as fallback. |
| Twilio Video SDK EOL | Twilio Programmable Video SDK 2.x reaches end-of-life December 5, 2026 (~9 months). Mitigation: implement video provider abstraction layer (see SRS-3 §6.10) enabling migration to Daily.co (HIPAA BAA available, similar API surface) or LiveKit (open-source, self-hostable, SOC 2 / HIPAA BAA on Cloud plans). Demo ships with Twilio; abstraction layer ensures migration requires no frontend changes. |
| HIPAA misperception | Compliance Roadmap page proactively addresses "is this HIPAA compliant?" with production-path documentation. Disclaimer on every page. |
| Synthea data realism | Pre-process FHIR bundles → flat records with realistic names, conditions, dates. Budget 4h for data pipeline. |
| Video quality in demo | Record polished screen capture in addition to live demo. Test across browsers. |
| Twilio trial credit limits | ~$15.50 trial credits sufficient for demo. Budget 50-100 video room-minutes for testing + demo recording. |
| WebSocket complexity | Use Socket.io (battle-tested) with NestJS gateway. Fallback to HTTP polling if timeline pressure. |
| Calendar sync reliability | Google Calendar API well-established. Outlook via Microsoft Graph. Token refresh handling critical — budget 2h for edge cases. |
| Stripe Connect onboarding | Use test mode throughout demo. Pre-configure test connected accounts for each practice. |
| Scope creep | BUILD_PLAN is the scope contract. Features not in the plan are out of scope. Period. |

---

## 11. Out of Scope

- EHR/EMR integration (Epic, Cerner, Athenahealth)
- E-prescribing or medication management
- Clinical decision support or diagnostic features
- FDA SaMD (Software as a Medical Device) classification features
- Insurance verification or claims processing
- Multi-language UI (English only)
- Native mobile app (web-responsive covers all scenarios)
- HIPAA-eligible hosting (demo uses standard hosting; compliance roadmap documents the production path)
- Real patient data of any kind
- White-label / custom branding beyond practice logo and colors
- Recurring appointment automation (rebooking prompt via follow-up email is in scope)
- Lab results or diagnostic imaging
- Pharmacy integration

---

**Company:** SJD Labs, LLC | **Founder:** Stephen Deslate
