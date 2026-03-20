# MedConnect — Product Requirements Document

**Author:** SJD Labs, LLC
**Document:** PRD
**Date:** 2026-03-19

---

## 1. Priority Legend

| Priority | Meaning |
|----------|---------|
| **Must** | Required for demo launch |
| **Should** | High value; included if time permits within 2-week sprint |
| **Could** | Desirable; deferred without impact to launch |

---

## 2. Scope

MedConnect ships as a single-phase, 2-week sprint. All **Must** requirements are delivered by end of Week 2. **Should** requirements are stretch goals within the sprint. **Could** requirements are documented for future development if the platform gains traction. See [WIREFRAMES.md](WIREFRAMES.md) for ASCII wireframes of all critical views.

---

## 3. Functional Requirements

### 3.1 Authentication & Authorization (FR-AUTH)

| ID | Requirement | Priority | Description |
|----|-------------|----------|-------------|
| FR-AUTH-1 | Email/password registration | Must | Users register with email + password. Passwords hashed with bcrypt (min 12 rounds). |
| FR-AUTH-2 | Email verification | Must | Verification email sent on registration. Unverified users can browse but not book or manage practice. |
| FR-AUTH-3 | JWT authentication | Must | Access token (15 min) + refresh token (7 days). Access token in memory, refresh token in httpOnly cookie. |
| FR-AUTH-4 | Google OAuth | Should | OAuth 2.0 sign-in via Google. Auto-links if email matches existing account. |
| FR-AUTH-5 | Role-based access control | Must | Platform roles: PLATFORM_ADMIN, USER. Practice roles via tenant_memberships: OWNER, ADMIN, PROVIDER. Patients are users with bookings but no membership. |
| FR-AUTH-6 | Practice context middleware | Must | Every authenticated request resolves practice context from JWT claims or URL slug. Sets RLS session variable. |
| FR-AUTH-7 | Password reset | Must | Email-based password reset flow. Token expires in 1 hour. |
| FR-AUTH-8 | Guest checkout | Should | Patients can book without creating an account. Silent user record created from email + name. Account claimable later. |

### 3.2 Practice Onboarding (FR-ONB)

| ID | Requirement | Priority | Description |
|----|-------------|----------|-------------|
| FR-ONB-1 | Practice creation wizard | Must | Step-by-step: practice profile → first provider → first service → booking page live. |
| FR-ONB-2 | Specialty category selection | Must | Category selection (PRIMARY_CARE, MENTAL_HEALTH, DENTAL, DERMATOLOGY, PHYSICAL_THERAPY, SPECIALIST, OTHER) triggers one-time preset function. |
| FR-ONB-3 | Practice profile | Must | Name, description, logo upload, cover photo, timezone, address, contact info. Name and timezone required; rest optional. |
| FR-ONB-4 | First provider setup | Must | Auto-creates provider profile for the registering user. Name, email, specialties (multi-select from predefined list). |
| FR-ONB-5 | First service setup | Must | Service name, duration (minutes), price, consultation type (VIDEO, IN_PERSON, PHONE, BOTH). Defaults applied from specialty preset. |
| FR-ONB-6 | Booking page activation | Must | Booking page URL (medconnect.app/{slug}) is live immediately after first service creation. |
| FR-ONB-7 | Stripe Connect onboarding | Should | Practice admin initiates Stripe Connect Express onboarding. Booking page works without payments connected (appointments are free or pay-at-visit). |
| FR-ONB-8 | Specialty preset application | Must | One-time function writes availability rules, default intake form template link, reminder settings based on selected category. See BRD §4. |

### 3.3 Provider Management (FR-PROV)

| ID | Requirement | Priority | Description |
|----|-------------|----------|-------------|
| FR-PROV-1 | Provider profile | Must | Name, email, phone, specialties (array), credentials, bio (rich text), avatar URL. |
| FR-PROV-2 | Provider availability rules | Must | Per-provider weekly rules: day_of_week, start_time, end_time, slot_duration_minutes. Multiple rules per day supported (e.g., morning + afternoon blocks). |
| FR-PROV-3 | Provider blocked dates | Must | Date-specific overrides that block availability (vacations, conferences, personal days). Supports single day or date range. Optional reason text. |
| FR-PROV-4 | Provider services | Must | Many-to-many: providers linked to services they offer. A service may be offered by multiple providers. |
| FR-PROV-5 | Provider dashboard | Must | Today's schedule (timeline view), upcoming appointments, patient queue, quick-access video launch, unread messages count. |
| FR-PROV-6 | Provider search/browse | Must | Patients browse providers on booking page. Filter by specialty, service, availability. Provider cards show name, photo, specialties, next available slot. |
| FR-PROV-7 | Add/remove providers | Must | Practice OWNER/ADMIN can invite providers (sends email invitation) or remove them (revokes tenant_membership). |

### 3.4 Services (FR-SVC)

| ID | Requirement | Priority | Description |
|----|-------------|----------|-------------|
| FR-SVC-1 | Service CRUD | Must | Name, description, duration_minutes, price (Decimal), consultation_type (VIDEO, IN_PERSON, PHONE, BOTH), is_active. |
| FR-SVC-2 | Consultation type | Must | VIDEO = Twilio room created on confirmation. IN_PERSON = no video room. PHONE = phone consultation (no video room, provider calls patient). BOTH = patient chooses at booking time (VIDEO or IN_PERSON). |
| FR-SVC-3 | Intake form linking | Must | Optional FK to intake_form_template. When set, patients are prompted to complete the form after booking. |
| FR-SVC-4 | Service categories | Should | Group services by category on the booking page (e.g., "Initial Consultations", "Follow-ups", "Specialized"). |
| FR-SVC-5 | Group session config | Must | `max_participants` field (default 2 = 1:1). When >2, multiple patients can book the same time slot up to the limit. Used for group therapy, classes. |
| FR-SVC-6 | Buffer times | Should | `buffer_before_minutes` and `buffer_after_minutes` (default 0). Availability engine subtracts buffers from bookable slots. |

### 3.5 Appointment Booking (FR-APT)

| ID | Requirement | Priority | Description |
|----|-------------|----------|-------------|
| FR-APT-1 | Booking flow | Must | Patient flow: Browse providers → Select service → Select date/time → Fill intake form (if configured) → Review & pay (if configured) → Confirmation. |
| FR-APT-2 | Slot availability engine | Must | Calculate available slots from: provider availability rules − existing appointments − blocked dates − buffer times − INBOUND calendar events. Timezone-aware. |
| FR-APT-3 | Slot reservation (hold) | Must | When patient selects a slot, create a temporary hold (10 min TTL) to prevent double-booking during the booking flow. Redis-backed with DB fallback. |
| FR-APT-4 | Appointment confirmation | Must | On successful booking (+ payment if required): appointment status → CONFIRMED. Confirmation email sent. Calendar event created (if provider has calendar connected). |
| FR-APT-5 | Appointment cancellation | Must | Patient or provider can cancel. Cancellation policy determines refund (if payment was collected). Releases the time slot. Cancellation email sent. |
| FR-APT-6 | Appointment rescheduling | Must | Patient or provider can reschedule to a new available slot. Old slot released, new slot reserved. Reschedule confirmation email sent. |
| FR-APT-7 | No-show detection | Must | BullMQ job runs after appointment end_time + 15 min grace period. For VIDEO appointments: if no check-in and no video room activity, marks as NO_SHOW. For IN_PERSON/PHONE: no-show is marked manually by the provider. |
| FR-APT-8 | Auto-completion | Must | BullMQ job runs after appointment end_time. For IN_PERSON/PHONE CONFIRMED appointments (where check-in may not be tracked digitally), auto-transitions to COMPLETED. VIDEO appointments are excluded — they go to NO_SHOW via FR-APT-7 if no video activity occurs. |
| FR-APT-9 | Appointment notes | Must | Providers can add private notes to appointments (visible only to practice staff). Stored as text, supports Markdown. |
| FR-APT-10 | Appointment status filter | Must | Provider dashboard and admin views can filter by: PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW. |
| FR-APT-11 | Booking confirmation email | Must | Includes: date, time, provider, service, consultation type, video join link (if VIDEO), intake form link (if configured), practice address (if IN_PERSON), cancellation policy. |
| FR-APT-12 | Follow-up prompt | Should | After COMPLETED status, follow-up email with deep-link to re-book same provider + service. Sent 24h after completion. |

### 3.6 Video Consultation (FR-VID)

| ID | Requirement | Priority | Description |
|----|-------------|----------|-------------|
| FR-VID-1 | Room creation | Must | Twilio Video room created when appointment status transitions to CONFIRMED. Room name = appointment ID. Room type = `group` (supports 1:1 and multi-party). |
| FR-VID-2 | Token generation | Must | Short-lived Twilio access tokens generated per participant. Token includes room name and participant identity. Token TTL = appointment duration + 30 min buffer. |
| FR-VID-3 | Waiting room | Must | Patient enters waiting room on join. Provider sees "Patient is waiting" notification. Provider admits patient by joining the room. Patient sees "Waiting for provider..." until provider connects. |
| FR-VID-4 | 1:1 consultation | Must | Single patient + single provider in a video room. Both see each other's video + audio. Call controls: mute audio, mute video, end call. Screen share control added when FR-VID-6 is implemented. |
| FR-VID-5 | Group consultation | Should | Up to 6 participants. Provider is the host. Grid layout for participants. Same controls as 1:1 plus participant list. Used for family consultations, group therapy. Room type is already `group` (FR-VID-1), so backend supports this natively — this FR covers the frontend multi-participant UI. |
| FR-VID-6 | Screen sharing | Should | Either party can share their screen. Shared screen replaces main video (picture-in-picture for self-view). One screen share active at a time. Twilio SDK supports this natively — this FR covers the frontend screen share UI and toggle control. |
| FR-VID-7 | Call duration display | Must | Timer showing elapsed call duration visible to both parties. |
| FR-VID-8 | Auto-disconnect | Must | Room automatically closes: (a) 15 min after scheduled end time if no participants have connected (no-show), (b) 5 min after both parties disconnect (reconnection grace period), or (c) 30 min after scheduled end time if session is still active (hard limit). |
| FR-VID-9 | Connection quality indicator | Should | Visual indicator of connection quality (good/fair/poor) based on Twilio's network quality API. |
| FR-VID-10 | Reconnection handling | Must | If a participant disconnects (network issue), they can rejoin within 5 minutes using the same token. Other party sees "Reconnecting..." status. |
| FR-VID-11 | Video room status tracking | Must | Track room status: CREATED → WAITING → IN_PROGRESS → COMPLETED. Store started_at, ended_at, actual_duration_seconds in video_rooms table. |
| FR-VID-12 | Pre-call device check | Should | Before joining, test camera, microphone, and speaker. Show preview of own video. Allow device selection if multiple cameras/mics available. |

### 3.7 Intake Forms (FR-INT)

| ID | Requirement | Priority | Description |
|----|-------------|----------|-------------|
| FR-INT-1 | Predefined templates | Must | Three built-in templates: General Health (demographics, allergies, medications, conditions), Dental (dental history, current concerns, x-ray date), Mental Health (presenting concerns, therapy history, emergency contact, medication list). |
| FR-INT-2 | Custom template builder | Should | Practice admin creates custom templates with field types: text, textarea, select, multi-select, checkbox, date, number, phone, email. |
| FR-INT-3 | Form completion flow | Must | After booking confirmation, patient receives email with link to complete intake form. Form is also accessible from patient portal. |
| FR-INT-4 | Form data storage | Must | Completed form data stored as JSONB on intake_submissions table, linked to appointment. Includes completed_at timestamp. |
| FR-INT-5 | Provider view | Must | Provider can view completed intake form from appointment detail page and during video consultation (sidebar panel). |
| FR-INT-6 | Form completion status | Must | Track per-appointment whether intake form is PENDING, COMPLETED, or NOT_REQUIRED. Show status badge on appointment cards. |
| FR-INT-7 | Form reminder | Should | If intake form not completed 24h before appointment, send reminder email with direct link. |

### 3.8 Patient Portal (FR-PP)

| ID | Requirement | Priority | Description |
|----|-------------|----------|-------------|
| FR-PP-1 | Upcoming appointments | Must | List of future appointments with: date, time, provider, service, status, consultation type, video join button (if VIDEO). |
| FR-PP-2 | Past appointments | Must | History of completed/cancelled appointments with: date, provider, service, notes (if provider shared), payment receipt. |
| FR-PP-3 | Appointment actions | Must | Cancel, reschedule, or join video from the appointment card. Actions available based on appointment status and timing. |
| FR-PP-4 | Messages | Must | View and send messages in appointment-scoped threads. Real-time via WebSocket. Unread count badge. |
| FR-PP-5 | Intake forms | Must | List of pending and completed intake forms. Link to complete pending forms. View completed submissions. |
| FR-PP-6 | Payment history | Should | List of payments with: date, amount, status, receipt link. |
| FR-PP-7 | Profile management | Must | Edit name, email, phone, avatar. Change password. |
| FR-PP-8 | Multi-practice view | Must | If patient has appointments across multiple practices, show all in a unified view grouped by practice. |
| FR-PP-9 | Patient data export | Should | Patient can request a machine-readable export (JSON) of all their personal data: profile, appointments, intake form submissions, payment history, messages, and consent records. Implements GDPR Article 20 data portability readiness. Export generated asynchronously (BullMQ job) and delivered via a time-limited download link (Cloudflare R2, 24h expiry). See SRS-4 §10.3. |

### 3.9 Secure Messaging (FR-MSG)

| ID | Requirement | Priority | Description |
|----|-------------|----------|-------------|
| FR-MSG-1 | Appointment-scoped threads | Must | Each appointment has one message thread. Messages belong to the thread, not to individual users. |
| FR-MSG-2 | Real-time delivery | Must | Messages delivered via WebSocket (Socket.io). Client connects on page load, subscribes to appointment thread channels. |
| FR-MSG-3 | Message types | Must | TEXT (plain text with Markdown), SYSTEM (auto-generated: "Appointment confirmed", "Video room ready"). FILE type (attachment URL) is a Could-priority extension — see FR-MSG-7. When implemented, the `MessageType` enum (SRS-2) will be extended to include FILE. |
| FR-MSG-4 | Read receipts | Must | Messages marked as read when the recipient views the thread. Provider sees read/unread status per message. |
| FR-MSG-5 | Offline delivery | Must | If recipient is offline, message stored in DB. On next connection, undelivered messages are pushed. Email notification sent for messages unread after 5 minutes. |
| FR-MSG-6 | Typing indicator | Should | Show "typing..." when the other party is composing a message. WebSocket event, not persisted. |
| FR-MSG-7 | File attachments | Could | Upload images or documents within a thread. Files stored in Cloudflare R2. Max 10MB per file. |

### 3.10 Payment Processing (FR-PAY)

| ID | Requirement | Priority | Description |
|----|-------------|----------|-------------|
| FR-PAY-1 | Stripe Connect Express onboarding | Must | Practice admin initiates Stripe Connect Express setup from practice settings. MedConnect is the platform; practices are connected accounts. |
| FR-PAY-2 | Payment collection at booking | Must | When practice has Stripe connected and service has price > $0: patient pays during booking flow via Stripe Elements (card input). Payment intent created with `application_fee_amount` (1% platform fee). |
| FR-PAY-3 | Payment confirmation | Must | On successful payment: payment record created, appointment transitions to CONFIRMED, receipt email sent to patient. |
| FR-PAY-4 | Refund processing | Must | On cancellation within refund window: automatic refund via Stripe Refund API. Refund amount determined by cancellation policy (full, partial, or none based on timing). |
| FR-PAY-5 | Payment status tracking | Must | Track payment status: PENDING → SUCCEEDED → REFUNDED (or FAILED). Webhook-driven status updates from Stripe. |
| FR-PAY-6 | Offline payment path | Must | Appointments book and confirm without online payment. Payment collected at visit. Payment record created manually by staff or left as unpaid. |
| FR-PAY-7 | Stripe webhook handling | Must | Handle: payment_intent.succeeded, payment_intent.payment_failed, charge.refunded, account.updated (Connect onboarding status). Webhook signature verification required. |
| FR-PAY-8 | Payment receipt email | Must | Sent on successful payment. Includes: amount, date, service, provider, practice name, Stripe receipt URL. |

### 3.11 Notifications & Reminders (FR-NOT)

| ID | Requirement | Priority | Description |
|----|-------------|----------|-------------|
| FR-NOT-1 | Email notifications | Must | Transactional emails via Resend: booking confirmation, cancellation, reschedule, payment receipt, intake form link, appointment reminder, follow-up. |
| FR-NOT-2 | Appointment reminders | Must | BullMQ scheduled jobs: 24h before and 1h before appointment. Email delivery. Include video join link for telehealth appointments. |
| FR-NOT-3 | SMS reminders | Should | SMS via Twilio (reuse existing account): 1h before appointment. Short message with appointment time + video join link. Patient opt-in required. |
| FR-NOT-4 | In-app notifications | Must | Bell icon with unread count. Notification types: new appointment, cancellation, new message, intake form completed, video room ready. |
| FR-NOT-5 | Notification preferences | Should | Patient can configure: email ON/OFF per type, SMS ON/OFF. System notifications (security alerts) always ON. |
| FR-NOT-6 | Provider notifications | Must | Real-time (WebSocket): new booking, cancellation, patient in waiting room, new message. Dashboard shows notification feed. |

### 3.12 Calendar Sync (FR-CAL)

| ID | Requirement | Priority | Description |
|----|-------------|----------|-------------|
| FR-CAL-1 | Google Calendar connection | Must | Provider connects Google Calendar via OAuth 2.0. Stores access_token + refresh_token in calendar_connections table. |
| FR-CAL-2 | Outbound sync (MedConnect → Calendar) | Must | When appointment confirmed: create Google Calendar event with title, time, patient name, video link. When cancelled/rescheduled: update/delete event. |
| FR-CAL-3 | Inbound sync (Calendar → MedConnect) | Should | Poll Google Calendar every 15 min for new events. INBOUND events block availability (prevents double-booking with external commitments). |
| FR-CAL-4 | Outlook Calendar connection | Should | Same as Google but via Microsoft Graph API. OAuth 2.0 with Azure AD. |
| FR-CAL-5 | Calendar event details | Must | Event includes: appointment title ("[Service] with [Patient]"), start/end time, location (video link or practice address), description with intake form status. |
| FR-CAL-6 | Token refresh | Must | Background job refreshes OAuth tokens before expiry. If refresh fails, mark calendar_connection status as DISCONNECTED and prompt re-auth. |

### 3.13 Practice Admin Dashboard (FR-ADM)

| ID | Requirement | Priority | Description |
|----|-------------|----------|-------------|
| FR-ADM-1 | Appointment overview | Must | Today's appointments across all providers. Status breakdown (confirmed, in-progress, completed, cancelled, no-show). |
| FR-ADM-2 | Provider management | Must | List providers, view/edit profiles, manage availability, invite new providers, deactivate providers. |
| FR-ADM-3 | Service management | Must | CRUD services, link intake templates, set pricing, configure consultation types. |
| FR-ADM-4 | Practice settings | Must | Edit practice profile, branding (logo, colors), timezone, address. |
| FR-ADM-5 | Payment dashboard | Should | Revenue summary (daily, weekly, monthly). Payment list with status filters. Stripe Connect account status. |
| FR-ADM-6 | Appointment analytics | Should | Charts: appointments per day/week, completion rate, no-show rate, average consultation duration. Recharts visualization. |
| FR-ADM-7 | Patient list | Must | Searchable list of patients who have booked at this practice. View booking history per patient. |

### 3.14 Compliance Roadmap Page (FR-CMP)

| ID | Requirement | Priority | Description |
|----|-------------|----------|-------------|
| FR-CMP-1 | In-app compliance documentation | Must | Public page at /compliance-roadmap documenting what production HIPAA deployment requires. Accessible without authentication. |
| FR-CMP-2 | Administrative safeguards | Must | Document: risk assessment, workforce training, access management policies, incident response procedures. |
| FR-CMP-3 | Physical safeguards | Must | Document: facility access controls, workstation security, device and media controls. |
| FR-CMP-4 | Technical safeguards | Must | Document: access controls (RBAC), audit logging, integrity controls, transmission security (TLS 1.3, DTLS-SRTP for video). |
| FR-CMP-5 | Encryption documentation | Must | Document: AES-256 at rest, TLS 1.3 in transit, DTLS-SRTP for Twilio Video, bcrypt for passwords. |
| FR-CMP-6 | BAA requirements | Must | Document: which vendors require BAAs (Twilio, hosting provider, email provider), what a BAA covers, when it's required. |
| FR-CMP-7 | Infrastructure migration path | Must | Document: current demo infrastructure (Railway, Vercel) → production path (Aptible or AWS with BAA, HIPAA-eligible PostgreSQL). |
| FR-CMP-8 | Audit logging architecture | Must | Document: what gets logged (all PHI access), log format, retention, tamper-evidence. Show the audit_logs table schema. |
| FR-CMP-9 | Data retention policies | Must | Document: configurable retention per data category, automatic purge schedules, legal hold capability. |
| FR-CMP-10 | Breach notification | Must | Document: 60-day HIPAA notification requirement, 72-hour GDPR requirement, notification workflow, incident response template. |

### 3.15 Synthetic Data Seeding (FR-SEED)

| ID | Requirement | Priority | Description |
|----|-------------|----------|-------------|
| FR-SEED-1 | Synthea patient generation | Must | Generate 50 synthetic patients using Synthea. Extract: name, DOB, gender, address, phone, email, conditions, medications, allergies. |
| FR-SEED-2 | FHIR → Prisma mapping | Must | Parse Synthea FHIR Bundle JSON → extract Patient, Condition, MedicationRequest, AllergyIntolerance resources → map to MedConnect patient records and intake form data. |
| FR-SEED-3 | Practice seeding | Must | Create 5 demo practices: "Sunrise Family Medicine" (PRIMARY_CARE), "Clear Mind Therapy" (MENTAL_HEALTH), "Bright Smile Dental" (DENTAL), "SkinCare Dermatology" (DERMATOLOGY), "ActiveLife Physical Therapy" (PHYSICAL_THERAPY). |
| FR-SEED-4 | Provider seeding | Must | Create 15 providers across the 5 practices (3 per practice). Realistic names, specialties, bios, avatar URLs (placeholder images). |
| FR-SEED-5 | Appointment history | Must | Generate 200 past appointments with realistic distribution: 70% COMPLETED, 10% CANCELLED, 10% NO_SHOW, 10% upcoming (CONFIRMED). |
| FR-SEED-6 | Message history | Should | Generate sample message threads for 20% of completed appointments. 2-5 messages per thread. |
| FR-SEED-7 | Payment records | Must | Generate payment records for appointments with services that have price > $0. Match appointment status (SUCCEEDED for completed, REFUNDED for cancelled). |
| FR-SEED-8 | Intake form submissions | Must | Generate completed intake form data for 80% of completed appointments. Use Synthea condition/medication data to populate realistic responses. |
| FR-SEED-9 | Reproducible seeding | Must | Seed script is deterministic (seeded PRNG). `pnpm db:seed` produces identical data on every run. Reset with `pnpm db:reset && pnpm db:seed`. |
| FR-SEED-10 | Demo banner | Must | Every page displays: "Demo application — synthetic data only. Not for clinical use." Persistent banner, not dismissible. Branded but clearly visible. |

### 3.16 User Stories

#### Patient Stories
- **US-P-1:** As a patient, I want to browse providers by specialty so I can find the right doctor for my needs.
- **US-P-2:** As a patient, I want to see available time slots so I can book at a convenient time.
- **US-P-3:** As a patient, I want to complete my intake form online before my appointment so I don't waste time in the waiting room.
- **US-P-4:** As a patient, I want to join a video consultation from my browser so I don't need to install any software.
- **US-P-5:** As a patient, I want to message my provider between appointments so I can ask follow-up questions.
- **US-P-6:** As a patient, I want to see all my appointments across different practices in one place.
- **US-P-7:** As a patient, I want to reschedule or cancel my appointment online without calling the office.
- **US-P-8:** As a patient, I want to receive reminders before my appointment so I don't miss it.

#### Provider Stories
- **US-PR-1:** As a provider, I want to see today's appointment schedule at a glance so I can prepare for each patient.
- **US-PR-2:** As a provider, I want to review a patient's intake form before the video call so I'm informed.
- **US-PR-3:** As a provider, I want to launch a video consultation with one click from my dashboard.
- **US-PR-4:** As a provider, I want to add notes to an appointment after the consultation for my records.
- **US-PR-5:** As a provider, I want my MedConnect appointments to sync with my Google Calendar so I have one source of truth.
- **US-PR-6:** As a provider, I want to be notified when a patient is in the waiting room so I can join promptly.
- **US-PR-7:** As a provider, I want to message patients about their upcoming appointments.

#### Practice Admin Stories
- **US-A-1:** As a practice admin, I want to set up my practice and have a booking page live in under 5 minutes.
- **US-A-2:** As a practice admin, I want to manage multiple providers' schedules from one dashboard.
- **US-A-3:** As a practice admin, I want to see appointment analytics to understand practice utilization.
- **US-A-4:** As a practice admin, I want to connect Stripe so patients can pay online.
- **US-A-5:** As a practice admin, I want to create custom intake form templates for different services.

---

## 4. Non-Functional Requirements (Summary)

Detailed NFRs are in SRS-1 §13. Key targets:

| Requirement | Target |
|-------------|--------|
| API response time (p95) | < 200ms reads, < 500ms writes |
| Video connection time | < 5 seconds (Twilio SDK) |
| WebSocket message latency | < 200ms delivery |
| Booking page load (FCP) | < 2 seconds |
| Test coverage | > 85% |
| Concurrent sessions | 1,000+ |
| Uptime | 99.5% (managed deployment) |
| Accessibility | WCAG 2.1 Level AA conformance (see SRS-1 §13.6) |

---

## 5. Acceptance Criteria Summary

| Flow | Acceptance Criteria |
|------|--------------------|
| **Patient booking** | Patient can browse → select provider → select service → pick slot → fill intake → pay → receive confirmation in < 3 minutes |
| **Video consultation** | Provider and patient can join a video room, see/hear each other, share screen, and end call. Connection established in < 5 seconds. |
| **Group video** | Up to 6 participants in a single room with grid layout. All can see/hear each other. |
| **Messaging** | Message sent by provider appears on patient's screen in < 1 second (both online). Offline messages delivered on next connection. |
| **Practice onboarding** | New practice admin goes from sign-up to live booking page in < 5 minutes. |
| **Calendar sync** | Confirmed appointment appears as Google Calendar event within 30 seconds. |
| **Payment** | Patient pays via Stripe Elements. Payment succeeds. Practice receives payout (minus fees). Refund processes on cancellation. |
| **Intake form** | Patient completes form. Provider views completed data before and during video call. |
| **Compliance page** | All HIPAA safeguard categories documented with specific technical controls. Page is publicly accessible. |
| **Demo data** | 5 practices, 15 providers, 50 patients, 200 appointments with realistic data. Every page shows demo disclaimer. |

---

**Company:** SJD Labs, LLC | **Founder:** Stephen Deslate
