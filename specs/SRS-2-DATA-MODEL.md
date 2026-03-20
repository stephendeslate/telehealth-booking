# MedConnect — Software Requirements Specification: Data Model & API Reference

**Author:** SJD Labs, LLC
**Document:** SRS Part 2 of 4

---

## 1. Scope

This document defines every persistent data model and the API surface for MedConnect. For architecture see **SRS-1**; for booking/video/payment logic see **SRS-3**; for communications/security see **SRS-4**.

**Key design decisions:** (a) `users.role` is platform-level only (`PLATFORM_ADMIN`, `USER`); practice roles live on `tenant_memberships`. (b) Patients are users with bookings but no tenant_membership for that practice. (c) Intake form data stored as JSONB for schema flexibility. (d) Video room metadata tracked in `video_rooms` table, not embedded in appointments. (e) All practice-scoped tables include `practice_id` with RLS enforcement.

---

## 2. Entity Relationship Diagram

> **Note:** This is a simplified ERD showing primary relationships. Additional tables (refresh_tokens, invitation_tokens, slot_reservations, video_participants, service_providers, audit_logs, consent_records) are defined in their respective sections below.

```
+----------+       +-------------------+       +---------+
| practices|--1:N--| tenant_memberships|--N:1--| users   |
+----+-----+       | (OWNER/ADMIN/     |       +----+----+
     |              |  PROVIDER)        |            |
     |              +-------------------+            |
     |--1:N--> services --N:M--> service_providers   |
     |              (via service_providers join)      |
     |                                               |
     |--1:N--> provider_profiles <--1:1-- users (provider)
     |                                               |
     |         services -----N:1--> appointments <--N:1-- users (patient)
     |                                    |
     |--1:N--> availability_rules         +--1:1--> video_rooms
     |--1:N--> blocked_dates              +--1:N--> messages
     |--1:N--> intake_form_templates      +--1:1--> intake_submissions
     |--1:N--> calendar_connections       +--1:1--> payment_records
     |         --1:N--> calendar_events
     |
     +--1:N--> notifications <--N:1-- users
     +--1:N--> appointment_reminders
```

Practice is root aggregate; all business data scoped via `practice_id` + RLS. Appointment is the central transaction entity.

---

## 3. Enums

```typescript
// Platform-level user role
enum UserRole {
  PLATFORM_ADMIN  // System administrator
  USER            // Standard user (patient, practice member, or both)
}

// Practice membership role
enum MembershipRole {
  OWNER           // Practice creator, full access, billing
  ADMIN           // Full practice management, no billing
  PROVIDER        // Manages own schedule, sees own patients
}

// Appointment status
enum AppointmentStatus {
  PENDING         // Booked, awaiting confirmation or payment
  CONFIRMED       // Confirmed (auto or manual)
  IN_PROGRESS     // Video call active or patient checked in
  COMPLETED       // Appointment finished
  CANCELLED       // Cancelled by patient, provider, or system
  NO_SHOW         // Patient did not attend
}

// Consultation type
enum ConsultationType {
  VIDEO           // Twilio Video room created
  IN_PERSON       // No video room
  PHONE           // Phone consultation (no video room)
  BOTH            // Patient chooses at booking time (resolves to VIDEO or IN_PERSON at booking)
}

// Video room status
enum VideoRoomStatus {
  CREATED         // Room created, not yet joined
  WAITING         // Patient in waiting room, provider not yet joined
  IN_PROGRESS     // Both parties connected
  COMPLETED       // Session ended normally
}

// Payment status
enum PaymentStatus {
  PENDING         // Payment intent created, awaiting completion
  SUCCEEDED       // Payment successful
  FAILED          // Payment failed
  REFUNDED        // Full refund processed
  PARTIALLY_REFUNDED // Partial refund processed
}

// Confirmation mode
enum ConfirmationMode {
  AUTO_CONFIRM    // Appointment confirmed on booking/payment
  MANUAL_APPROVAL // Staff must approve
}

// Calendar connection provider
enum CalendarProvider {
  GOOGLE          // Google Calendar API v3
  OUTLOOK         // Microsoft Graph API
}

// Calendar event direction
enum CalendarEventDirection {
  OUTBOUND        // MedConnect → External Calendar
  INBOUND         // External Calendar → MedConnect (availability block)
}

// Calendar connection status
enum CalendarConnectionStatus {
  ACTIVE          // OAuth tokens valid
  DISCONNECTED    // Token refresh failed, re-auth required
}

// Message type
enum MessageType {
  TEXT            // User-authored text message
  SYSTEM          // Auto-generated system message
  // FILE         // Attachment URL — Could priority (FR-MSG-7). Add when file attachments are implemented.
}

// Intake form field type
enum IntakeFieldType {
  TEXT            // Single-line text input
  TEXTAREA        // Multi-line text input
  SELECT          // Single-select dropdown
  MULTI_SELECT    // Multi-select checkboxes
  CHECKBOX        // Boolean checkbox
  DATE            // Date picker
  NUMBER          // Numeric input
  PHONE           // Phone number input
  EMAIL           // Email input
}

// Intake submission status
enum IntakeStatus {
  PENDING         // Form sent, not yet completed
  COMPLETED       // Form submitted by patient
  NOT_REQUIRED    // No intake form configured for this service
}

// Notification type
enum NotificationType {
  APPOINTMENT_CONFIRMED
  APPOINTMENT_CANCELLED
  APPOINTMENT_RESCHEDULED
  APPOINTMENT_REMINDER
  NEW_MESSAGE
  INTAKE_FORM_COMPLETED
  VIDEO_ROOM_READY
  PAYMENT_RECEIVED
  PAYMENT_REFUNDED
  PATIENT_IN_WAITING_ROOM
}

// Practice specialty category
enum SpecialtyCategory {
  PRIMARY_CARE
  MENTAL_HEALTH
  DENTAL
  DERMATOLOGY
  PHYSICAL_THERAPY
  SPECIALIST
  OTHER
}
```

---

## 4. Platform Tables

### `practices`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| name | VARCHAR(255) | NOT NULL | Practice display name |
| slug | VARCHAR(100) | UNIQUE, NOT NULL | URL-safe slug for booking page (e.g., "sunrise-family-medicine") |
| description | TEXT | | Practice description shown on booking page |
| category | SpecialtyCategory | NOT NULL | Drives preset application at onboarding |
| logo_url | VARCHAR(500) | | Logo image URL (Cloudflare R2) |
| cover_photo_url | VARCHAR(500) | | Cover image for booking page |
| brand_color | VARCHAR(7) | | Hex color (e.g., "#2563EB") |
| timezone | VARCHAR(50) | NOT NULL | IANA timezone (e.g., "America/New_York") |
| currency | VARCHAR(3) | NOT NULL, DEFAULT 'USD' | ISO 4217 currency code |
| country | VARCHAR(2) | NOT NULL, DEFAULT 'US' | ISO 3166-1 alpha-2 |
| address | JSONB | | `{street, city, state, postal_code, country, lat, lng}` |
| contact_email | VARCHAR(255) | | |
| contact_phone | VARCHAR(20) | | |
| stripe_account_id | VARCHAR(255) | | Stripe Connect Express account ID (acct_xxx) |
| stripe_onboarded | BOOLEAN | DEFAULT false | True when Stripe Connect onboarding is complete |
| subscription_tier | VARCHAR(20) | DEFAULT 'STARTER' | STARTER, PRACTICE, ENTERPRISE |
| is_published | BOOLEAN | DEFAULT false | True when first service is created; gates booking page visibility |
| default_cancellation_policy | JSONB | | `{free_cancel_hours: 24, late_cancel_fee_percent: 50, no_refund_hours: 2}` |
| reminder_settings | JSONB | DEFAULT '{"email_24h": true, "email_1h": true, "sms_1h": false}' | Practice-level reminder defaults |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL | Prisma @updatedAt |

### `users`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| email | VARCHAR(255) | UNIQUE, NOT NULL | |
| password_hash | VARCHAR(255) | | Nullable for OAuth-only and guest checkout users |
| name | VARCHAR(255) | NOT NULL | |
| phone | VARCHAR(20) | | |
| avatar_url | VARCHAR(500) | | |
| role | UserRole | DEFAULT 'USER' | PLATFORM_ADMIN or USER only |
| email_verified | BOOLEAN | DEFAULT false | |
| google_id | VARCHAR(255) | UNIQUE | Nullable; set on Google OAuth link |
| date_of_birth | DATE | | Patient demographic (Synthea-generated) |
| gender | VARCHAR(20) | | Patient demographic |
| locale | VARCHAR(10) | DEFAULT 'en' | |
| timezone | VARCHAR(50) | | User's preferred timezone |
| notification_preferences | JSONB | DEFAULT '{"email": true, "sms": false, "push": false}' | Per-channel opt-in/out. SMS requires explicit consent (see `consent_records`). |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

> A user is a "patient" implicitly when they have appointments but no `tenant_memberships` row for that practice.
>
> **Guest checkout (FR-AUTH-8):** When a guest completes a booking, the system silently creates a passwordless user record from the email and name captured during the booking flow. `password_hash = NULL`, `email_verified = false`. If the guest later registers with the same email, the existing user record is claimed: password is set, email is verified, and all prior booking history is already linked via the appointments table.

### `refresh_tokens`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| user_id | UUID | FK→users, NOT NULL | |
| token_hash | VARCHAR(64) | NOT NULL, UNIQUE | SHA-256 hash of the refresh token (never store plaintext) |
| expires_at | TIMESTAMPTZ | NOT NULL | 7 days from issuance |
| revoked_at | TIMESTAMPTZ | | Set on logout or token rotation; NULL = active |
| replaced_by | UUID | FK→refresh_tokens | Points to the new token issued during rotation |
| ip_address | VARCHAR(45) | | IP at token issuance |
| user_agent | TEXT | | Browser/client at issuance |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Indexes:**
- `idx_refresh_tokens_user` on `(user_id)` — list active sessions
- `idx_refresh_tokens_hash` on `(token_hash)` — lookup on refresh

**Notes:** On each token refresh, the old token is revoked (`revoked_at` set, `replaced_by` points to new token) and a new token is issued (rotation). Reuse of a revoked token triggers revocation of the entire token family (all tokens descended from the same root) as a security measure against token theft.

### `tenant_memberships`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| practice_id | UUID | FK→practices, NOT NULL | RLS key |
| user_id | UUID | FK→users, NOT NULL | UNIQUE(practice_id, user_id) |
| role | MembershipRole | NOT NULL | OWNER, ADMIN, PROVIDER |
| is_active | BOOLEAN | DEFAULT true | Soft-delete; inactive members cannot access practice |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

**RLS:** Enabled. Policy filters by `practice_id = current_setting('app.current_practice')::UUID`.

### `invitation_tokens`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| practice_id | UUID | FK→practices, NOT NULL | RLS key |
| email | VARCHAR(255) | NOT NULL | Invitee email |
| role | MembershipRole | NOT NULL, DEFAULT 'PROVIDER' | Role to grant on acceptance |
| token_hash | VARCHAR(64) | NOT NULL, UNIQUE | SHA-256 hash of the invitation token |
| invited_by | UUID | FK→users, NOT NULL | OWNER/ADMIN who sent the invite |
| expires_at | TIMESTAMPTZ | NOT NULL | 7 days from creation |
| accepted_at | TIMESTAMPTZ | | Set when invite is accepted; NULL = pending |
| revoked_at | TIMESTAMPTZ | | Set if invite is manually revoked |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Indexes:**
- `idx_invitation_tokens_hash` on `(token_hash)` — lookup on acceptance
- `idx_invitation_tokens_practice_email` on `(practice_id, email)` — prevent duplicate pending invites

**Notes:** UNIQUE constraint on `(practice_id, email)` WHERE `accepted_at IS NULL AND revoked_at IS NULL` prevents duplicate pending invitations. Invitation flow: OWNER/ADMIN creates invite → email sent with tokenized link → invitee clicks link → if registered, creates `tenant_membership` + `provider_profile`; if not registered, redirects to registration with invite context preserved.

**RLS:** Enabled on `practice_id`.

### `provider_profiles`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| practice_id | UUID | FK→practices, NOT NULL | RLS key |
| user_id | UUID | FK→users, NOT NULL | UNIQUE(practice_id, user_id) |
| specialties | TEXT[] | NOT NULL, DEFAULT '{}' | Array of specialty strings (e.g., ["Family Medicine", "Pediatrics"]) |
| credentials | VARCHAR(100) | | E.g., "MD", "PhD, LCSW", "DDS" |
| bio | TEXT | | Rich text provider biography |
| years_of_experience | INTEGER | | |
| education | TEXT | | Education background |
| languages | TEXT[] | DEFAULT '{"English"}' | Languages spoken |
| accepting_new_patients | BOOLEAN | DEFAULT true | Shown on booking page |
| consultation_types | ConsultationType[] | DEFAULT '{VIDEO}' | What types this provider supports |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

**RLS:** Enabled on `practice_id`.

### `services`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| practice_id | UUID | FK→practices, NOT NULL | RLS key |
| name | VARCHAR(255) | NOT NULL | E.g., "Initial Consultation", "Follow-up Visit" |
| description | TEXT | | |
| duration_minutes | INTEGER | NOT NULL | Default slot duration |
| price | DECIMAL(10,2) | NOT NULL, DEFAULT 0.00 | Service price; 0 = free consultation |
| consultation_type | ConsultationType | NOT NULL, DEFAULT 'VIDEO' | |
| confirmation_mode | ConfirmationMode | DEFAULT 'AUTO_CONFIRM' | |
| intake_form_template_id | UUID | FK→intake_form_templates | Nullable; when set, patients prompted to complete form |
| max_participants | INTEGER | DEFAULT 2 | 2 = 1:1; >2 = group session (up to 6) |
| buffer_before_minutes | INTEGER | DEFAULT 0 | Buffer time before appointment |
| buffer_after_minutes | INTEGER | DEFAULT 0 | Buffer time after appointment |
| category | VARCHAR(100) | | Service grouping on booking page (e.g., "Initial Visits", "Follow-ups") |
| is_active | BOOLEAN | DEFAULT true | Inactive services hidden from booking page |
| sort_order | INTEGER | DEFAULT 0 | Display order on booking page |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

**RLS:** Enabled on `practice_id`.

### `service_providers`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| service_id | UUID | FK→services, NOT NULL | |
| provider_profile_id | UUID | FK→provider_profiles, NOT NULL | UNIQUE(service_id, provider_profile_id) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

Join table: many-to-many between services and providers.

**RLS:** No direct `practice_id` column. Access controlled via JOINs — `service_id` FK → `services.practice_id` and `provider_profile_id` FK → `provider_profiles.practice_id`. RLS policy uses: `EXISTS (SELECT 1 FROM services s WHERE s.id = service_id AND s.practice_id = current_setting('app.current_practice')::UUID)`.

---

## 5. Scheduling Tables

### `availability_rules`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| practice_id | UUID | FK→practices, NOT NULL | RLS key |
| provider_profile_id | UUID | FK→provider_profiles, NOT NULL | |
| day_of_week | INTEGER | NOT NULL, CHECK(0-6) | 0=Sunday, 6=Saturday |
| start_time | TIME | NOT NULL | E.g., '09:00' |
| end_time | TIME | NOT NULL | E.g., '17:00'; must be > start_time |
| slot_duration_minutes | INTEGER | NOT NULL | Overrides service duration for availability calculation |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

Multiple rules per provider per day are allowed (e.g., 9:00-12:00 and 13:00-17:00 for a lunch break).

**RLS:** Enabled on `practice_id`.

### `blocked_dates`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| practice_id | UUID | FK→practices, NOT NULL | RLS key |
| provider_profile_id | UUID | FK→provider_profiles, NOT NULL | |
| start_date | DATE | NOT NULL | |
| end_date | DATE | NOT NULL | >= start_date; same date = single day block |
| reason | VARCHAR(255) | | Optional: "Vacation", "Conference", etc. |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**RLS:** Enabled on `practice_id`.

---

## 6. Appointment Tables

### `appointments`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| practice_id | UUID | FK→practices, NOT NULL | RLS key |
| provider_profile_id | UUID | FK→provider_profiles, NOT NULL | |
| patient_id | UUID | FK→users, NOT NULL | The patient user |
| service_id | UUID | FK→services, NOT NULL | |
| start_time | TIMESTAMPTZ | NOT NULL | Appointment start (UTC) |
| end_time | TIMESTAMPTZ | NOT NULL | Appointment end (UTC) |
| status | AppointmentStatus | NOT NULL, DEFAULT 'PENDING' | |
| consultation_type | ConsultationType | NOT NULL | Resolved at booking: VIDEO, IN_PERSON, or PHONE |
| notes | TEXT | | Provider notes (private to practice staff) |
| cancellation_reason | TEXT | | Set when status → CANCELLED |
| cancelled_by | UUID | FK→users | Who cancelled (patient or provider/admin) |
| cancelled_at | TIMESTAMPTZ | | When cancellation occurred |
| checked_in_at | TIMESTAMPTZ | | Set when patient checks in or video starts |
| completed_at | TIMESTAMPTZ | | Set when appointment completes |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

**Indexes:**
- `UNIQUE(provider_profile_id, start_time)` WHERE `status NOT IN ('CANCELLED')` — partial unique index prevents double-booking. Group sessions (service `max_participants > 2`) bypass this constraint via application-level validation: the booking transaction counts existing non-cancelled appointments for the slot and rejects if `count >= max_participants` (see SRS-3 §3.3 step 4b).
- `idx_appointments_patient` on `(patient_id, start_time)`
- `idx_appointments_practice_date` on `(practice_id, start_time)`
- `idx_appointments_status` on `(practice_id, status)`

**RLS:** Enabled on `practice_id`. Patient portal uses a separate policy: `USING (patient_id = current_setting('app.current_user')::UUID)`.

### `slot_reservations`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| practice_id | UUID | FK→practices, NOT NULL | |
| provider_profile_id | UUID | FK→provider_profiles, NOT NULL | |
| start_time | TIMESTAMPTZ | NOT NULL | |
| end_time | TIMESTAMPTZ | NOT NULL | |
| session_id | VARCHAR(255) | NOT NULL | Booking session identifier |
| expires_at | TIMESTAMPTZ | NOT NULL | Default: NOW() + 10 minutes |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

Temporary slot holds during the booking flow. Cleaned up by a BullMQ job that removes expired reservations every minute.

**Index:** `UNIQUE(provider_profile_id, start_time)` — enforces single reservation per slot.

**RLS:** Enabled on `practice_id`.

---

## 7. Video Tables

### `video_rooms`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| practice_id | UUID | FK→practices, NOT NULL | RLS key |
| appointment_id | UUID | FK→appointments, NOT NULL, UNIQUE | One room per appointment |
| twilio_room_sid | VARCHAR(255) | NOT NULL | Twilio room SID (RM_xxx) |
| twilio_room_name | VARCHAR(255) | NOT NULL | Set to appointment ID for lookup |
| status | VideoRoomStatus | NOT NULL, DEFAULT 'CREATED' | |
| max_participants | INTEGER | NOT NULL, DEFAULT 2 | Matches service.max_participants |
| started_at | TIMESTAMPTZ | | When first participant connected |
| ended_at | TIMESTAMPTZ | | When room completed/closed |
| actual_duration_seconds | INTEGER | | Calculated: ended_at - started_at |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

**RLS:** Enabled on `practice_id`.

### `video_participants`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| video_room_id | UUID | FK→video_rooms, NOT NULL | |
| user_id | UUID | FK→users, NOT NULL | |
| twilio_participant_sid | VARCHAR(255) | | Set when participant connects |
| joined_at | TIMESTAMPTZ | | |
| left_at | TIMESTAMPTZ | | |
| duration_seconds | INTEGER | | Calculated per participant |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

Tracks individual participant join/leave for group sessions and duration analytics.

**RLS:** No direct `practice_id` column. Access controlled via JOIN path: `video_room_id` FK → `video_rooms.appointment_id` FK → `appointments.practice_id`. RLS policy uses: `EXISTS (SELECT 1 FROM video_rooms vr JOIN appointments a ON a.id = vr.appointment_id WHERE vr.id = video_room_id AND a.practice_id = current_setting('app.current_practice')::UUID)`.

---

## 8. Intake Form Tables

### `intake_form_templates`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| practice_id | UUID | FK→practices, NOT NULL | RLS key |
| name | VARCHAR(255) | NOT NULL | E.g., "General Health Questionnaire" |
| description | TEXT | | |
| fields | JSONB | NOT NULL | Array of field definitions (see schema below) |
| is_system | BOOLEAN | DEFAULT false | True for predefined templates; cannot be deleted |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

**Fields JSONB Schema:**
```json
[
  {
    "id": "field_uuid",
    "type": "TEXT | TEXTAREA | SELECT | MULTI_SELECT | CHECKBOX | DATE | NUMBER | PHONE | EMAIL",
    "label": "What medications are you currently taking?",
    "required": true,
    "placeholder": "List all current medications...",
    "options": ["Option A", "Option B"],  // only for SELECT, MULTI_SELECT
    "validation": {
      "min": 0,
      "max": 500,
      "pattern": "regex"
    }
  }
]
```

**RLS:** Enabled on `practice_id`.

### `intake_submissions`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| practice_id | UUID | FK→practices, NOT NULL | RLS key |
| appointment_id | UUID | FK→appointments, NOT NULL, UNIQUE | One submission per appointment |
| template_id | UUID | FK→intake_form_templates, NOT NULL | Template used |
| form_data | JSONB | NOT NULL | `{field_id: value}` pairs |
| status | IntakeStatus | NOT NULL, DEFAULT 'PENDING' | |
| completed_at | TIMESTAMPTZ | | When patient submitted |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

**RLS:** Enabled on `practice_id`.

---

## 9. Messaging Tables

### `messages`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| practice_id | UUID | FK→practices, NOT NULL | RLS key |
| appointment_id | UUID | FK→appointments, NOT NULL | Thread is scoped to appointment |
| sender_id | UUID | FK→users, NULLABLE | NULL for SYSTEM messages; populated for TEXT messages |
| type | MessageType | NOT NULL, DEFAULT 'TEXT' | TEXT or SYSTEM |
| content | TEXT | NOT NULL | Markdown-supported for TEXT; structured for SYSTEM |
| read_at | TIMESTAMPTZ | | When recipient viewed the message |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Indexes:**
- `idx_messages_appointment` on `(appointment_id, created_at)`
- `idx_messages_unread` on `(appointment_id, read_at)` WHERE `read_at IS NULL`

**RLS:** Enabled on `practice_id`. Patient portal policy: `USING (appointment_id IN (SELECT id FROM appointments WHERE patient_id = current_setting('app.current_user')::UUID))`.

---

## 10. Payment Tables

### `payment_records`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| practice_id | UUID | FK→practices, NOT NULL | RLS key |
| appointment_id | UUID | FK→appointments, NOT NULL | |
| amount | DECIMAL(10,2) | NOT NULL | Payment amount (major units / dollars) |
| currency | VARCHAR(3) | NOT NULL, DEFAULT 'USD' | |
| status | PaymentStatus | NOT NULL, DEFAULT 'PENDING' | |
| stripe_payment_intent_id | VARCHAR(255) | | Stripe PI ID (pi_xxx) |
| stripe_charge_id | VARCHAR(255) | | Stripe charge ID |
| platform_fee | DECIMAL(10,2) | | 1% platform fee amount |
| refund_amount | DECIMAL(10,2) | | Amount refunded (if applicable) |
| refunded_at | TIMESTAMPTZ | | |
| metadata | JSONB | | Additional payment context |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

**RLS:** Enabled on `practice_id`.

---

## 11. Calendar Tables

### `calendar_connections`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| practice_id | UUID | FK→practices, NOT NULL | RLS key |
| provider_profile_id | UUID | FK→provider_profiles, NOT NULL | |
| provider | CalendarProvider | NOT NULL | GOOGLE or OUTLOOK |
| access_token | TEXT | NOT NULL | Encrypted at rest |
| refresh_token | TEXT | NOT NULL | Encrypted at rest |
| token_expires_at | TIMESTAMPTZ | NOT NULL | |
| calendar_id | VARCHAR(255) | NOT NULL | External calendar ID (primary calendar by default) |
| status | CalendarConnectionStatus | DEFAULT 'ACTIVE' | |
| last_synced_at | TIMESTAMPTZ | | Last successful inbound sync |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

**RLS:** Enabled on `practice_id`.

### `calendar_events`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| practice_id | UUID | FK→practices, NOT NULL | RLS key |
| calendar_connection_id | UUID | FK→calendar_connections, NOT NULL | |
| appointment_id | UUID | FK→appointments | Nullable; NULL for INBOUND events (external) |
| external_event_id | VARCHAR(255) | NOT NULL | Google/Outlook event ID |
| direction | CalendarEventDirection | NOT NULL | OUTBOUND or INBOUND |
| title | VARCHAR(255) | | |
| start_time | TIMESTAMPTZ | NOT NULL | |
| end_time | TIMESTAMPTZ | NOT NULL | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

**Indexes:**
- `idx_calendar_events_connection` on `(calendar_connection_id, direction)` — filter by connection and sync direction
- `UNIQUE(calendar_connection_id, external_event_id)` — prevents duplicate sync of the same external event

INBOUND events (direction = INBOUND, appointment_id = NULL) block provider availability in the slot calculation engine. See SRS-3 §4.

**RLS:** Enabled on `practice_id`.

---

## 12. Notification Tables

### `notifications`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| user_id | UUID | FK→users, NOT NULL | Recipient |
| practice_id | UUID | FK→practices | Nullable; NULL for platform-level notifications |
| type | NotificationType | NOT NULL | |
| title | VARCHAR(255) | NOT NULL | |
| body | TEXT | | |
| data | JSONB | | Type-specific payload (appointment_id, message_id, etc.) |
| read_at | TIMESTAMPTZ | | NULL = unread |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Indexes:**
- `idx_notifications_user_unread` on `(user_id, created_at)` WHERE `read_at IS NULL`

**RLS:** Not practice-scoped for RLS purposes. Access controlled by `user_id`-based policy: `USING (user_id = current_setting('app.current_user')::UUID)`. Users can only read/update their own notifications.

### `appointment_reminders`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| practice_id | UUID | FK→practices, NOT NULL | RLS key |
| appointment_id | UUID | FK→appointments, NOT NULL | |
| type | VARCHAR(20) | NOT NULL | 'EMAIL_24H', 'EMAIL_1H', 'SMS_1H' |
| scheduled_for | TIMESTAMPTZ | NOT NULL | When the reminder should be sent |
| sent_at | TIMESTAMPTZ | | When actually sent; NULL = pending |
| failed_at | TIMESTAMPTZ | | If delivery failed |
| retry_count | INTEGER | DEFAULT 0 | Max 3 retries |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**RLS:** Enabled on `practice_id`.

---

## 13. Audit & Consent Tables

### `audit_logs`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| user_id | UUID | FK→users | Actor; NULL for system actions |
| practice_id | UUID | FK→practices | NULL for platform actions |
| action | VARCHAR(50) | NOT NULL | E.g., 'APPOINTMENT_CREATED', 'INTAKE_VIEWED', 'PAYMENT_REFUNDED' |
| resource_type | VARCHAR(50) | NOT NULL | E.g., 'appointment', 'intake_submission', 'payment_record' |
| resource_id | UUID | NOT NULL | ID of the affected resource |
| metadata | JSONB | | Additional context (old values, IP address, user agent) |
| ip_address | VARCHAR(45) | | IPv4 or IPv6 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Immutable; no updated_at |

Audit logs are append-only. No UPDATE or DELETE operations. Index on `(resource_type, resource_id)` and `(user_id, created_at)`.

**RLS:** Enabled on `practice_id` for practice-scoped logs. Platform-level logs (`practice_id = NULL`) are accessible only to PLATFORM_ADMIN.

### `consent_records`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| user_id | UUID | FK→users, NOT NULL | |
| type | VARCHAR(50) | NOT NULL | 'TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'DATA_PROCESSING', 'SMS_OPT_IN', 'VIDEO_RECORDING' |
| version | VARCHAR(20) | NOT NULL | Version of the document consented to |
| consented_at | TIMESTAMPTZ | NOT NULL | |
| ip_address | VARCHAR(45) | | |
| user_agent | TEXT | | |
| revoked_at | TIMESTAMPTZ | | NULL = consent active |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Indexes:**
- `UNIQUE(user_id, type) WHERE revoked_at IS NULL` — Partial unique index ensuring at most one active (non-revoked) consent per type per user. Revoking an old consent (setting `revoked_at`) allows a new consent of the same type to be inserted.

---

## 14. API Endpoint Summary

### Authentication

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /api/auth/register | Register new user | Public |
| POST | /api/auth/login | Login, returns JWT | Public |
| POST | /api/auth/refresh | Refresh access token | Refresh token |
| POST | /api/auth/forgot-password | Request password reset | Public |
| POST | /api/auth/reset-password | Reset password with token | Public |
| POST | /api/auth/verify-email | Verify email address | Public (token in URL) |
| POST | /api/auth/logout | Revoke refresh token, clear cookie | Authenticated |
| GET | /api/auth/google | Initiate Google OAuth | Public |
| GET | /api/auth/google/callback | Google OAuth callback | Public |

### Practices

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /api/practices | Create practice (onboarding) | Authenticated |
| GET | /api/practices/:id | Get practice details | Member |
| PATCH | /api/practices/:id | Update practice settings | OWNER/ADMIN |
| GET | /api/practices/:slug/public | Public booking page data | Public |
| POST | /api/practices/:id/stripe/connect | Initiate Stripe Connect | OWNER |
| GET | /api/practices/:id/stripe/status | Check Stripe Connect status | OWNER/ADMIN |

### Providers

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /api/practices/:id/providers | List practice providers | Public (booking page) |
| POST | /api/practices/:id/providers | Add provider | OWNER/ADMIN |
| GET | /api/providers/:id | Get provider profile | Public |
| PATCH | /api/providers/:id | Update provider profile | OWNER/ADMIN/self |
| DELETE | /api/providers/:id | Deactivate provider | OWNER/ADMIN |
| POST | /api/practices/:id/invitations | Send provider invitation | OWNER/ADMIN |
| GET | /api/practices/:id/invitations | List pending invitations | OWNER/ADMIN |
| DELETE | /api/invitations/:id | Revoke invitation | OWNER/ADMIN |
| POST | /api/invitations/accept | Accept invitation (with token) | Public (token-authenticated) |
| GET | /api/providers/:id/availability | Get available slots | Public |

### Services

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /api/practices/:id/services | List services | Public |
| POST | /api/practices/:id/services | Create service | OWNER/ADMIN |
| PATCH | /api/services/:id | Update service | OWNER/ADMIN |
| DELETE | /api/services/:id | Deactivate service | OWNER/ADMIN |

### Appointments

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /api/appointments/reserve | Reserve a time slot (10 min TTL) | Authenticated/Guest |
| POST | /api/appointments/:id/confirm | Confirm pending appointment (MANUAL_APPROVAL mode) | OWNER/ADMIN |
| POST | /api/appointments | Book appointment | Authenticated/Guest |
| GET | /api/appointments/:id | Get appointment details | Participant |
| PATCH | /api/appointments/:id | Update appointment (notes, status) | Provider/Admin |
| POST | /api/appointments/:id/cancel | Cancel appointment | Participant |
| POST | /api/appointments/:id/reschedule | Reschedule appointment | Participant |
| GET | /api/practices/:id/appointments | List practice appointments | Member |
| GET | /api/me/appointments | List patient's appointments | Authenticated |

### Video

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /api/appointments/:id/video/token | Generate Twilio access token | Participant |
| GET | /api/appointments/:id/video/status | Get video room status | Participant |
| POST | /api/appointments/:id/video/end | End video session | Provider |

### Intake Forms

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /api/practices/:id/intake-templates | List templates | OWNER/ADMIN |
| POST | /api/practices/:id/intake-templates | Create template | OWNER/ADMIN |
| PATCH | /api/intake-templates/:id | Update template | OWNER/ADMIN |
| GET | /api/appointments/:id/intake | Get intake submission | Participant |
| POST | /api/appointments/:id/intake | Submit intake form | Patient |

### Messages

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /api/appointments/:id/messages | List messages in thread | Participant |
| POST | /api/appointments/:id/messages | Send message | Participant |
| PATCH | /api/messages/:id/read | Mark message as read | Recipient |

### Calendar

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /api/providers/:id/calendar/connect | Initiate OAuth for calendar | Provider/Admin |
| DELETE | /api/providers/:id/calendar/:connectionId | Disconnect calendar | Provider/Admin |
| GET | /api/providers/:id/calendar/status | Check sync status | Provider/Admin |

### Notifications

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /api/me/notifications | List notifications | Authenticated |
| PATCH | /api/notifications/:id/read | Mark as read | Owner |
| POST | /api/me/notifications/read-all | Mark all as read | Authenticated |

### User Profile

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /api/me | Get current user profile | Authenticated |
| PATCH | /api/me | Update profile (name, phone, avatar, timezone, notification_preferences) | Authenticated |
| GET | /api/me/payments | List patient's payment history across all practices | Authenticated |

### Admin

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /api/practices/:id/analytics | Appointment analytics | OWNER/ADMIN |
| GET | /api/practices/:id/patients | Patient list | OWNER/ADMIN/PROVIDER |
| GET | /api/practices/:id/payments | Payment history | OWNER/ADMIN |

### Uploads

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /api/uploads/presign | Generate presigned R2 upload URL | Authenticated (OWNER/ADMIN for practice assets) |

### Webhooks

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /api/webhooks/stripe | Stripe webhook handler | Stripe signature |
| POST | /api/webhooks/twilio | Twilio status callback | Twilio signature |

---

## Cross-References

- **SRS-1 (Architecture):** RLS implementation (§7), WebSocket architecture (§12), deployment topology.
- **SRS-3 (Booking, Video & Payments):** Appointment state machine, availability engine, Twilio Video lifecycle, Stripe Connect payment flow.
- **SRS-4 (Communications & Security):** Notification delivery, email templates, auth/authz implementation, calendar sync protocol.
