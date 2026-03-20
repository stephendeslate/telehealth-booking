# MedConnect — Software Requirements Specification: Booking, Video & Payments

**Author:** SJD Labs, LLC
**Document:** SRS Part 3 of 4

---

## 1. Scope

This document specifies the appointment booking lifecycle, availability resolution engine, video consultation integration (Twilio Video), payment processing (Stripe Connect), and background job definitions for the MedConnect telehealth platform. For system architecture and infrastructure, see **SRS-1**. For entity schemas and data models, see **SRS-2**. For communications, security, and messaging, see **SRS-4**.

---

## 2. Appointment State Machine

```
+----------+  confirm   +-----------+  check_in   +-------------+  complete  +-----------+
| PENDING  |----------->| CONFIRMED |------------>| IN_PROGRESS |---------->| COMPLETED |
+----+-----+            +-----+-----+             +------+------+           +-----------+
     |                        |   |                      |                       ^
     | cancel                 |   | auto_complete        | cancel (admin only)   |
     v                        |   | (IN_PERSON/PHONE     v                       |
+-----------+                 |   |  end_time passed)    +-----------+           |
| CANCELLED |                 |   +---------------------------------------------+
+-----------+                 |                          +-----------+
     ^                        |                          | CANCELLED |
     | timeout                | no_show (VIDEO only,     +-----------+
     | (10 min, no payment)   |  end_time + 15 min)
(from PENDING)                v
                        +-----------+
                        |  NO_SHOW  |
                        +-----------+
```

### 2.1 Transition Rules

| From | To | Trigger | Guard / Side Effect |
|------|----|---------|---------------------|
| PENDING | CONFIRMED | `confirm` | Behavior depends on `services.confirmation_mode` (see §2.2) |
| PENDING | CANCELLED | `cancel` | Records `cancellation_reason`; releases slot reservation |
| PENDING | CANCELLED | `timeout` | No payment within 10 min (slot reservation expired) |
| CONFIRMED | IN_PROGRESS | `check_in` | Video room joined OR manual check-in; sets `checked_in_at` |
| CONFIRMED | COMPLETED | `auto_complete` | `processCompletedAppointments` job: fires when `end_time` has passed for IN_PERSON/PHONE types only (patient may have attended without video activity). VIDEO appointments are NOT auto-completed — they go to NO_SHOW if no video activity occurs. |
| CONFIRMED | CANCELLED | `cancel` | Cancellation policy evaluated (§7); refund amount determined; calendar event deleted |
| CONFIRMED | NO_SHOW | `no_show` | `detectNoShows` job: fires `end_time + 15 min` if no check-in and no video room activity. Applies to VIDEO appointments. For IN_PERSON/PHONE, no-show is a manual action by the provider. |
| IN_PROGRESS | COMPLETED | `complete` | Video room ended OR provider marks complete; sets `completed_at` |
| IN_PROGRESS | CANCELLED | `cancel` | Admin-only; partial refund or no refund based on policy |

Invalid transitions raise `InvalidAppointmentTransitionError` (HTTP 422). Every transition is audit-logged (see SRS-4 §6).

### 2.2 Confirmation Mode Behavior

The `services.confirmation_mode` field controls how appointments transition from PENDING to CONFIRMED:

| Mode | Trigger | Behavior |
|------|---------|----------|
| `AUTO_CONFIRM` | Payment SUCCEEDED (or booking created for free service / practice without Stripe connected) | System automatically fires `confirm` transition. Patient sees immediate confirmation. |
| `MANUAL_APPROVAL` | Staff action via `POST /api/appointments/:id/confirm` | Appointment remains PENDING until OWNER/ADMIN explicitly confirms. Patient sees "Pending Approval" status. |

**MANUAL_APPROVAL side effects:**
- Payment is still collected at booking time (if service has a price). If staff rejects (cancels) the appointment, a full refund is issued automatically.
- A notification is sent to the practice's OWNER/ADMIN roles when a new appointment requires approval.
- The `timeout` transition still applies: if staff does not confirm or cancel within 48 hours, the appointment is auto-cancelled with `cancellation_reason = 'APPROVAL_TIMEOUT'` and a full refund is issued.

### 2.3 Video-Triggered Status Transitions

For VIDEO and BOTH (resolved to VIDEO) consultation types, the appointment state machine integrates with Twilio Video room events:

| Video Event | Appointment Effect |
|-------------|-------------------|
| Provider joins room | If CONFIRMED → transition to IN_PROGRESS; set `checked_in_at` |
| Both parties disconnect | If IN_PROGRESS → transition to COMPLETED; set `completed_at` |
| Room auto-closes (hard limit) | If IN_PROGRESS → transition to COMPLETED; set `completed_at` |
| No participants join by `end_time + 15 min` | `detectNoShows` job marks as NO_SHOW |

For IN_PERSON and PHONE consultation types, status transitions are manual (provider or admin action via the dashboard).

---

## 3. Booking Flow

### 3.1 Patient Booking Flow

```
Patient arrives at booking page (/{slug})
        |
        v
+-------------------+
| 1. Browse         |  GET /api/practices/:slug/public
|    Providers       |  GET /api/practices/:id/providers
+--------+----------+
         |
         v
+-------------------+
| 2. Select Service |  GET /api/practices/:id/services
+--------+----------+
         |
         v
+-------------------+
| 3. Select Date &  |  GET /api/providers/:id/availability?date=YYYY-MM-DD
|    Time Slot      |  POST /api/appointments/reserve (slot hold)
+--------+----------+
         |
         v
+-------------------+
| 4. Patient Info   |  Collect name, email, phone (if guest checkout)
|    (if guest)     |  OR authenticate (if registered user)
+--------+----------+
         |
         v
+-------------------+
| 5. Intake Form    |  GET /api/intake-templates/:id (if service has intake)
|    (if configured) |  Fill inline OR defer to post-booking
+--------+----------+
         |
         v
+-------------------+
| 6. Consent        |  Display: data processing consent checkbox (required)
|                   |  "I agree to the processing of my data for appointment booking."
|                   |  Consent recorded in consent_records table on submission.
+--------+----------+
         |
         v
+-------------------+
| 7. Review & Pay   |  Display: provider, service, date/time, price
|    (if price > 0  |  POST /api/appointments (creates appointment + payment intent)
|     & Stripe on)  |  Stripe Elements card input
+--------+----------+
         |
    +----+----+
    |         |
 Success    Abandoned
    |       (10 min TTL
    v        expires)
+----------+  +----------+
| CONFIRMED|  | Slot     |
| Email    |  | released |
| sent     |  +----------+
+----------+
```

### 3.2 Booking Request Payload

```typescript
// POST /api/appointments
interface CreateAppointmentDto {
  practice_id: string;           // UUID
  provider_profile_id: string;   // UUID
  service_id: string;            // UUID
  start_time: string;            // ISO 8601 UTC
  consultation_type?: 'VIDEO' | 'IN_PERSON' | 'PHONE';  // Required when service type is BOTH
  reservation_session_id: string; // From slot reservation step
  // Patient info (guest checkout only)
  patient_name?: string;
  patient_email?: string;
  patient_phone?: string;
  // Payment
  stripe_payment_method_id?: string;  // From Stripe Elements (when price > 0)
  // Consent
  data_processing_consent: boolean;   // Required: true. Patient acknowledges data processing for appointment booking.
}
```

### 3.3 Booking Processing (Server-Side)

```
createAppointment(dto):
  // 0. Validate consent
  if !dto.data_processing_consent:
    throw ValidationError('Data processing consent is required')

  // 1. Validate reservation
  reservation = findReservation(dto.reservation_session_id)
  if !reservation OR reservation.expired:
    throw SlotNoLongerAvailableError

  // 2. Resolve patient
  if dto.patient_email (guest checkout):
    patient = findOrCreateGuestUser(dto.patient_email, dto.patient_name, dto.patient_phone)
  else:
    patient = currentUser (from JWT)

  // 3. Resolve consultation type
  if service.consultation_type == 'BOTH':
    consultation_type = dto.consultation_type  // Patient chose
  else:
    consultation_type = service.consultation_type

  // 4. Begin transaction
  BEGIN TRANSACTION:
    // 4a. Lock reservation row (pessimistic)
    SELECT * FROM slot_reservations WHERE id = reservation.id FOR UPDATE

    // 4b. Verify no conflicting confirmed appointment
    conflicting = SELECT * FROM appointments
      WHERE provider_profile_id = dto.provider_profile_id
        AND start_time = dto.start_time
        AND status NOT IN ('CANCELLED')
    if conflicting AND service.max_participants <= countConfirmed(conflicting):
      ROLLBACK
      throw SlotNoLongerAvailableError

    // 4c. Create appointment (PENDING)
    appointment = INSERT INTO appointments (...)
      VALUES (..., status = 'PENDING')

    // 4d. Delete reservation
    DELETE FROM slot_reservations WHERE id = reservation.id

    // 4e. Process payment (if applicable)
    if service.price > 0 AND practice.stripe_onboarded:
      paymentResult = processPayment(appointment, dto.stripe_payment_method_id)
      if paymentResult.status == 'SUCCEEDED':
        if service.confirmation_mode == 'AUTO_CONFIRM':
          appointment.status = 'CONFIRMED'
      else:
        ROLLBACK
        throw PaymentFailedError

    else:  // Free service or no Stripe connected
      if service.confirmation_mode == 'AUTO_CONFIRM':
        appointment.status = 'CONFIRMED'

    // 4f. Record data processing consent
    INSERT INTO consent_records (
      user_id = patient.id, type = 'DATA_PROCESSING',
      version = '1.0', consented_at = now(),
      ip_address = request.ip, user_agent = request.headers['user-agent']
    ) ON CONFLICT (user_id, type) WHERE revoked_at IS NULL DO NOTHING
    // Skip if patient already consented (idempotent)

  COMMIT

  // 5. Post-commit side effects (async via event emitter)
  emit('appointment.created', appointment)
  if appointment.status == 'CONFIRMED':
    emit('appointment.confirmed', appointment)
    // → Triggers: confirmation email, calendar event push, video room creation,
    //   intake form email, reminder scheduling
```

### 3.4 Guest Checkout User Resolution

```
findOrCreateGuestUser(email, name, phone):
  existing = SELECT * FROM users WHERE email = lower(email)

  if existing:
    return existing  // Appointment linked to existing account

  // Create passwordless user record (FR-AUTH-8)
  return INSERT INTO users (
    email = lower(email),
    name = name,
    phone = phone,
    password_hash = NULL,      // No password — guest
    email_verified = false,
    role = 'USER'
  )
```

When a guest later registers with the same email, the existing user record is claimed: password is set, email is verified, and all prior booking history is already linked via the `patient_id` FK on appointments.

---

## 4. Availability Resolution Engine

The engine calculates available time slots for a given provider + date by layering rules in priority order. Each layer can only **remove** slots from the pool — no layer adds availability that a higher-priority layer has blocked.

### 4.1 Resolution Layers

| Priority | Layer | Effect | Required? |
|----------|-------|--------|-----------|
| 1 | `availability_rules` (recurring) | Defines open windows per day-of-week for the provider | Yes — preset creates defaults during onboarding |
| 2 | `buffer_before_minutes / buffer_after_minutes` on service | Subtracts buffer time from each open slot boundary | Only when service has non-zero buffer values |
| 3 | `blocked_dates` | Removes entire days (vacations, holidays, personal) | Only when blocked_dates rows exist for the date range |
| 4 | `calendar_events` (INBOUND, `appointment_id = NULL`) | External calendar events block overlapping slots | Only when provider has a connected calendar with inbound sync |
| 5 | Existing appointments | CONFIRMED, IN_PROGRESS, and PENDING (with active reservation) appointments block their time range + buffers | Always (core booking integrity, BR-3) |
| 6 | Advance window | Rejects dates in the past or more than 90 days ahead | Always (default: 0 to 90 days) |

### 4.2 Resolution Algorithm

```
getAvailableSlots(provider_id, service_id, date):
  provider = getProvider(provider_id)
  service = getService(service_id)
  practice = getPractice(provider.practice_id)
  tz = practice.timezone

  // Layer 1: Get availability rules for this day of week
  day_of_week = date.dayOfWeek(tz)  // 0=Sunday, 6=Saturday
  rules = SELECT * FROM availability_rules
    WHERE provider_profile_id = provider_id
      AND day_of_week = day_of_week
      AND is_active = true
  if rules.length == 0:
    return []  // Provider not available this day

  // Layer 3: Check blocked dates
  blocked = SELECT * FROM blocked_dates
    WHERE provider_profile_id = provider_id
      AND start_date <= date AND end_date >= date
  if blocked.length > 0:
    return []  // Entire day blocked

  // Layer 6: Advance window check
  today = now().toDate(tz)
  if date < today OR date > today + 90 days:
    return []

  // Generate candidate slots from rules
  slots = []
  for rule in rules:
    cursor = rule.start_time
    slot_duration = service.duration_minutes
    while cursor + slot_duration <= rule.end_time:
      slots.push({
        start: toUTC(date, cursor, tz),
        end: toUTC(date, cursor + slot_duration, tz)
      })
      cursor += slot_duration  // or rule.slot_duration_minutes

  // Layer 2: Apply buffer times
  buffer_before = service.buffer_before_minutes || 0
  buffer_after = service.buffer_after_minutes || 0

  // Layer 4: Fetch INBOUND calendar events for the date
  calendar_blocks = SELECT start_time, end_time FROM calendar_events
    WHERE calendar_connection_id IN (
      SELECT id FROM calendar_connections
      WHERE provider_profile_id = provider_id AND status = 'ACTIVE'
    )
    AND direction = 'INBOUND'
    AND start_time < date_end_utc AND end_time > date_start_utc

  // Layer 5: Fetch existing appointments
  existing = SELECT start_time, end_time, status FROM appointments
    WHERE provider_profile_id = provider_id
      AND start_time < date_end_utc AND end_time > date_start_utc
      AND status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')

  // Also check active slot reservations
  reservations = SELECT start_time, end_time FROM slot_reservations
    WHERE provider_profile_id = provider_id
      AND start_time < date_end_utc AND end_time > date_start_utc
      AND expires_at > now()

  // Build blocked ranges (with buffers applied)
  blocked_ranges = []
  for appt in existing:
    blocked_ranges.push({
      start: appt.start_time - buffer_before,
      end: appt.end_time + buffer_after
    })
  for res in reservations:
    blocked_ranges.push({
      start: res.start_time - buffer_before,
      end: res.end_time + buffer_after
    })
  for event in calendar_blocks:
    blocked_ranges.push({ start: event.start_time, end: event.end_time })

  // Filter: remove slots that overlap any blocked range
  available = slots.filter(slot =>
    !blocked_ranges.any(block => overlaps(slot, block))
  )

  // Group session handling: for services with max_participants > 2,
  // a slot is available if confirmed_count < max_participants
  if service.max_participants > 2:
    available = slots.filter(slot => {
      confirmed = existing.filter(a =>
        a.service_id == service_id
        AND a.start_time == slot.start
        AND a.status IN ('CONFIRMED', 'IN_PROGRESS')
      ).count()
      return confirmed < service.max_participants
    })

  return available
```

All times are computed in the practice's configured timezone and returned as UTC ISO 8601 strings. The API returns only available slots — blocked reasons are never exposed to patients.

### 4.3 API Response Format

```typescript
// GET /api/providers/:id/availability?date=2026-03-25&service_id=xxx
{
  "provider_id": "uuid",
  "date": "2026-03-25",
  "timezone": "America/New_York",
  "slots": [
    { "start": "2026-03-25T13:00:00Z", "end": "2026-03-25T13:30:00Z" },
    { "start": "2026-03-25T13:30:00Z", "end": "2026-03-25T14:00:00Z" },
    { "start": "2026-03-25T14:00:00Z", "end": "2026-03-25T14:30:00Z" }
  ]
}
```

---

## 5. Slot Reservation & Concurrency Control

### 5.1 Slot Reservation (Hold)

When a patient selects a time slot in the booking flow, a temporary reservation prevents double-booking during the remaining steps (intake form, payment).

```typescript
// POST /api/appointments/reserve
interface ReserveSlotDto {
  practice_id: string;
  provider_profile_id: string;
  service_id: string;
  start_time: string;  // ISO 8601 UTC
}

// Response
{
  "reservation_id": "uuid",
  "session_id": "session_xxx",  // Used in createAppointment
  "start_time": "2026-03-25T13:00:00Z",
  "end_time": "2026-03-25T13:30:00Z",
  "expires_at": "2026-03-25T12:10:00Z"  // 10 minutes from now
}
```

### 5.2 Reservation Implementation

```
reserveSlot(dto):
  BEGIN TRANSACTION:
    // Pessimistic lock: check for conflicting reservations or appointments
    conflicting_appt = SELECT * FROM appointments
      WHERE provider_profile_id = dto.provider_profile_id
        AND start_time = dto.start_time
        AND status NOT IN ('CANCELLED')
      FOR UPDATE

    conflicting_res = SELECT * FROM slot_reservations
      WHERE provider_profile_id = dto.provider_profile_id
        AND start_time = dto.start_time
        AND expires_at > now()
      FOR UPDATE

    if conflicting_appt.count > 0 AND service.max_participants <= conflicting_appt.count:
      throw SlotNotAvailableError
    if conflicting_res.count > 0:
      throw SlotTemporarilyHeldError

    reservation = INSERT INTO slot_reservations (
      practice_id, provider_profile_id,
      start_time, end_time,
      session_id = generateSessionId(),
      expires_at = now() + INTERVAL '10 minutes'
    )

  COMMIT
  return reservation
```

### 5.3 Reservation Cleanup

The `cleanExpiredReservations` BullMQ job runs every minute (see §9.1) and deletes all `slot_reservations` where `expires_at < now()`. This releases abandoned slots back to the availability pool.

### 5.4 Concurrency Edge Case: Simultaneous Payment

When two patients hold overlapping reservations (should not happen due to UNIQUE constraint, but defensive handling):

1. The first `createAppointment` transaction to commit wins — the appointment is created and the reservation deleted.
2. The second transaction detects the slot is taken (conflicting appointment exists), rolls back, and returns `SlotNoLongerAvailableError`.
3. If payment was already captured for the losing transaction, an automatic refund is issued via Stripe.

---

## 6. Twilio Video Integration

### 6.1 Room Lifecycle

```
Appointment CONFIRMED
        |
        v
+------------------+
| Create Room      |  twilio.video.v1.rooms.create()
| status: CREATED  |  Room type: 'group' (supports 1:1 and multi-party)
| room_name: apt_id|  Room name: appointment.id
+--------+---------+
         |
    Patient joins → enters waiting room
         |
         v
+------------------+
| WAITING          |  Patient connected, provider not yet joined
| Patient sees:    |  WebSocket event: 'patient_in_waiting_room'
| "Waiting for     |  Provider sees notification on dashboard
|  provider..."    |
+--------+---------+
         |
    Provider joins room
         |
         v
+------------------+
| IN_PROGRESS      |  Both parties connected
| Timer starts     |  Appointment status → IN_PROGRESS
| Call controls    |  set checked_in_at = now()
| visible          |
+--------+---------+
         |
    Both disconnect OR hard limit reached
         |
         v
+------------------+
| COMPLETED        |  Room closed
| Duration logged  |  Appointment status → COMPLETED
| actual_duration  |  set completed_at = now()
| calculated       |
+------------------+
```

### 6.2 Room Creation

Rooms are created asynchronously when an appointment transitions to CONFIRMED, via the `appointment.confirmed` event handler:

```
onAppointmentConfirmed(appointment):
  if appointment.consultation_type != 'VIDEO':
    return  // No video room for IN_PERSON or PHONE (BOTH is resolved to VIDEO or IN_PERSON at booking time)

  // Create Twilio room
  twilioRoom = await twilio.video.v1.rooms.create({
    uniqueName: appointment.id,
    type: 'group',                    // Supports 1:1 and multi-party
    maxParticipants: service.max_participants,
    statusCallback: TWILIO_STATUS_CALLBACK_URL,  // POST /api/webhooks/twilio
    statusCallbackMethod: 'POST'
  })

  // Persist room record
  INSERT INTO video_rooms (
    practice_id = appointment.practice_id,
    appointment_id = appointment.id,
    twilio_room_sid = twilioRoom.sid,
    twilio_room_name = appointment.id,
    status = 'CREATED',
    max_participants = service.max_participants
  )
```

### 6.3 Access Token Generation

Each participant receives a short-lived Twilio access token to join the room:

```
generateVideoToken(appointment_id, user_id):
  appointment = getAppointment(appointment_id)
  service = getService(appointment.service_id)
  videoRoom = getVideoRoom(appointment_id)

  // Verify participant authorization
  if user_id != appointment.patient_id
    AND user_id NOT IN getProviderUserIds(appointment.provider_profile_id):
    throw UnauthorizedError

  // Generate Twilio access token
  token = new AccessToken(
    TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY,
    TWILIO_API_SECRET,
    {
      identity: user_id,
      ttl: (service.duration_minutes + 30) * 60  // Duration + 30 min buffer
    }
  )

  // Grant video access
  videoGrant = new VideoGrant({ room: videoRoom.twilio_room_name })
  token.addGrant(videoGrant)

  return { token: token.toJwt(), room_name: videoRoom.twilio_room_name }
```

### 6.4 Waiting Room Pattern

The waiting room is implemented client-side using Twilio Video SDK events:

1. **Patient connects** to the Twilio room. The client displays a waiting screen with "Waiting for provider..." message.
2. **Server emits** `PATIENT_IN_WAITING_ROOM` WebSocket event to the provider's notification channel (`user:{provider_user_id}:notifications`).
3. **Provider's dashboard** shows a "Patient waiting" badge on the appointment card with a "Join Now" button.
4. **Provider connects** to the room. The Twilio `participantConnected` event fires on the patient's client.
5. **Patient's client** transitions from the waiting screen to the active video call UI.

**Technical note:** Twilio's `group` room type allows all participants to connect simultaneously — the "waiting room" is a UI pattern, not a Twilio feature. The patient can see/hear nothing until the provider joins because the UI only renders remote participant tracks after detecting the provider's `participantConnected` event.

### 6.5 Call Controls

Both participants have access to:

| Control | Action | Implementation |
|---------|--------|----------------|
| Mute Audio | Toggle local audio track | `localAudioTrack.disable()` / `.enable()` |
| Mute Video | Toggle local video track | `localVideoTrack.disable()` / `.enable()` |
| Screen Share | Share screen content | `navigator.mediaDevices.getDisplayMedia()` → publish track |
| End Call | Disconnect from room | `room.disconnect()` |
| Call Timer | Display elapsed time | Client-side timer from `checked_in_at` |

**Screen sharing rules:**
- One screen share active at a time per room
- Shared screen replaces the main video track (picture-in-picture for self-view)
- Either participant can share
- Screen share stops when the sharing participant clicks "Stop Sharing" or disconnects

### 6.6 Group Session Behavior

For services with `max_participants > 2` (up to 6):

- **Grid layout:** All participant video feeds displayed in a responsive grid (2x2, 2x3, 3x3 based on count)
- **Provider is host:** Only the provider can end the session for all participants
- **Participant list:** Sidebar showing all connected participants with mute indicators
- **Individual disconnect:** Patients can leave independently; session continues for remaining participants
- **Session ends when:** Provider disconnects, OR all participants disconnect, OR hard time limit reached

### 6.7 Room Auto-Close Rules

| Condition | Action | Timer |
|-----------|--------|-------|
| Both parties disconnect | Close room after 5 min grace period (allows reconnection) | 5 minutes |
| Scheduled end time + 15 min, no participants connected | Close room, mark NO_SHOW | end_time + 15 min |
| Scheduled end time + 30 min, session still active | Force close room (hard limit) | end_time + 30 min |
| Reconnection window | Participant can rejoin within 5 min of disconnect | 5 min from disconnect |

Auto-close is handled by the `videoRoomCleanup` BullMQ job (§9.4).

### 6.8 Twilio Status Callbacks

Twilio sends status callback webhooks to `POST /api/webhooks/twilio` for room and participant events:

| Event | Twilio Callback | MedConnect Action |
|-------|-----------------|-------------------|
| Room created | `room-created` | Log; update video_rooms status if needed |
| Participant connected | `participant-connected` | Insert video_participants row; set `joined_at`; emit WebSocket event |
| Participant disconnected | `participant-disconnected` | Set `left_at`; calculate `duration_seconds`; emit WebSocket event |
| Room ended | `room-ended` | Set video_rooms `ended_at`, `actual_duration_seconds`, status → COMPLETED |

**Webhook verification:** All Twilio callbacks are verified using `twilio.validateRequest()` with the auth token. Unverified requests return HTTP 403.

### 6.9 Pre-Call Device Check (Should Priority)

Before joining the video room, the client runs a device check:

1. Request camera permission → show video preview
2. Request microphone permission → show audio level indicator
3. Test speaker → play test tone
4. Allow device selection if multiple cameras/mics detected
5. Show connection quality estimate (Twilio Network Quality API)
6. "Join Call" button enabled only when camera + mic permissions granted

### 6.10 Video Provider Abstraction Layer

**Motivation:** Twilio Programmable Video SDK 2.x reaches end-of-life on December 5, 2026. To protect the investment in video UI components and business logic, the video integration is built behind a provider abstraction layer.

**Interface:**

```typescript
// apps/api/src/modules/video/providers/video-provider.interface.ts
interface VideoProvider {
  createRoom(config: CreateRoomConfig): Promise<VideoRoom>;
  endRoom(roomId: string): Promise<void>;
  generateToken(params: GenerateTokenParams): Promise<VideoToken>;
  validateWebhook(headers: Record<string, string>, body: string): boolean;
  parseWebhookEvent(body: any): VideoWebhookEvent;
}

interface CreateRoomConfig {
  roomName: string;           // appointment.id
  maxParticipants: number;    // service.max_participants
  statusCallbackUrl: string;  // Webhook URL for room events
}

interface GenerateTokenParams {
  identity: string;           // user_id
  roomName: string;           // appointment.id
  ttlSeconds: number;         // (duration_minutes + 30) * 60
}

interface VideoWebhookEvent {
  type: 'room-created' | 'participant-connected' | 'participant-disconnected' | 'room-ended';
  roomName: string;
  participantIdentity?: string;
  timestamp: Date;
}
```

**Implementation strategy:**

| Provider | Status | HIPAA BAA | Licensing | Notes |
|----------|--------|-----------|-----------|-------|
| **Twilio Video** | Active (EOL Dec 2026) | Yes (paid plan) | Proprietary | Current implementation. Trial credits for demo. |
| **Daily.co** | Primary migration target | Yes (Healthcare add-on) | Proprietary | Similar API surface. $30K migration credit for Twilio customers. SOC 2 Type II. |
| **LiveKit** | Fallback option | Yes (Cloud Scale/Enterprise) | Apache 2.0 (self-hosted) | Open-source SFU. Self-hostable for full data control. Cloud option available. |

**Migration scope:** The abstraction layer isolates all Twilio-specific **server-side** code to a single provider class (`TwilioVideoProvider`). Server-side operations (room creation, token generation, webhook handling) are fully abstracted. The **frontend** uses provider-agnostic WebSocket events (§6.8) for room status updates and waiting room state, but **requires the provider's client SDK** for media streams (camera, microphone, screen share) and call controls. Migration to a new provider requires:
1. New server-side provider class implementing `VideoProvider` interface
2. Frontend client SDK swap (replace `twilio-video` with Daily.js or `livekit-client`) — call controls and media handling are provider-specific
3. Webhook endpoint adapter for the new provider's callback format
4. No changes to: appointment state machine, video room DB records, BullMQ jobs, waiting room UI **logic** (though UI **SDK bindings** change per step 2)

**Selection:** The active provider is configured via `VIDEO_PROVIDER` environment variable (`twilio` | `daily` | `livekit`), resolved at module initialization via NestJS DI.

---

## 7. Cancellation Policy & Refund Logic

### 7.1 Policy Structure

Each practice configures a cancellation policy at the practice level (`practices.default_cancellation_policy` JSONB):

```json
{
  "free_cancel_hours": 24,
  "late_cancel_fee_percent": 50,
  "no_refund_hours": 2
}
```

### 7.2 Cancellation Policy Evaluation

```
evaluateCancellationPolicy(practice, appointment):
  policy = practice.default_cancellation_policy
  if policy == null:
    // Default: free cancellation anytime
    return { refund_type: 'FULL_REFUND', refund_amount: payment.amount, fee: 0 }

  payment = getPaymentRecord(appointment.id)
  if !payment OR payment.status != 'SUCCEEDED':
    // No payment collected — nothing to refund
    return { refund_type: 'NONE', refund_amount: 0, fee: 0 }

  hours_until_start = (appointment.start_time - now()) / 3600

  // Free cancellation window
  if hours_until_start >= policy.free_cancel_hours:
    return { refund_type: 'FULL_REFUND', refund_amount: payment.amount, fee: 0 }

  // No-refund window
  if policy.no_refund_hours > 0 AND hours_until_start <= policy.no_refund_hours:
    return { refund_type: 'NO_REFUND', refund_amount: 0, fee: payment.amount }

  // Late cancellation fee
  fee = payment.amount * (policy.late_cancel_fee_percent / 100)
  refund_amount = payment.amount - fee
  return {
    refund_type: 'PARTIAL_REFUND',
    refund_amount: round(refund_amount, 2),
    fee: round(fee, 2)
  }
```

### 7.3 Cancellation Flow

```
cancelAppointment(appointment_id, cancelled_by, reason):
  appointment = getAppointment(appointment_id)

  // Validate transition
  if appointment.status NOT IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS'):
    throw InvalidAppointmentTransitionError

  // IN_PROGRESS cancellation requires admin role
  if appointment.status == 'IN_PROGRESS':
    if !isAdmin(cancelled_by, appointment.practice_id):
      throw ForbiddenError('Only admins can cancel in-progress appointments')

  // Evaluate cancellation policy
  result = evaluateCancellationPolicy(practice, appointment)

  BEGIN TRANSACTION:
    // Update appointment
    UPDATE appointments SET
      status = 'CANCELLED',
      cancellation_reason = reason,
      cancelled_by = cancelled_by,
      cancelled_at = now()
    WHERE id = appointment_id

    // Process refund (if applicable)
    if result.refund_type IN ('FULL_REFUND', 'PARTIAL_REFUND'):
      processRefund(appointment, result.refund_amount)

  COMMIT

  // Async side effects
  emit('appointment.cancelled', { appointment, refund: result })
  // → Triggers: cancellation email, calendar event deletion, slot release
```

---

## 8. Stripe Connect Payment Flow

### 8.1 Practice Onboarding (Stripe Connect Express)

```
initateStripeConnect(practice_id):
  practice = getPractice(practice_id)

  // Create connected account (if not exists)
  if !practice.stripe_account_id:
    account = await stripe.accounts.create({
      type: 'express',
      country: practice.country,
      email: practice.contact_email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      },
      metadata: { practice_id: practice.id }
    })
    UPDATE practices SET stripe_account_id = account.id

  // Generate onboarding link
  accountLink = await stripe.accountLinks.create({
    account: practice.stripe_account_id,
    refresh_url: `${APP_URL}/practice/settings/payments?refresh=true`,
    return_url: `${APP_URL}/practice/settings/payments?success=true`,
    type: 'account_onboarding'
  })

  return { url: accountLink.url }
```

After the practice admin completes Stripe's onboarding flow and returns to MedConnect, the `account.updated` webhook confirms onboarding status and sets `practice.stripe_onboarded = true`.

### 8.2 Payment Intent Creation

When a patient books a paid appointment:

```
processPayment(appointment, payment_method_id):
  service = getService(appointment.service_id)
  practice = getPractice(appointment.practice_id)

  amount_cents = Math.round(service.price * 100)  // Convert to cents
  platform_fee_cents = Math.round(amount_cents * 0.01)  // 1% platform fee

  // Create payment intent on connected account
  paymentIntent = await stripe.paymentIntents.create({
    amount: amount_cents,
    currency: practice.currency.toLowerCase(),
    payment_method: payment_method_id,
    confirm: true,
    application_fee_amount: platform_fee_cents,
    transfer_data: {
      destination: practice.stripe_account_id
    },
    // IMPORTANT: Stripe metadata must NEVER contain PHI (patient names, conditions,
    // diagnoses, treatment details). Only opaque IDs are permitted. See SRS-4 §8.7.
    metadata: {
      appointment_id: appointment.id,
      practice_id: practice.id
    }
  })

  // Create payment record
  INSERT INTO payment_records (
    practice_id = practice.id,
    appointment_id = appointment.id,
    amount = service.price,
    currency = practice.currency,
    status = mapStripeStatus(paymentIntent.status),
    stripe_payment_intent_id = paymentIntent.id,
    platform_fee = service.price * 0.01
  )

  return { status: paymentIntent.status, payment_intent_id: paymentIntent.id }
```

### 8.3 Payment State Machine

```
+---------+  capture   +-----------+
| PENDING |----------->| SUCCEEDED |
+----+----+            +--+-----+--+
     |                    |     |
     | fail               | full refund
     v                    |     | partial refund
+---------+               |     v
| FAILED  |          +----v---+ +--------------------+
+---------+          |REFUNDED| |PARTIALLY_REFUNDED  |
                     +--------+ +---------+----------+
                                          |
                                          | full refund
                                          v
                                     +--------+
                                     |REFUNDED|
                                     +--------+
```

| From | To | Trigger |
|------|----|---------|
| PENDING | SUCCEEDED | Stripe `payment_intent.succeeded` webhook |
| PENDING | FAILED | Stripe `payment_intent.payment_failed` webhook |
| SUCCEEDED | REFUNDED | Full refund via `charge.refunded` webhook |
| SUCCEEDED | PARTIALLY_REFUNDED | Partial refund via `charge.refunded` webhook (refund < amount) |
| PARTIALLY_REFUNDED | REFUNDED | Remaining balance refunded |

### 8.4 Refund Processing

```
processRefund(appointment, refund_amount):
  payment = getPaymentRecord(appointment.id)

  refund_amount_cents = Math.round(refund_amount * 100)

  refund = await stripe.refunds.create({
    payment_intent: payment.stripe_payment_intent_id,
    amount: refund_amount_cents,
    // No PHI in metadata — only opaque IDs and generic reason codes (SRS-4 §8.7)
    metadata: {
      appointment_id: appointment.id,
      reason: 'appointment_cancellation'
    }
  })

  UPDATE payment_records SET
    status = refund_amount >= payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
    refund_amount = refund_amount,
    refunded_at = now()
  WHERE appointment_id = appointment.id
```

### 8.5 Stripe Webhook Handler

`POST /api/webhooks/stripe` processes the following events:

| Event | Action |
|-------|--------|
| `payment_intent.succeeded` | Update payment_records status → SUCCEEDED; if appointment PENDING + AUTO_CONFIRM → transition to CONFIRMED |
| `payment_intent.payment_failed` | Update payment_records status → FAILED; appointment remains PENDING (patient retries or abandons) |
| `charge.refunded` | Update payment_records status → REFUNDED or PARTIALLY_REFUNDED based on amount |
| `account.updated` | Check connected account status; update `practice.stripe_onboarded` |

**Webhook signature verification:** All Stripe webhooks are verified using `stripe.webhooks.constructEvent()` with the webhook signing secret. Unverified requests return HTTP 400.

**Idempotency:** Webhook handlers are idempotent — processing the same event twice produces no additional side effects. The `stripe_payment_intent_id` serves as the deduplication key.

### 8.6 Offline Payment Path

When a practice has not connected Stripe (`stripe_onboarded = false`) or a service has `price = 0`:

1. The payment step is skipped entirely in the booking flow.
2. Appointment transitions directly to CONFIRMED (if AUTO_CONFIRM) or remains PENDING (if MANUAL_APPROVAL).
3. No `payment_records` row is created.
4. The practice collects payment at the visit or via external means.

This is a first-class path, not an error state. Many practices use telehealth for initial consultations (free) and collect payment for follow-ups.

---

## 9. Background Jobs (BullMQ)

All background jobs run on BullMQ workers connected to the shared Redis instance. Jobs are defined in the NestJS API application and processed by dedicated worker processes.

### 9.1 Job Registry

| Job Name | Queue | Schedule | Description |
|----------|-------|----------|-------------|
| `cleanExpiredReservations` | `scheduling` | Every 1 minute (repeatable) | Delete slot_reservations where `expires_at < now()` |
| `processCompletedAppointments` | `appointments` | Every 5 minutes (repeatable) | Transition CONFIRMED → COMPLETED for past IN_PERSON/PHONE appointments (auto-complete). VIDEO appointments are excluded — they go to NO_SHOW via `detectNoShows` if no video activity occurs. |
| `detectNoShows` | `appointments` | Every 5 minutes (repeatable) | Transition CONFIRMED → NO_SHOW for VIDEO appointments past `end_time + 15 min` with no check-in or video room activity. IN_PERSON/PHONE no-shows are marked manually by the provider. |
| `sendAppointmentReminder` | `notifications` | Scheduled (delayed job) | Send 24h and 1h reminder emails, and VIDEO_ROOM_READY notification (15 min before start, VIDEO appointments only). One job per reminder, scheduled at booking confirmation. |
| `sendFollowUpEmail` | `notifications` | Scheduled (delayed job) | Send follow-up email 24h after appointment COMPLETED |
| `sendUnreadMessageEmail` | `notifications` | Scheduled (delayed job, 5 min) | Send email notification for messages unread after 5 minutes. Queued when recipient is offline at message send time. Cancelled if recipient reads before job fires. |
| `sendIntakeFormReminder` | `notifications` | Scheduled (delayed job) | Send intake form reminder email if form not completed 24h before appointment. Scheduled at booking confirmation for services with intake templates (Should priority — FR-INT-7). |
| `videoRoomCleanup` | `video` | Every 5 minutes (repeatable) | Close stale video rooms past hard time limits |
| `calendarEventPush` | `calendar` | On-demand (event-driven) | Push appointment event to connected Google/Outlook calendar |
| `calendarInboundSync` | `calendar` | Every 15 minutes (repeatable) | Pull external calendar events as INBOUND blocks |
| `calendarTokenRefresh` | `calendar` | Every 1 hour (repeatable) | Refresh OAuth tokens for calendar connections nearing expiry |
| `enforceApprovalDeadlines` | `appointments` | Every 1 hour (repeatable) | Auto-cancel PENDING appointments with MANUAL_APPROVAL past 48h deadline |
| `generatePatientDataExport` | `exports` | On-demand (event-driven) | Generate patient data export JSON (profile, appointments, intake, payments, messages, consent), upload to R2 with 24h signed URL, send download email. See SRS-4 §10.3. |
| `deleteOrphanedUpload` | `uploads` | On-demand (event-driven) | Delete old R2 object when avatar/logo/cover is replaced. 1-hour delay for cache grace period. See SRS-4 §11.7. |

### 9.2 Reminder Scheduling

When an appointment is confirmed, the system schedules individual reminder jobs:

```
onAppointmentConfirmed(appointment):
  practice = getPractice(appointment.practice_id)
  settings = practice.reminder_settings

  // 24h email reminder
  if settings.email_24h:
    delay_ms = appointment.start_time - 24h - now()
    if delay_ms > 0:
      reminderQueue.add('sendAppointmentReminder', {
        appointment_id: appointment.id,
        type: 'EMAIL_24H'
      }, { delay: delay_ms, jobId: `reminder-24h-${appointment.id}` })

      INSERT INTO appointment_reminders (
        practice_id, appointment_id, type = 'EMAIL_24H',
        scheduled_for = appointment.start_time - 24h
      )

  // 1h email reminder
  if settings.email_1h:
    delay_ms = appointment.start_time - 1h - now()
    if delay_ms > 0:
      reminderQueue.add('sendAppointmentReminder', {
        appointment_id: appointment.id,
        type: 'EMAIL_1H'
      }, { delay: delay_ms, jobId: `reminder-1h-${appointment.id}` })

      INSERT INTO appointment_reminders (
        practice_id, appointment_id, type = 'EMAIL_1H',
        scheduled_for = appointment.start_time - 1h
      )

  // 1h SMS reminder (optional)
  if settings.sms_1h:
    // Same pattern; requires patient SMS consent (consent_records check)

  // VIDEO_ROOM_READY notification (15 min before start, VIDEO only)
  if appointment.consultation_type == 'VIDEO':
    delay_ms = appointment.start_time - 15min - now()
    if delay_ms > 0:
      reminderQueue.add('sendAppointmentReminder', {
        appointment_id: appointment.id,
        type: 'VIDEO_ROOM_READY'
      }, { delay: delay_ms, jobId: `video-ready-${appointment.id}` })

      INSERT INTO appointment_reminders (
        practice_id, appointment_id, type = 'VIDEO_ROOM_READY',
        scheduled_for = appointment.start_time - 15min
      )

  // Intake form reminder (Should priority — FR-INT-7)
  service = getService(appointment.service_id)
  if service.intake_template_id IS NOT NULL:
    delay_ms = appointment.start_time - 24h - now()
    if delay_ms > 0:
      reminderQueue.add('sendIntakeFormReminder', {
        appointment_id: appointment.id
      }, { delay: delay_ms, jobId: `intake-reminder-${appointment.id}` })
```

### 9.3 Reminder Job Execution

```
processAppointmentReminder(job):
  appointment = getAppointment(job.data.appointment_id)

  // Skip if appointment is no longer active
  if appointment.status NOT IN ('CONFIRMED'):
    UPDATE appointment_reminders SET sent_at = now()  // Mark as handled
    return

  // Send reminder
  try:
    if job.data.type.startsWith('EMAIL'):
      sendReminderEmail(appointment)
    else if job.data.type.startsWith('SMS'):
      sendReminderSms(appointment)

    UPDATE appointment_reminders SET sent_at = now()
    WHERE appointment_id = appointment.id AND type = job.data.type

  catch error:
    UPDATE appointment_reminders SET
      retry_count = retry_count + 1,
      failed_at = now()
    WHERE appointment_id = appointment.id AND type = job.data.type

    if retry_count < 3:
      throw error  // BullMQ will retry with backoff
    else:
      log.error('Reminder delivery permanently failed', { appointment_id, type })
```

### 9.4 Video Room Cleanup Job

```
processVideoRoomCleanup():
  // 1. Close rooms past hard time limit (end_time + 30 min, still IN_PROGRESS)
  stale_active = SELECT vr.*, a.end_time FROM video_rooms vr
    JOIN appointments a ON a.id = vr.appointment_id
    WHERE vr.status = 'IN_PROGRESS'
      AND a.end_time + INTERVAL '30 minutes' < now()

  for room in stale_active:
    await twilio.video.v1.rooms(room.twilio_room_sid).update({ status: 'completed' })
    UPDATE video_rooms SET
      status = 'COMPLETED', ended_at = now(),
      actual_duration_seconds = EXTRACT(EPOCH FROM now() - room.started_at)
    UPDATE appointments SET status = 'COMPLETED', completed_at = now()

  // 2. Detect no-show rooms (CREATED, past end_time + 15 min, no participants ever joined)
  stale_created = SELECT vr.*, a.end_time FROM video_rooms vr
    JOIN appointments a ON a.id = vr.appointment_id
    WHERE vr.status IN ('CREATED', 'WAITING')
      AND a.end_time + INTERVAL '15 minutes' < now()
      AND NOT EXISTS (SELECT 1 FROM video_participants WHERE video_room_id = vr.id)

  for room in stale_created:
    await twilio.video.v1.rooms(room.twilio_room_sid).update({ status: 'completed' })
    UPDATE video_rooms SET status = 'COMPLETED', ended_at = now()
    // Appointment no-show is handled by the separate detectNoShows job

  // 3. Close rooms where both parties disconnected > 5 min ago
  disconnected = SELECT vr.* FROM video_rooms vr
    WHERE vr.status = 'IN_PROGRESS'
      AND NOT EXISTS (
        SELECT 1 FROM video_participants vp
        WHERE vp.video_room_id = vr.id AND vp.left_at IS NULL
      )
      AND (SELECT MAX(left_at) FROM video_participants WHERE video_room_id = vr.id)
        + INTERVAL '5 minutes' < now()

  for room in disconnected:
    await twilio.video.v1.rooms(room.twilio_room_sid).update({ status: 'completed' })
    UPDATE video_rooms SET
      status = 'COMPLETED', ended_at = now(),
      actual_duration_seconds = EXTRACT(EPOCH FROM now() - room.started_at)
    UPDATE appointments SET status = 'COMPLETED', completed_at = now()
```

### 9.5 Auto-Complete Job (processCompletedAppointments)

```
processCompletedAppointments():
  // Auto-complete IN_PERSON/PHONE appointments past end_time
  // VIDEO appointments are excluded — they go to NO_SHOW via detectNoShows
  overdue = SELECT a.* FROM appointments a
    WHERE a.status = 'CONFIRMED'
      AND a.end_time < now()
      AND a.consultation_type IN ('IN_PERSON', 'PHONE')

  for appointment in overdue:
    UPDATE appointments SET
      status = 'COMPLETED',
      completed_at = now()
    WHERE id = appointment.id

    emit('appointment.completed', appointment)
```

### 9.6 No-Show Detection Job (detectNoShows)

```
detectNoShows():
  // Detect no-shows for VIDEO appointments past end_time + 15 min grace period
  overdue = SELECT a.* FROM appointments a
    WHERE a.status = 'CONFIRMED'
      AND a.end_time + INTERVAL '15 minutes' < now()
      AND a.consultation_type = 'VIDEO'
      AND a.checked_in_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM video_rooms vr
          JOIN video_participants vp ON vp.video_room_id = vr.id
          WHERE vr.appointment_id = a.id
      )

  for appointment in overdue:
    UPDATE appointments SET status = 'NO_SHOW'
    WHERE id = appointment.id

    emit('appointment.no_show', appointment)
```

### 9.7 Approval Deadline Enforcement Job

```
processEnforceApprovalDeadlines():
  // Find PENDING appointments with MANUAL_APPROVAL that have exceeded the 48h deadline
  overdue = SELECT a.* FROM appointments a
    JOIN services s ON s.id = a.service_id
    WHERE a.status = 'PENDING'
      AND s.confirmation_mode = 'MANUAL_APPROVAL'
      AND a.created_at + INTERVAL '48 hours' < now()

  for appointment in overdue:
    // Transition to CANCELLED
    UPDATE appointments SET
      status = 'CANCELLED',
      cancellation_reason = 'APPROVAL_TIMEOUT',
      cancelled_at = now()
    WHERE id = appointment.id

    // Process refund if payment was collected
    if EXISTS (SELECT 1 FROM payment_records WHERE appointment_id = appointment.id AND status = 'SUCCEEDED'):
      processFullRefund(appointment.id)

    // Notify patient
    emit('appointment.cancelled', {
      appointment,
      reason: 'APPROVAL_TIMEOUT',
      refund_issued: true
    })

    // Audit log
    auditLog('APPOINTMENT_AUTO_CANCELLED', appointment.id, {
      reason: 'APPROVAL_TIMEOUT',
      hours_elapsed: 48
    })
```

### 9.8 BullMQ Configuration

```typescript
// Queue configuration (shared across all queues)
const defaultQueueConfig = {
  connection: { host: REDIS_HOST, port: REDIS_PORT },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },  // 5s, 10s, 20s
    removeOnComplete: { age: 86400 },  // Keep completed jobs for 24h
    removeOnFail: { age: 604800 }       // Keep failed jobs for 7 days
  }
};

// Queue definitions
const queues = {
  scheduling: new Queue('scheduling', defaultQueueConfig),
  appointments: new Queue('appointments', defaultQueueConfig),
  notifications: new Queue('notifications', defaultQueueConfig),
  video: new Queue('video', defaultQueueConfig),
  calendar: new Queue('calendar', defaultQueueConfig)
};
```

### 9.9 Job Failure Handling

| Failure Scenario | Behavior |
|------------------|----------|
| Transient error (network, timeout) | Retry up to 3 times with exponential backoff (5s, 10s, 20s) |
| Permanent error (invalid data) | Log error to Sentry; move to failed queue for inspection |
| Twilio API error | Retry up to 3 times; if permanent, log and notify admin |
| Stripe API error | Retry up to 3 times; if permanent, payment stays PENDING and admin is notified |
| Redis connection lost | BullMQ auto-reconnects; jobs resume on reconnection |

---

## 10. Appointment Rescheduling

### 10.1 Reschedule Flow

```
rescheduleAppointment(appointment_id, new_start_time, rescheduled_by):
  appointment = getAppointment(appointment_id)

  // Validate: only CONFIRMED appointments can be rescheduled
  if appointment.status != 'CONFIRMED':
    throw InvalidAppointmentTransitionError

  service = getService(appointment.service_id)
  new_end_time = new_start_time + service.duration_minutes

  // Verify new slot is available
  if !isSlotAvailable(appointment.provider_profile_id, new_start_time, new_end_time):
    throw SlotNotAvailableError

  BEGIN TRANSACTION:
    // Store original times for calendar update
    original_start = appointment.start_time
    original_end = appointment.end_time

    // Update appointment times
    UPDATE appointments SET
      start_time = new_start_time,
      end_time = new_end_time,
      updated_at = now()
    WHERE id = appointment_id

    // Cancel and re-schedule reminders
    cancelReminders(appointment_id)
    scheduleReminders(appointment)

    // Update or recreate video room if timing changes significantly
    if appointment.consultation_type IN ('VIDEO'):
      updateVideoRoomIfNeeded(appointment)

  COMMIT

  // Async side effects
  emit('appointment.rescheduled', {
    appointment,
    original_start, original_end,
    rescheduled_by
  })
  // → Triggers: reschedule email, calendar event update
```

---

## Cross-References

- **SRS-1 (Architecture):** Monorepo structure (§6), multi-tenancy RLS (§7), WebSocket architecture (§12), deployment (§8).
- **SRS-2 (Data Model):** All table schemas referenced in this document — appointments, slot_reservations, video_rooms, video_participants, payment_records, services, availability_rules, blocked_dates, calendar_events.
- **SRS-4 (Communications & Security):** Email notification templates, WebSocket messaging protocol, auth/authz middleware, audit logging, calendar sync protocol details.
- **PRD:** Functional requirements: FR-APT (booking), FR-VID (video), FR-PAY (payments), FR-CAL (calendar), FR-NOT (notifications).
- **BRD:** Business rules: BR-3 (appointment integrity), BR-4 (payment processing), BR-5 (video consultation rules).

---

**Company:** SJD Labs, LLC | **Founder:** Stephen Deslate
