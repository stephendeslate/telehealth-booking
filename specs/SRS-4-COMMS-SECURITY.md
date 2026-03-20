# MedConnect — Software Requirements Specification: Communications & Security

**Author:** SJD Labs, LLC
**Document:** SRS Part 4 of 4

---

## 1. Scope

This document specifies the communications system (email, SMS, in-app notifications, WebSocket messaging), authentication & authorization, HIPAA compliance architecture, calendar sync protocol, and audit logging for the MedConnect telehealth platform. For system architecture, see **SRS-1**. For data models, see **SRS-2**. For booking, video, and payment logic, see **SRS-3**.

---

## 2. Email Communications

### 2.1 Rendering Engine

All transactional emails use hardcoded React Email components rendered server-side via `@react-email/render` and sent through Resend. No user-customizable templates — all templates are code-defined.

### 2.2 Email Template Registry

| Template Key | Trigger | Recipients | Priority | FR Reference |
|-------------|---------|------------|----------|-------------|
| `auth.verify-email` | User registers | User | HIGH | FR-AUTH-2 |
| `auth.password-reset` | Password reset requested | User | HIGH | FR-AUTH-7 |
| `auth.welcome` | Email verified | User | NORMAL | FR-AUTH-2 |
| `appointment.confirmed` | Appointment → CONFIRMED | Patient + Provider | HIGH | FR-APT-11 |
| `appointment.cancelled` | Appointment → CANCELLED | Patient + Provider | HIGH | FR-APT-5 |
| `appointment.rescheduled` | Appointment rescheduled | Patient + Provider | HIGH | FR-APT-6 |
| `appointment.reminder-24h` | 24h before appointment | Patient | NORMAL | FR-NOT-2 |
| `appointment.reminder-1h` | 1h before appointment | Patient | HIGH | FR-NOT-2 |
| `appointment.follow-up` | 24h after COMPLETED | Patient | NORMAL | FR-APT-12 |
| `intake.form-link` | Appointment confirmed (if intake configured) | Patient | NORMAL | FR-INT-3 |
| `intake.reminder` | Intake not completed 24h before appointment | Patient | NORMAL | FR-INT-7 |
| `payment.receipt` | Payment SUCCEEDED | Patient | HIGH | FR-PAY-8 |
| `payment.refund` | Refund processed | Patient | NORMAL | FR-PAY-4 |
| `provider.invitation` | Practice admin invites provider | Invited provider | HIGH | FR-PROV-7 |
| `message.unread` | Message unread after 5 min | Recipient | NORMAL | FR-MSG-5 |
| `patient.data-export-ready` | Patient data export complete | Patient | NORMAL | FR-PP-9 |

### 2.3 Email Context Variables

Each template receives a typed context object:

| Group | Variables |
|-------|-----------|
| patient | `patient.name`, `patient.email` |
| provider | `provider.name`, `provider.credentials`, `provider.specialties` |
| appointment | `appointment.date`, `appointment.time`, `appointment.service_name`, `appointment.consultation_type`, `appointment.video_join_url`, `appointment.status` |
| practice | `practice.name`, `practice.logo_url`, `practice.contact_email`, `practice.address`, `practice.brand_color` |
| payment | `payment.amount`, `payment.currency`, `payment.date`, `payment.receipt_url` |
| urls | `urls.appointment_detail`, `urls.patient_portal`, `urls.video_join`, `urls.intake_form`, `urls.booking_page`, `urls.rebook` |

### 2.4 Email Delivery

```
sendTransactionalEmail(template_key, context, recipient):
  // Render React Email component
  html = render(getTemplate(template_key), context)
  subject = getSubjectLine(template_key, context)

  // Send via Resend
  result = await resend.emails.send({
    from: 'MedConnect <noreply@medconnect.app>',
    to: recipient.email,
    subject: subject,
    html: html,
    tags: [
      { name: 'template', value: template_key },
      { name: 'practice_id', value: context.practice?.id }
    ]
  })

  // Log delivery
  log.info('Email sent', { template_key, recipient: recipient.email, resend_id: result.id })
```

**Retry policy:** Failed email sends are retried up to 3 times with exponential backoff (5s, 10s, 20s) via BullMQ. After 3 failures, the error is logged to Sentry and the delivery is abandoned. No user-facing error — email failures are non-blocking.

### 2.5 SMS Communications (Should Priority)

SMS is used for appointment reminders only (1h before), via Twilio Messaging:

```
sendSmsReminder(appointment):
  patient = getPatient(appointment.patient_id)

  // Check SMS consent
  consent = SELECT * FROM consent_records
    WHERE user_id = patient.id AND type = 'SMS_OPT_IN' AND revoked_at IS NULL
  if !consent:
    return  // Patient has not opted in

  if !patient.phone:
    return  // No phone number

  message = `Reminder: Your appointment with ${provider.name} is in 1 hour. `
  if appointment.consultation_type == 'VIDEO':
    message += `Join: ${VIDEO_JOIN_URL}/${appointment.id}`

  await twilio.messages.create({
    body: message,
    to: patient.phone,
    from: TWILIO_PHONE_NUMBER
  })
```

---

## 3. In-App Notification System

### 3.1 Notification Types

| Type | Trigger | Channel | Priority |
|------|---------|---------|----------|
| `APPOINTMENT_CONFIRMED` | Appointment confirmed | In-app + Email | HIGH |
| `APPOINTMENT_CANCELLED` | Appointment cancelled | In-app + Email | HIGH |
| `APPOINTMENT_RESCHEDULED` | Appointment rescheduled | In-app + Email | HIGH |
| `APPOINTMENT_REMINDER` | Reminder job fires | In-app + Email | NORMAL |
| `NEW_MESSAGE` | Message received | In-app + WebSocket | HIGH |
| `INTAKE_FORM_COMPLETED` | Patient submits intake | In-app (provider only) | NORMAL |
| `VIDEO_ROOM_READY` | 15 minutes before appointment start time (not at room creation, which may be days earlier) | In-app + WebSocket | HIGH |
| `PAYMENT_RECEIVED` | Payment succeeds | In-app (provider/admin) | NORMAL |
| `PAYMENT_REFUNDED` | Refund processed | In-app + Email | NORMAL |
| `PATIENT_IN_WAITING_ROOM` | Patient joins video room | In-app + WebSocket | HIGH |

### 3.2 Notification Delivery

```
createNotification(type, user_id, practice_id, data):
  notification = INSERT INTO notifications (
    user_id, practice_id, type,
    title = getNotificationTitle(type, data),
    body = getNotificationBody(type, data),
    data = data  // JSONB: { appointment_id, message_id, etc. }
  )

  // Push via WebSocket (if user is online)
  socketGateway.emit(`user:${user_id}:notifications`, {
    type: 'NEW_NOTIFICATION',
    notification: notification
  })

  return notification
```

### 3.3 Notification API

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/me/notifications | List notifications (paginated, newest first) |
| GET | /api/me/notifications?unread=true | List unread only |
| PATCH | /api/notifications/:id/read | Mark single as read |
| POST | /api/me/notifications/read-all | Mark all as read |

**Unread count** is pushed via WebSocket on each new notification. The client renders a badge on the bell icon.

---

## 4. WebSocket Messaging Protocol

### 4.1 Connection Lifecycle

```
1. Client connects: io(WS_URL, { auth: { token: JWT } })

2. Server validates JWT:
   - Decode and verify RS256 signature
   - Extract user_id, practice_id (if applicable)
   - Reject expired/invalid tokens → disconnect with 'auth_error'

3. Server auto-subscribes client to channels:
   - user:{user_id}:notifications (always)
   - practice:{practice_id}:queue (if provider/admin)

4. Client subscribes to appointment channels on-demand:
   - appointment:{id}:messages (when viewing thread)
   - appointment:{id}:typing (when viewing thread)
   - appointment:{id}:video (when in video consultation)

5. On disconnect:
   - Server cleans up channel subscriptions
   - No data loss — messages are always persisted to DB first
```

### 4.2 Message Events

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `message:send` | Client → Server | `{ appointment_id, content }` | Client sends a message |
| `message:new` | Server → Client | `{ message }` | New message in subscribed thread |
| `message:read` | Client → Server | `{ message_id }` | Client marks message as read |
| `message:read_receipt` | Server → Client | `{ message_id, read_at }` | Read receipt for sender |
| `typing:start` | Client → Server | `{ appointment_id }` | User started typing |
| `typing:stop` | Client → Server | `{ appointment_id }` | User stopped typing |
| `typing:indicator` | Server → Client | `{ appointment_id, user_id }` | Other user is typing |
| `notification:new` | Server → Client | `{ notification }` | New in-app notification |
| `video:status` | Server → Client | `{ appointment_id, status }` | Video room status change |
| `video:participant_joined` | Server → Client | `{ appointment_id, user_id }` | Participant joined video |
| `video:participant_left` | Server → Client | `{ appointment_id, user_id }` | Participant left video |

### 4.3 Message Send Flow

```
onMessageSend(socket, { appointment_id, content }):
  user = socket.data.user  // From auth handshake

  // Validate: user is a participant in this appointment
  appointment = getAppointment(appointment_id)
  if user.id != appointment.patient_id
    AND user.id NOT IN getPracticeStaffIds(appointment.practice_id):
    throw UnauthorizedError

  // Validate: appointment is in a messageable state (BR-7)
  if appointment.status == 'CANCELLED':
    throw AppointmentCancelledError

  // Persist message
  message = INSERT INTO messages (
    practice_id = appointment.practice_id,
    appointment_id = appointment_id,
    sender_id = user.id,
    type = 'TEXT',
    content = sanitize(content)  // DOMPurify for Markdown
  )

  // Broadcast to thread subscribers
  io.to(`appointment:${appointment_id}:messages`).emit('message:new', { message })

  // If recipient is offline, queue email notification (5 min delay)
  recipientOnline = io.sockets.adapter.rooms.has(`user:${recipientId}:notifications`)
  if !recipientOnline:
    notificationQueue.add('sendUnreadMessageEmail', {
      message_id: message.id,
      recipient_id: recipientId
    }, { delay: 5 * 60 * 1000, jobId: `unread-msg-${message.id}` })
```

### 4.4 Typing Indicator

Typing indicators are ephemeral WebSocket events — never persisted:

```
onTypingStart(socket, { appointment_id }):
  socket.to(`appointment:${appointment_id}:typing`).emit('typing:indicator', {
    appointment_id,
    user_id: socket.data.user.id,
    typing: true
  })
  // Auto-expire after 5 seconds (client re-sends while still typing)
```

### 4.5 System Messages

System messages are auto-generated for appointment lifecycle events:

| Event | System Message Content |
|-------|----------------------|
| Appointment confirmed | "Appointment confirmed for {date} at {time}" |
| Appointment rescheduled | "Appointment rescheduled from {old_date} to {new_date}" |
| Video room ready | "Video room is ready. Click to join your consultation." |
| Intake form completed | "Intake form completed by {patient_name}" |

System messages are inserted with `type = 'SYSTEM'` and `sender_id = NULL` (the `messages.sender_id` column is nullable to support this).

---

## 5. Authentication & Authorization

### 5.1 JWT Token Architecture

| Token | Storage | TTL | Signing | Contents |
|-------|---------|-----|---------|----------|
| Access Token | In-memory (JS variable) | 15 minutes | RS256 | `{ sub: user_id, email, role, practice_id?, membership_role? }` |
| Refresh Token | httpOnly cookie | 7 days | RS256 | `{ sub: user_id, jti: token_id }` |

**Token flow:**

```
1. Login (POST /api/auth/login):
   - Verify email + password (bcrypt compare)
   - Generate access token (15 min)
   - Generate refresh token (7 days), store hash in DB
   - Set refresh token as httpOnly, Secure, SameSite=Strict cookie
   - Return access token in response body

2. API Request:
   - Client sends access token in Authorization: Bearer header
   - NestJS AuthGuard validates token, extracts user
   - If practice context needed: middleware sets RLS session variable

3. Token Refresh (POST /api/auth/refresh):
   - Read refresh token from httpOnly cookie
   - Verify signature and expiry
   - Check token hash exists in DB (not revoked)
   - Issue new access token + new refresh token (rotation)
   - Invalidate old refresh token hash

4. Logout:
   - Revoke refresh token (delete hash from DB)
   - Clear httpOnly cookie
   - Client discards access token from memory
```

### 5.2 RSA Key Management

RS256 signing requires an RSA key pair. The private key signs tokens; the public key verifies them.

**Key generation (one-time setup):**

```bash
# Generate 2048-bit RSA private key
openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:2048

# Extract public key
openssl rsa -in private.pem -pubout -out public.pem
```

**Environment variables:**

| Variable | Description | Format |
|----------|-------------|--------|
| `JWT_PRIVATE_KEY` | RSA private key for signing tokens | PEM-encoded string (with `\n` escaped as literal `\\n` in env) |
| `JWT_PUBLIC_KEY` | RSA public key for verifying tokens | PEM-encoded string (with `\n` escaped as literal `\\n` in env) |

**Loading in NestJS:**

```typescript
// config/jwt.config.ts
export const jwtConfig = {
  privateKey: process.env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n'),
  publicKey: process.env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n'),
  signOptions: { algorithm: 'RS256', expiresIn: '15m' },
};
```

**Key storage rules:**
- Keys are stored as **environment variables** in Railway (API service) and local `.env` files.
- Keys are **never committed** to version control. `.env` is in `.gitignore`.
- Each environment (local, preview, production) uses a **separate key pair**.
- The local development seed script auto-generates a key pair if `JWT_PRIVATE_KEY` is not set (convenience only — production always uses pre-generated keys).

**Key rotation:** No automated rotation in v1. Manual rotation procedure: generate new key pair → deploy with new keys → old access tokens expire naturally within 15 minutes → old refresh tokens are invalidated on next use (rotation policy from §5.1). If an immediate revocation is needed, the `refresh_tokens` table can be truncated to force all users to re-authenticate.

### 5.3 Google OAuth Flow

```
1. Client redirects to: GET /api/auth/google
   → Server redirects to Google OAuth consent screen

2. Google callback: GET /api/auth/google/callback?code=xxx
   → Server exchanges code for Google tokens
   → Server fetches Google profile (email, name, avatar)

3. Account resolution:
   a. If user exists with matching google_id → login
   b. If user exists with matching email → link google_id, login
   c. If no user exists → create user with google_id, email_verified = true, login

4. Issue JWT tokens (same as email/password login)
```

### 5.4 Role-Based Access Control (RBAC)

Access control is enforced at two levels:

**Platform Level** (from `users.role`):

| Role | Permissions |
|------|------------|
| `PLATFORM_ADMIN` | Full system access, all practices visible |
| `USER` | Standard user — permissions determined by practice membership |

**Practice Level** (from `tenant_memberships.role`):

| Role | Permissions |
|------|------------|
| `OWNER` | Full practice access: settings, billing, providers, services, appointments, analytics, Stripe Connect |
| `ADMIN` | Same as OWNER minus billing/Stripe Connect management |
| `PROVIDER` | Own schedule, own patients, own appointments, video consultations, messaging |

**Patient** (no tenant_membership):

| Context | Permissions |
|---------|------------|
| Booking page | Browse providers, services, available slots (public) |
| Booking flow | Create appointment, submit payment, complete intake form |
| Patient portal | View own appointments, messages, intake forms, payments across all practices |

### 5.5 NestJS Guard Implementation

```typescript
// Role guard decorator
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
@Patch('/practices/:id')
async updatePractice() { ... }

// Practice context middleware (runs before guards)
@Injectable()
export class PracticeContextMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const practiceId = req.params.id || req.user?.practice_id;
    if (practiceId) {
      // Set RLS session variable (transaction-scoped)
      await prisma.$executeRaw`
        SELECT set_config('app.current_practice', ${practiceId}, TRUE)
      `;
      // Set current user for patient-scoped RLS
      await prisma.$executeRaw`
        SELECT set_config('app.current_user', ${req.user.id}, TRUE)
      `;
    }
    next();
  }
}
```

### 5.6 Participant Authorization

For appointment-scoped endpoints (video, messages, intake), the `ParticipantGuard` verifies:

```typescript
@Injectable()
export class ParticipantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    const appointmentId = context.switchToHttp().getRequest().params.id;
    const appointment = this.appointmentService.findById(appointmentId);

    // Patient access
    if (user.id === appointment.patient_id) return true;

    // Practice staff access (provider, admin, owner)
    const membership = this.membershipService.findByUserAndPractice(
      user.id, appointment.practice_id
    );
    if (membership && membership.is_active) return true;

    return false;
  }
}
```

### 5.7 Provider Invitation Flow

Provider invitations bridge the gap between practice admin actions and provider account linking. The flow supports both existing and new users.

```
1. Practice OWNER/ADMIN sends invitation:
   POST /api/practices/:id/invitations { email, role }
   → Generate random token (32 bytes, hex-encoded)
   → Store SHA-256(token) in invitation_tokens table
   → Send provider.invitation email with tokenized link:
     https://medconnect.app/invitations/accept?token=xxx

2. Invitee clicks link:
   GET /invitations/accept?token=xxx (frontend route)
   → Frontend reads token from URL
   → Calls GET /api/invitations/verify?token=xxx to validate
   → Server: hash token, lookup in invitation_tokens
   → If expired (7 days from creation, per invitation_tokens.expires_at)/revoked/accepted → error
   → If valid → return { practice_name, role, email }

3a. Invitee is already registered (logged in or logs in):
   POST /api/invitations/accept { token }
   → Server verifies token (same as step 2)
   → Creates tenant_membership (practice_id, user_id, role)
   → Creates provider_profile (practice_id, user_id, defaults)
   → Sets invitation_tokens.accepted_at = now()
   → Emits 'provider.added' event → audit log

3b. Invitee is not registered:
   → Frontend redirects to /register?invitation=xxx
   → After registration + email verification, invitation token is auto-accepted
   → Same side effects as 3a
```

**Guard:** Invitation acceptance verifies `invitation.email == user.email` (case-insensitive). A user cannot accept an invitation addressed to a different email.

---

## 6. Audit Logging

### 6.1 Audited Actions

Every security-relevant and data-access action is logged to the append-only `audit_logs` table:

| Action | Resource Type | When |
|--------|--------------|------|
| `USER_REGISTERED` | user | User creates account |
| `USER_LOGGED_IN` | user | Successful login |
| `USER_LOGIN_FAILED` | user | Failed login attempt |
| `PASSWORD_RESET_REQUESTED` | user | Password reset email sent |
| `PASSWORD_CHANGED` | user | Password successfully changed |
| `PRACTICE_CREATED` | practice | New practice registered |
| `PRACTICE_UPDATED` | practice | Practice settings changed |
| `PROVIDER_ADDED` | provider_profile | Provider invited/added |
| `PROVIDER_REMOVED` | provider_profile | Provider deactivated |
| `APPOINTMENT_CREATED` | appointment | Appointment booked |
| `APPOINTMENT_CONFIRMED` | appointment | Appointment confirmed |
| `APPOINTMENT_CANCELLED` | appointment | Appointment cancelled |
| `APPOINTMENT_RESCHEDULED` | appointment | Appointment rescheduled |
| `VIDEO_ROOM_CREATED` | video_room | Twilio room created |
| `VIDEO_ROOM_JOINED` | video_room | Participant joined video |
| `VIDEO_ROOM_ENDED` | video_room | Video session ended |
| `INTAKE_VIEWED` | intake_submission | Provider viewed patient intake data |
| `INTAKE_SUBMITTED` | intake_submission | Patient submitted intake form |
| `PAYMENT_CREATED` | payment_record | Payment intent created |
| `PAYMENT_SUCCEEDED` | payment_record | Payment successful |
| `PAYMENT_REFUNDED` | payment_record | Refund processed |
| `MESSAGE_SENT` | message | Message sent in thread |
| `STRIPE_CONNECTED` | practice | Stripe Connect onboarded |
| `CALENDAR_CONNECTED` | calendar_connection | Calendar OAuth completed |
| `CALENDAR_DISCONNECTED` | calendar_connection | Calendar connection removed |
| `PATIENT_DATA_EXPORT` | user | Patient requested data export (FR-PP-9) |

### 6.2 Audit Log Implementation

```typescript
@Injectable()
export class AuditService {
  async log(params: {
    userId?: string;
    practiceId?: string;
    action: AuditAction;
    resourceType: string;
    resourceId: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
  }) {
    // Append-only insert — no UPDATE or DELETE allowed
    await prisma.auditLog.create({
      data: {
        user_id: params.userId,
        practice_id: params.practiceId,
        action: params.action,
        resource_type: params.resourceType,
        resource_id: params.resourceId,
        metadata: params.metadata,  // { old_values, new_values, user_agent }
        ip_address: params.ipAddress,
      }
    });
  }
}
```

### 6.3 Audit Log Integrity

- **Append-only:** No UPDATE or DELETE operations on `audit_logs`. Enforced by PostgreSQL `BEFORE UPDATE OR DELETE` trigger that raises an exception.
- **Retention:** Logs retained indefinitely in demo mode. Production path: configurable retention per data category (see FR-CMP-9).
- **Indexing:** Indexed on `(resource_type, resource_id)` for per-resource history and `(user_id, created_at)` for per-user activity.
- **HIPAA relevance:** In production mode, all PHI access (intake form views, patient record access) would be logged here. The Compliance Roadmap page (FR-CMP-8) documents this architecture.

---

## 7. Calendar Sync Protocol

### 7.1 Outbound Sync (MedConnect → External Calendar)

When an appointment is confirmed, rescheduled, or cancelled, a `calendarEventPush` BullMQ job is enqueued:

```
onAppointmentConfirmed(appointment):
  connections = SELECT * FROM calendar_connections
    WHERE provider_profile_id = appointment.provider_profile_id
      AND status = 'ACTIVE'

  for connection in connections:
    calendarQueue.add('calendarEventPush', {
      event_type: 'CREATE',
      connection_id: connection.id,
      appointment_id: appointment.id
    })

onAppointmentRescheduled(appointment, original_start, original_end):
  // Same pattern, event_type: 'UPDATE'

onAppointmentCancelled(appointment):
  // Same pattern, event_type: 'DELETE'
```

**Event push implementation (Google Calendar):**

```
processCalendarEventPush(job):
  connection = getCalendarConnection(job.data.connection_id)
  appointment = getAppointment(job.data.appointment_id)
  patient = getUser(appointment.patient_id)
  service = getService(appointment.service_id)

  // Ensure token is valid
  if connection.token_expires_at < now():
    connection = await refreshToken(connection)

  oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({
    access_token: decrypt(connection.access_token),
    refresh_token: decrypt(connection.refresh_token)
  })
  calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  switch job.data.event_type:
    'CREATE':
      event = await calendar.events.insert({
        calendarId: connection.calendar_id,
        resource: {
          summary: `${service.name} with ${patient.name}`,
          start: { dateTime: appointment.start_time },
          end: { dateTime: appointment.end_time },
          description: buildEventDescription(appointment, service),
          location: appointment.consultation_type == 'VIDEO'
            ? VIDEO_JOIN_URL + '/' + appointment.id
            : practice.address
        }
      })
      INSERT INTO calendar_events (
        practice_id, calendar_connection_id, appointment_id,
        external_event_id = event.data.id,
        direction = 'OUTBOUND',
        title = event.data.summary,
        start_time = appointment.start_time,
        end_time = appointment.end_time
      )

    'UPDATE':
      calendarEvent = SELECT * FROM calendar_events
        WHERE appointment_id = appointment.id AND direction = 'OUTBOUND'
      await calendar.events.update({
        calendarId: connection.calendar_id,
        eventId: calendarEvent.external_event_id,
        resource: { ... updated fields ... }
      })

    'DELETE':
      calendarEvent = SELECT * FROM calendar_events
        WHERE appointment_id = appointment.id AND direction = 'OUTBOUND'
      await calendar.events.delete({
        calendarId: connection.calendar_id,
        eventId: calendarEvent.external_event_id
      })
      DELETE FROM calendar_events WHERE id = calendarEvent.id
```

### 7.2 Inbound Sync (External Calendar → MedConnect)

The `calendarInboundSync` job runs every 15 minutes for all active calendar connections:

```
processCalendarInboundSync(connection_id):
  connection = getCalendarConnection(connection_id)

  // Fetch events from external calendar (next 90 days)
  events = await calendar.events.list({
    calendarId: connection.calendar_id,
    timeMin: now().toISO(),
    timeMax: (now() + 90 days).toISO(),
    singleEvents: true
  })

  // Upsert INBOUND calendar_events
  for event in events:
    // Skip events that originated from MedConnect (OUTBOUND events)
    if event.extendedProperties?.private?.medconnect_appointment_id:
      continue

    UPSERT INTO calendar_events (
      practice_id = connection.practice_id,
      calendar_connection_id = connection.id,
      external_event_id = event.id,
      direction = 'INBOUND',
      appointment_id = NULL,  // Not a MedConnect appointment
      title = event.summary,
      start_time = event.start.dateTime,
      end_time = event.end.dateTime
    ) ON CONFLICT (calendar_connection_id, external_event_id) DO UPDATE SET
      start_time = EXCLUDED.start_time,
      end_time = EXCLUDED.end_time,
      title = EXCLUDED.title

  // Remove INBOUND events that no longer exist in external calendar
  external_ids = events.map(e => e.id)
  DELETE FROM calendar_events
    WHERE calendar_connection_id = connection.id
      AND direction = 'INBOUND'
      AND external_event_id NOT IN (external_ids)

  UPDATE calendar_connections SET last_synced_at = now()
```

INBOUND events block provider availability in the slot calculation engine (SRS-3 §4, Layer 4).

### 7.3 Token Refresh

The `calendarTokenRefresh` job runs hourly:

```
processCalendarTokenRefresh():
  expiring = SELECT * FROM calendar_connections
    WHERE status = 'ACTIVE'
      AND token_expires_at < now() + INTERVAL '1 hour'

  for connection in expiring:
    try:
      // Google OAuth token refresh
      oauth2Client.setCredentials({
        refresh_token: decrypt(connection.refresh_token)
      })
      tokens = await oauth2Client.refreshAccessToken()

      UPDATE calendar_connections SET
        access_token = encrypt(tokens.access_token),
        token_expires_at = tokens.expiry_date
    catch error:
      UPDATE calendar_connections SET status = 'DISCONNECTED'
      createNotification('CALENDAR_DISCONNECTED', provider.user_id, ...)
```

---

## 8. Security Controls

### 8.1 Input Validation

All API inputs are validated using Zod schemas shared between client and server (via the `packages/shared` workspace package):

```typescript
// packages/shared/src/schemas/appointment.schema.ts
export const CreateAppointmentSchema = z.object({
  practice_id: z.string().uuid(),
  provider_profile_id: z.string().uuid(),
  service_id: z.string().uuid(),
  start_time: z.string().datetime(),
  consultation_type: z.enum(['VIDEO', 'IN_PERSON', 'PHONE']).optional(),
  reservation_session_id: z.string(),
  patient_name: z.string().min(1).max(255).optional(),
  patient_email: z.string().email().optional(),
  patient_phone: z.string().max(20).optional(),
  stripe_payment_method_id: z.string().optional(),
  data_processing_consent: z.literal(true)  // Required: patient must consent to data processing
});

// NestJS controller uses Zod validation pipe
@Post('/appointments')
async create(@Body(new ZodValidationPipe(CreateAppointmentSchema)) dto) { ... }
```

Invalid payloads are rejected at the controller level with HTTP 422 and structured error details.

### 8.2 Rate Limiting

| Endpoint Category | Limit | Window | Key |
|-------------------|-------|--------|-----|
| Public endpoints (auth, booking page) | 100 req | 1 minute | IP address |
| Authenticated API | 500 req | 1 minute | User ID |
| Login / Register | 10 req | 1 minute | IP address |
| Password reset | 5 req | 15 minutes | Email address |
| Webhook endpoints | 1000 req | 1 minute | IP address (Stripe/Twilio IPs) |

Rate limiting is implemented via `@nestjs/throttler` with Redis backing for distributed state.

### 8.3 CORS Configuration

```typescript
app.enableCors({
  origin: [
    process.env.WEB_URL,          // Vercel frontend
    'http://localhost:3000',       // Local development
  ],
  credentials: true,               // Allow httpOnly cookies
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type']
});
```

Production CORS is strict — only the Vercel deployment URL is allowed. No wildcard origins.

### 8.4 Content Security

| Protection | Implementation |
|-----------|----------------|
| XSS | React's built-in escaping + DOMPurify for Markdown message content |
| SQL Injection | Prisma parameterized queries; no raw SQL without explicit `$queryRaw` review |
| CSRF | SameSite=Strict cookies; no cookie-based auth for API (JWT in header) |
| Clickjacking | `X-Frame-Options: DENY` header |
| Content sniffing | `X-Content-Type-Options: nosniff` header |
| HSTS | `Strict-Transport-Security: max-age=31536000; includeSubDomains` |

### 8.5 Sensitive Data Handling

| Data | Protection |
|------|-----------|
| Passwords | bcrypt, minimum 12 rounds |
| Refresh tokens | Stored as SHA-256 hash in DB, not plaintext |
| Stripe API keys | Environment variables only; never in code or logs |
| Calendar OAuth tokens | AES-256-GCM encrypted at rest in DB (`access_token`, `refresh_token` columns) |
| Patient intake data | JSONB in RLS-protected table; audit-logged on access |
| Webhook secrets | Environment variables; verified on every incoming webhook |

### 8.6 Webhook Verification

**Stripe:**
```typescript
const event = stripe.webhooks.constructEvent(
  rawBody,
  request.headers['stripe-signature'],
  process.env.STRIPE_WEBHOOK_SECRET
);
```

**Twilio:**
```typescript
const isValid = twilio.validateRequest(
  process.env.TWILIO_AUTH_TOKEN,
  request.headers['x-twilio-signature'],
  webhookUrl,
  request.body
);
```

Unverified webhooks return HTTP 400 (Stripe) or HTTP 403 (Twilio) and are logged to Sentry.

### 8.7 PHI Prevention in Payment Metadata

Stripe payment metadata must **never** contain Protected Health Information. Even in demo mode with synthetic data, enforcing this boundary demonstrates HIPAA-aware architecture and prevents accidental PHI exposure if the platform transitions to production.

**Allowed metadata fields:**

| Field | Example | Rationale |
|-------|---------|-----------|
| `appointment_id` | `"cm3abc..."` | Opaque UUID — requires DB access to resolve |
| `practice_id` | `"cm3def..."` | Opaque UUID — identifies tenant for reconciliation |
| `reason` | `"appointment_cancellation"` | Generic enum value for refund reason |

**Prohibited metadata content:**

| Prohibited | Risk |
|-----------|------|
| Patient name, email, phone | Direct PII exposure in Stripe dashboard and logs |
| Service name or description | May reveal treatment type (e.g., "Psychiatric Evaluation") |
| Diagnosis codes (ICD-10) | Direct PHI |
| Provider name + specialty | Combined with payment amount, could identify treatment |
| `patient_id`, `service_id` | Joinable back to PHI via Stripe dashboard + DB correlation |

**Enforcement:**

```typescript
// PaymentService — createPaymentIntent()
// Metadata allowlist enforced at the service layer
const ALLOWED_METADATA_KEYS = ['appointment_id', 'practice_id', 'reason'] as const;

function sanitizeStripeMetadata(
  input: Record<string, string>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).filter(([key]) =>
      (ALLOWED_METADATA_KEYS as readonly string[]).includes(key)
    )
  );
}
```

A unit test must verify that `createPaymentIntent` and `createRefund` only pass allowed metadata keys. Any attempt to add new metadata fields requires review against this policy.

**Cross-references:** SRS-3 §8.2 (payment intent creation), SRS-3 §8.6 (refund processing), SRS-1 §13.3 NFR-SEC-10 (webhook verification).

---

## 9. HIPAA Compliance Architecture

### 9.1 Demo Mode Boundary

MedConnect in demo mode operates outside HIPAA requirements:
- All patient data is synthetic (generated by Synthea)
- No real PHI exists in the system
- No BAA is required with any vendor
- Every page displays: "Demo application — synthetic data only. Not for clinical use."

### 9.2 Production Readiness Checklist (Compliance Roadmap Page)

The in-app Compliance Roadmap page (`/compliance-roadmap`) documents the following:

#### Administrative Safeguards
- [ ] Designated Security Officer
- [ ] Workforce training program
- [ ] Risk assessment (annual)
- [ ] Incident response procedures
- [ ] Access management policies
- [ ] Sanctions policy for violations

#### Physical Safeguards
- [ ] Facility access controls (hosting provider responsibility with BAA)
- [ ] Workstation security policies
- [ ] Device and media disposal procedures

#### Technical Safeguards (Already Implemented)
- [x] Role-based access control (RBAC via tenant_memberships)
- [x] Audit logging (all PHI access logged)
- [x] Data integrity controls (PostgreSQL ACID, Prisma transactions)
- [x] TLS 1.3 for all transmission
- [x] DTLS-SRTP for video (Twilio managed)
- [x] AES-256 encryption at rest (Railway managed PostgreSQL)
- [x] bcrypt password hashing (12+ rounds)
- [x] Session management (JWT with short TTL + rotation)

#### Technical Safeguards (Production Path)
- [ ] HIPAA-eligible hosting (Aptible or AWS with BAA)
- [ ] HIPAA-eligible database (AWS RDS or Aptible PostgreSQL)
- [ ] HIPAA-eligible email provider (Resend with BAA or Postmark)
- [ ] PHI encryption at application layer (beyond database-level)
- [ ] Automatic session timeout (15 min inactivity)
- [ ] Emergency access procedure

#### Business Associate Agreements Required
| Vendor | Service | BAA Required |
|--------|---------|-------------|
| Twilio | Video, SMS | Yes — Twilio offers HIPAA-eligible plan |
| Hosting (Aptible/AWS) | API, Database, Redis | Yes |
| Resend / Email provider | Transactional email | Yes (if emails contain PHI) |
| Stripe | Payment processing | Not required (PCI DSS, not HIPAA) |
| Cloudflare | CDN, DNS | Not required (no PHI transits CDN) |
| Sentry | Error tracking | Yes (if error payloads may contain PHI) |

#### Infrastructure Migration Path
```
Current (Demo):
  Railway (API + PostgreSQL + Redis) + Vercel (Next.js)
  → No BAA, no HIPAA controls beyond what's built-in

Production Path:
  Aptible (API + PostgreSQL + Redis) + Vercel (Next.js)
  → Aptible provides: BAA, HIPAA-eligible hosting, managed SSL,
    audit-ready logging, automatic vulnerability scanning
  OR
  AWS (ECS + RDS PostgreSQL + ElastiCache) + Vercel (Next.js)
  → AWS provides: BAA, HIPAA-eligible services, VPC isolation,
    CloudTrail audit logging, KMS encryption
```

### 9.3 Data Retention (Production Path)

| Data Category | Retention | Justification |
|---------------|-----------|---------------|
| Appointment records | 7 years | Medical record retention requirements |
| Audit logs | 7 years | HIPAA audit trail requirement |
| Video room metadata | 7 years | Consultation record |
| Video recordings (if enabled) | 3 years (configurable) | Practice policy |
| Intake form data | 7 years | Medical record |
| Messages | 7 years | Communication record |
| Payment records | 7 years | Financial record keeping |
| Consent records | Indefinite | Legal requirement |
| User accounts | Until deletion request + 30 day grace | GDPR right to erasure |

---

## 10. Consent Collection

### 10.1 Consent Types

| Type | When Collected | Required? |
|------|----------------|-----------|
| `TERMS_OF_SERVICE` | Registration | Yes |
| `PRIVACY_POLICY` | Registration | Yes |
| `DATA_PROCESSING` | First booking | Yes |
| `SMS_OPT_IN` | Patient portal settings | No (opt-in) |
| `VIDEO_RECORDING` | Before recording starts (if practice enables) | Yes (if recording) |

### 10.2 Consent Record

Each consent action creates an immutable record:

```typescript
INSERT INTO consent_records (
  user_id,
  type = 'TERMS_OF_SERVICE',
  version = '1.0',
  consented_at = now(),
  ip_address = request.ip,
  user_agent = request.headers['user-agent']
)
```

Consent can be revoked (`revoked_at` set), but the original consent record remains for audit purposes.

### 10.3 Patient Data Export (GDPR Article 20 Readiness)

Patients can request a machine-readable export of all their personal data. This implements GDPR Article 20 (right to data portability) readiness. Even in demo mode with synthetic data, the mechanism demonstrates compliance-aware architecture.

**Endpoint:** `POST /api/patients/me/data-export`

**Authentication:** Patient JWT required. Export contains only the requesting user's data.

**Response:** HTTP 202 Accepted — export is asynchronous.

```json
{
  "export_id": "uuid",
  "status": "PROCESSING",
  "estimated_seconds": 30
}
```

**Completion:** BullMQ job generates the export, uploads to Cloudflare R2 with a 24-hour signed URL, and sends a download link via email (`patient.data-export-ready` template).

**Export format:** JSON with the following top-level sections:

```typescript
interface PatientDataExport {
  exported_at: string;               // ISO 8601 timestamp
  format_version: '1.0';

  profile: {
    name: string;
    email: string;
    phone: string | null;
    date_of_birth: string | null;
    avatar_url: string | null;
    locale: string;
    created_at: string;
  };

  appointments: Array<{
    id: string;
    practice_name: string;
    provider_name: string;
    service_name: string;
    start_time: string;
    end_time: string;
    status: string;
    consultation_type: string;
    notes_shared_with_patient: string | null;
  }>;

  intake_submissions: Array<{
    appointment_id: string;
    form_template_name: string;
    submitted_at: string;
    responses: Record<string, unknown>;  // JSONB form data
  }>;

  payments: Array<{
    appointment_id: string;
    amount_cents: number;
    currency: string;
    status: string;
    paid_at: string | null;
    stripe_receipt_url: string | null;  // Fetched from Stripe API via stripe_charge_id at export time — not stored in DB
  }>;

  messages: Array<{
    appointment_id: string;
    sent_at: string;
    sender: 'patient' | 'provider' | 'system';
    content: string;
  }>;

  consent_records: Array<{
    type: string;
    version: string;
    consented_at: string;
    revoked_at: string | null;
  }>;
}
```

**Rate limiting:** One export request per patient per 24 hours. Subsequent requests within the window return HTTP 429 with `Retry-After` header.

**Audit:** Export requests are logged via `AuditService` (action: `PATIENT_DATA_EXPORT`).

**Cross-references:** PRD FR-PP-9, SRS-2 (data model for all exported entities).

---

## 11. File Upload & Object Storage

### 11.1 Storage Architecture

All user-uploaded files are stored in **Cloudflare R2** (S3-compatible). Uploads use **presigned URLs** — the client uploads directly to R2, bypassing the API server for bandwidth efficiency.

**Bucket:** Single bucket `medconnect-uploads` with key-path-based organization.

**Key path convention:**

```
{practice_id}/avatars/{user_id}/{timestamp}.{ext}
{practice_id}/logos/{practice_id}/{timestamp}.{ext}
{practice_id}/covers/{practice_id}/{timestamp}.{ext}
exports/{user_id}/{export_id}.json
```

Practice-scoped paths enable future per-tenant lifecycle policies. The `exports/` prefix is global (patient data exports are cross-practice).

### 11.2 Upload Flow

```
Client                          API                         Cloudflare R2
  │                              │                              │
  ├─ POST /api/uploads/presign ─►│                              │
  │  { purpose, content_type,    │                              │
  │    file_name }               │                              │
  │                              │── validate request ──────────│
  │                              │── generate presigned PUT ───►│
  │◄─ { upload_url, key,        │                              │
  │     public_url, expires_in } │                              │
  │                              │                              │
  ├─ PUT upload_url ────────────────────────────────────────────►│
  │  (binary file body)          │                              │
  │◄─ 200 OK ──────────────────────────────────────────────────│
  │                              │                              │
  ├─ PATCH /api/me              ─►│                              │
  │  { avatar_url: public_url }  │── validate URL belongs ─────│
  │                              │   to R2 bucket               │
  │◄─ 200 OK                     │                              │
```

**Steps:**

1. Client calls `POST /api/uploads/presign` with file metadata and `purpose` field.
2. API validates the request (auth, file type, size declaration, purpose-specific rules).
3. API generates a presigned PUT URL (expires in 10 minutes) and returns it with the final public URL.
4. Client uploads the file directly to R2 via the presigned URL.
5. Client sends the resulting `public_url` in the relevant entity update (e.g., `PATCH /api/me`, `PATCH /api/practices/:id`).
6. API validates that the URL matches the expected R2 bucket domain before persisting.

### 11.3 Upload Purposes & Validation Rules

| Purpose | Max Size | Allowed MIME Types | Max Dimensions | Used By |
|---------|----------|--------------------|----------------|---------|
| `avatar` | 2 MB | `image/jpeg`, `image/png`, `image/webp` | 1024×1024 px | `PATCH /api/me` (FR-PP-7), `PATCH /api/providers/:id` |
| `practice_logo` | 1 MB | `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml` | 512×512 px | `PATCH /api/practices/:id` (FR-ADM-4) |
| `practice_cover` | 5 MB | `image/jpeg`, `image/png`, `image/webp` | 1920×600 px | `PATCH /api/practices/:id` (FR-ADM-4) |

**Dimension validation** is declared by the client in the presign request (`width`, `height`). The API rejects requests exceeding the maximum dimensions. The actual image dimensions are not verified server-side post-upload (no server-side image processing in v1).

**SVG restriction:** Only allowed for `practice_logo` purpose. SVG files are served with `Content-Disposition: attachment` and `Content-Type: image/svg+xml` headers to mitigate XSS risk.

### 11.4 Presign Endpoint

```
POST /api/uploads/presign
```

**Auth:** Authenticated user. Practice-scoped purposes (`practice_logo`, `practice_cover`) require OWNER or ADMIN role.

**Request body:**

```typescript
interface PresignRequest {
  purpose: 'avatar' | 'practice_logo' | 'practice_cover';
  content_type: string;   // MIME type
  file_name: string;      // Original filename (used for extension extraction only)
  file_size: number;      // Declared file size in bytes
  width?: number;         // Declared image width in pixels
  height?: number;        // Declared image height in pixels
  practice_id?: string;   // Required for practice_logo and practice_cover
}
```

**Response:**

```typescript
interface PresignResponse {
  upload_url: string;     // Presigned PUT URL (expires in 10 minutes)
  public_url: string;     // Final public URL after upload completes
  key: string;            // R2 object key
  expires_in: number;     // Seconds until presigned URL expires (600)
}
```

**Validation errors:** 400 with specific error codes: `INVALID_PURPOSE`, `INVALID_CONTENT_TYPE`, `FILE_TOO_LARGE`, `DIMENSIONS_EXCEEDED`, `PRACTICE_NOT_FOUND`, `INSUFFICIENT_ROLE`.

### 11.5 URL Validation on Entity Update

When a client sends an avatar, logo, or cover photo URL in a PATCH request, the API validates:

1. URL matches the configured R2 public URL domain (`R2_PUBLIC_URL` env var prefix).
2. URL key path matches the expected purpose prefix.
3. URL is syntactically valid and does not contain path traversal sequences.

URLs that fail validation are rejected with 400 `INVALID_FILE_URL`.

### 11.6 Public URL Delivery

R2 objects are served via the **Cloudflare R2 public bucket URL** or a custom domain configured as a CNAME to the R2 bucket. No CDN caching layer in v1 — Cloudflare's default R2 edge caching is sufficient.

**URL format:** `https://{R2_PUBLIC_DOMAIN}/{key}`

### 11.7 Old File Cleanup

When an entity update replaces an existing file URL (e.g., new avatar replaces old avatar), the API enqueues a `deleteOrphanedUpload` job (BullMQ, `uploads` queue) with the old key. The job deletes the old object from R2 after a 1-hour delay (grace period for CDN cache invalidation and potential rollback).

### 11.8 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `R2_ACCOUNT_ID` | Cloudflare account ID | `abc123def456` |
| `R2_ACCESS_KEY_ID` | R2 API token access key | `r2-access-key` |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret key | `r2-secret-key` |
| `R2_BUCKET_NAME` | Bucket name | `medconnect-uploads` |
| `R2_PUBLIC_URL` | Public URL prefix for uploaded files | `https://uploads.medconnect.app` |

### 11.9 Cross-References

- **PRD:** FR-ONB-3 (logo upload), FR-PROV-1 (avatar URL), FR-PP-7 (avatar edit), FR-ADM-4 (practice branding), FR-MSG-7 (message attachments — Could priority, deferred)
- **SRS-2:** `users.avatar_url`, `practices.logo_url`, `practices.cover_photo_url` columns; `POST /api/uploads/presign` endpoint
- **SRS-3:** `deleteOrphanedUpload` BullMQ job (§9.1); `generatePatientDataExport` uses R2 for export file storage

---

## Cross-References

- **SRS-1 (Architecture):** WebSocket architecture (§12), multi-tenancy RLS (§7), NFR security requirements (§13.3), monitoring (§11).
- **SRS-2 (Data Model):** notifications, appointment_reminders, messages, audit_logs, consent_records, calendar_connections, calendar_events table schemas.
- **SRS-3 (Booking, Video & Payments):** Appointment state machine triggers for notifications, video room lifecycle, payment webhooks, BullMQ job definitions.
- **PRD:** FR-AUTH (authentication), FR-MSG (messaging), FR-NOT (notifications), FR-CAL (calendar), FR-CMP (compliance roadmap).
- **BRD:** BR-7 (messaging rules), BR-8 (synthetic data), BR-9 (HIPAA compliance boundary), BR-10 (reminder rules).

---

**Company:** SJD Labs, LLC | **Founder:** Stephen Deslate
