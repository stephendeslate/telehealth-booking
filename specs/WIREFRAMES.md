# MedConnect — UI Wireframes & Layout Specifications

**Author:** SJD Labs, LLC
**Document:** Wireframes
**Date:** 2026-03-19

---

## 1. Global Layout

### 1.1 Authenticated Layout (Patient Portal, Provider Dashboard, Admin)

```
+------------------------------------------------------------------+
| [!] Demo application - synthetic data only. Not for clinical use. |
+------+-----------------------------------------------------------+
|      |  [Logo] MedConnect          [Bell 3] [Avatar v]           |
| SIDE |-----------------------------------------------------------+
| BAR  |                                                           |
|      |                    MAIN CONTENT                           |
| nav  |                                                           |
| items|                                                           |
|      |                                                           |
|      |                                                           |
+------+-----------------------------------------------------------+
```

- **Demo banner**: Full-width, top of viewport, not dismissible. Yellow/amber background.
- **Sidebar**: Collapsible on mobile (hamburger menu). Fixed on desktop (240px).
- **Top bar**: Logo left, notification bell + user avatar/dropdown right.
- **Main content**: Scrollable area. Max-width 1280px centered on wide screens.

### 1.2 Public Layout (Booking Page, Auth Pages, Compliance Roadmap)

```
+------------------------------------------------------------------+
| [!] Demo application - synthetic data only. Not for clinical use. |
+------------------------------------------------------------------+
| [Practice Logo]  Practice Name              [Login] [Sign Up]    |
+------------------------------------------------------------------+
|                                                                  |
|                       MAIN CONTENT                               |
|                    (centered, max-width)                         |
|                                                                  |
+------------------------------------------------------------------+
|                         Footer                                   |
+------------------------------------------------------------------+
```

- No sidebar. Top nav only.
- Practice branding (logo, `brand_color`) applied via CSS custom properties.

---

## 2. Authentication Pages

### 2.1 Login

```
+----------------------------------+
|         [MedConnect Logo]        |
|                                  |
|     Welcome back                 |
|     Sign in to your account      |
|                                  |
|     Email                        |
|     [________________________]   |
|                                  |
|     Password                     |
|     [________________________]   |
|                                  |
|     [Forgot password?]           |
|                                  |
|     [     Sign In            ]   |
|                                  |
|     ─── or ───                   |
|                                  |
|     [G  Continue with Google ]   |
|                                  |
|     Don't have an account?       |
|     [Sign up]                    |
+----------------------------------+
```

Centered card, max-width 400px. Same pattern for Register (adds name, confirm password fields).

### 2.2 Register

```
+----------------------------------+
|         [MedConnect Logo]        |
|                                  |
|     Create your account          |
|                                  |
|     Full Name                    |
|     [________________________]   |
|                                  |
|     Email                        |
|     [________________________]   |
|                                  |
|     Password                     |
|     [________________________]   |
|     8+ chars, 1 upper, 1 number  |
|                                  |
|     Confirm Password             |
|     [________________________]   |
|                                  |
|     [ ] I agree to the Terms     |
|         of Service and           |
|         Privacy Policy           |
|                                  |
|     [     Create Account     ]   |
|                                  |
|     ─── or ───                   |
|                                  |
|     [G  Continue with Google ]   |
|                                  |
|     Already have an account?     |
|     [Sign in]                    |
+----------------------------------+
```

---

## 3. Booking Flow (Public — `/book/{slug}`)

Multi-step wizard with progress indicator. Each step is a full card. Back button on all steps except step 1.

### 3.1 Step Indicator

```
  (1)───(2)───(3)───(4)───(5)───(6)
Provider Service  Time  Intake  Pay  Confirm
  [active steps filled, future steps outlined]
```

Steps 4 (Intake) and 5 (Pay) are conditional — skipped if not configured.

### 3.2 Step 1: Provider Selection

```
+------------------------------------------------------------------+
|  [Practice Logo]  Practice Name                                  |
|------------------------------------------------------------------|
|  (1)───(2)───(3)───(4)───(5)───(6)                              |
|  Choose a Provider                                                |
|                                                                  |
|  [Search by name or specialty_________]  [Filter: Specialty v]   |
|                                                                  |
|  +-----------------------------+  +-----------------------------+|
|  | [Avatar]                    |  | [Avatar]                    ||
|  | Dr. Sarah Johnson           |  | Dr. Patel                   ||
|  | Therapist, LCSW             |  | Primary Care, MD            ||
|  | ★★★★★  Mental Health        |  | ★★★★☆  Family Medicine      ||
|  |                             |  |                             ||
|  | Next available: Tomorrow    |  | Next available: Mar 22      ||
|  |         2:00 PM             |  |         9:30 AM             ||
|  |                             |  |                             ||
|  | [    Select Provider    ]   |  | [    Select Provider    ]   ||
|  +-----------------------------+  +-----------------------------+|
|                                                                  |
|  +-----------------------------+  +-----------------------------+|
|  | [Avatar]                    |  | [Avatar]                    ||
|  | Dr. Kim                     |  | Dr. Rivera                  ||
|  | ...                         |  | ...                         ||
|  +-----------------------------+  +-----------------------------+|
+------------------------------------------------------------------+
```

Cards in a 2-column grid (1-column on mobile). Each card shows: avatar, name, credentials, specialty tags, next available slot.

### 3.3 Step 2: Service Selection

```
+------------------------------------------------------------------+
|  [< Back]                                                        |
|  (1)───(2)───(3)───(4)───(5)───(6)                              |
|  Select a Service         Dr. Sarah Johnson                      |
|                                                                  |
|  +------------------------------------------------------------+ |
|  | Initial Consultation                              VIDEO     | |
|  | 50 minutes                                        $150.00   | |
|  | Comprehensive first visit with full intake review           | |
|  | [   Select   ]                                              | |
|  +------------------------------------------------------------+ |
|                                                                  |
|  +------------------------------------------------------------+ |
|  | Follow-Up Session                                 VIDEO     | |
|  | 30 minutes                                         $75.00   | |
|  | Ongoing therapy session                                     | |
|  | [   Select   ]                                              | |
|  +------------------------------------------------------------+ |
|                                                                  |
|  +------------------------------------------------------------+ |
|  | Group Therapy Session                             VIDEO     | |
|  | 60 minutes                                         $50.00   | |
|  | Group session (max 6 participants)                          | |
|  | [   Select   ]                                              | |
|  +------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

Stacked list. Each card: service name, consultation type badge, duration, price, description.

### 3.4 Step 3: Date & Time Selection

```
+------------------------------------------------------------------+
|  [< Back]                                                        |
|  (1)───(2)───(3)───(4)───(5)───(6)                              |
|  Choose a Date & Time                                            |
|                                                                  |
|  Dr. Sarah Johnson · Follow-Up Session · 30 min · $75           |
|                                                                  |
|  +---------------------------+  +-------------------------------+|
|  |     March 2026            |  |  Available Times              ||
|  | Su Mo Tu We Th Fr Sa      |  |  Thursday, March 19           ||
|  |                    1       |  |                               ||
|  |  2  3  4  5  6  7  8      |  |  Morning                      ||
|  |  9 10 11 12 13 14 15      |  |  [ 9:00 ] [ 9:30 ] [10:00 ]  ||
|  | 16 17 18 [19] 20 21 22    |  |  [10:30 ] [11:00 ] [11:30 ]  ||
|  | 23 24 25 26 27 28 29      |  |                               ||
|  | 30 31                     |  |  Afternoon                    ||
|  |                           |  |  [ 1:00 ] [ 1:30 ] [ 2:00 ]  ||
|  +---------------------------+  |  [ 2:30 ] [ 3:00 ] [ 3:30 ]  ||
|                                 |  [ 4:00 ] [ 4:30 ]            ||
|  Timezone: America/New_York     |                               ||
|                                 |  [Selected: 2:00 PM ✓]        ||
|                                 +-------------------------------+|
|                                                                  |
|  [             Continue →                                    ]   |
+------------------------------------------------------------------+
```

Left: calendar date picker. Right: time slot grid for selected date. Slots grouped by morning/afternoon. Unavailable slots hidden. Selected slot highlighted.

### 3.5 Step 4: Intake Form (Conditional)

```
+------------------------------------------------------------------+
|  [< Back]                                                        |
|  (1)───(2)───(3)───(4)───(5)───(6)                              |
|  Complete Intake Form                                            |
|                                                                  |
|  General Health Intake                                           |
|  Please complete before your appointment.                        |
|                                                                  |
|  Allergies                                                       |
|  [________________________]  [+ Add another]                     |
|                                                                  |
|  Current Medications                                             |
|  [________________________]  [+ Add another]                     |
|                                                                  |
|  Existing Conditions                                             |
|  [ ] Diabetes        [ ] Heart Disease                           |
|  [ ] Hypertension    [ ] Asthma                                  |
|  [ ] Other: [_______________]                                    |
|                                                                  |
|  Additional Notes                                                |
|  [                                                           ]   |
|  [                                                           ]   |
|                                                                  |
|  [  Skip for now  ]              [  Submit & Continue →  ]       |
+------------------------------------------------------------------+
```

Dynamic form rendered from JSONB template. "Skip for now" is always available (intake doesn't block booking per BR-6).

### 3.6 Step 5: Review & Pay (Conditional)

```
+------------------------------------------------------------------+
|  [< Back]                                                        |
|  (1)───(2)───(3)───(4)───(5)───(6)                              |
|  Review & Pay                                                    |
|                                                                  |
|  +------------------------------------------------------------+ |
|  | Appointment Summary                                         | |
|  |                                                             | |
|  | Provider:  Dr. Sarah Johnson                                | |
|  | Service:   Follow-Up Session (30 min)                       | |
|  | Date:      Thursday, March 19, 2026                         | |
|  | Time:      2:00 PM - 2:30 PM (EST)                          | |
|  | Type:      Video Consultation                               | |
|  | Intake:    Completed ✓                                      | |
|  +------------------------------------------------------------+ |
|                                                                  |
|  +------------------------------------------------------------+ |
|  | Payment                                    Amount: $75.00   | |
|  |                                                             | |
|  | Card Number                                                 | |
|  | [Stripe Elements Card Input________________]                | |
|  |                                                             | |
|  | [  Secure payment processed by Stripe  ]                    | |
|  +------------------------------------------------------------+ |
|                                                                  |
|  By booking, you agree to the cancellation policy:               |
|  Free cancellation up to 24h before. 50% fee within 24h.        |
|                                                                  |
|  [           Confirm & Pay $75.00                            ]   |
+------------------------------------------------------------------+
```

If no payment required (price = $0 or no Stripe connected), the payment section is replaced with a simple "Confirm Booking" button.

### 3.7 Step 6: Confirmation

```
+------------------------------------------------------------------+
|  (1)───(2)───(3)───(4)───(5)───(6)                              |
|                                                                  |
|                    ✓ Booking Confirmed!                          |
|                                                                  |
|  +------------------------------------------------------------+ |
|  | Dr. Sarah Johnson                                           | |
|  | Follow-Up Session · 30 min                                  | |
|  | Thursday, March 19, 2026 · 2:00 PM EST                      | |
|  | Video Consultation                                          | |
|  +------------------------------------------------------------+ |
|                                                                  |
|  What's next:                                                    |
|  • Confirmation email sent to patient@example.com                |
|  • Complete your intake form before the appointment              |
|  • Join the video call from your patient portal                  |
|                                                                  |
|  [  View in Patient Portal  ]   [  Book Another Appointment  ]  |
+------------------------------------------------------------------+
```

---

## 4. Provider Dashboard (`/provider`)

### 4.1 Sidebar Navigation

```
+------------------+
| [Avatar]         |
| Dr. Sarah J.     |
| Sunrise Family   |
+------------------+
| > Dashboard      |
|   Schedule       |
|   Patients       |
|   Messages       |
|   Settings       |
+------------------+
```

### 4.2 Dashboard — Today's View (Default)

```
+------+-----------------------------------------------------------+
| SIDE |  Dashboard                           Thu, Mar 19, 2026    |
| BAR  |------------------------------------------------------------|
|      |  Today's Overview                                          |
|      |  [4 Confirmed] [1 In Progress] [2 Completed] [1 No-Show]  |
|      |                                                            |
|      |  +------------------------------------------------------+ |
|      |  | TIMELINE                                              | |
|      |  |                                                       | |
|      |  |  9:00  Alex Thompson · Initial Consultation  ✓ DONE   | |
|      |  |        VIDEO · 50 min · Intake: Complete              | |
|      |  |                                                       | |
|      |  | 10:00  Maya Rodriguez · Follow-Up           ● NOW     | |
|      |  |        VIDEO · 30 min · Intake: Complete              | |
|      |  |        [🎥 Join Video]  [📋 View Intake]              | |
|      |  |                                                       | |
|      |  | 11:00  (Available)                                    | |
|      |  |                                                       | |
|      |  | 11:30  Jordan Lee · Group Therapy           CONFIRMED  | |
|      |  |        VIDEO · 60 min · 4/6 participants              | |
|      |  |                                                       | |
|      |  |  1:00  Sam Patel · Initial Consultation     CONFIRMED  | |
|      |  |        IN_PERSON · 50 min · Intake: Pending           | |
|      |  |        [📋 Send Intake Reminder]                      | |
|      |  |                                                       | |
|      |  |  2:00  Chris Wang · Follow-Up               CONFIRMED  | |
|      |  |        VIDEO · 30 min · Intake: Complete              | |
|      |  +------------------------------------------------------+ |
|      |                                                            |
|      |  Patient Queue (Waiting Room)                              |
|      |  +------------------------------------------------------+ |
|      |  | Maya Rodriguez  · waiting since 9:58 AM               | |
|      |  | [🎥 Join Now]                                         | |
|      |  +------------------------------------------------------+ |
|      |                                                            |
|      |  Recent Messages                          [View All →]     |
|      |  +------------------------------------------------------+ |
|      |  | Alex Thompson: "Thank you for the session..." 9:52 AM | |
|      |  | Sam Patel: "Can I reschedule to 1:30?" 8:15 AM  [NEW] | |
|      |  +------------------------------------------------------+ |
+------+-----------------------------------------------------------+
```

Key elements:
- **Timeline**: Vertical schedule for the day. Each appointment is a card with status badge, actions.
- **Patient Queue**: Patients currently in the video waiting room. Prominent "Join Now" button.
- **Recent Messages**: Last 3-5 messages with unread indicators.
- **Quick actions**: Video join, view intake, send reminder — contextual per appointment.

### 4.3 Appointment Detail (Expanded/Modal)

```
+----------------------------------------------------------+
|  Appointment Detail                              [X Close] |
|                                                            |
|  Alex Thompson                                             |
|  Initial Consultation · 50 min · VIDEO                     |
|  Thu, Mar 19, 2026 · 9:00 AM - 9:50 AM EST                |
|  Status: COMPLETED                                         |
|                                                            |
|  +-- Tabs -------------------------------------------+    |
|  | [Intake] [Notes] [Messages] [Payment]              |    |
|  +----------------------------------------------------+    |
|                                                            |
|  Intake Form (General Health)                              |
|  Allergies: Penicillin, Shellfish                          |
|  Medications: Lisinopril 10mg daily                        |
|  Conditions: Hypertension                                  |
|  Notes: "Experiencing increased fatigue..."                |
|                                                            |
|  Provider Notes                                            |
|  [                                                     ]   |
|  [  Type notes here... (Markdown supported)            ]   |
|  [                                                     ]   |
|  [Save Notes]                                              |
|                                                            |
|  Actions                                                   |
|  [Reschedule] [Cancel] [Mark No-Show]                      |
+----------------------------------------------------------+
```

---

## 5. Video Consultation UI

### 5.1 Waiting Room (Patient View)

```
+------------------------------------------------------------------+
|  [!] Demo application - synthetic data only. Not for clinical use.|
+------------------------------------------------------------------+
|                                                                  |
|  +---------------------------+                                   |
|  |                           |                                   |
|  |   [Self-view camera       |    Waiting for provider...        |
|  |    preview]               |                                   |
|  |                           |    Your appointment:               |
|  |                           |    Dr. Sarah Johnson               |
|  +---------------------------+    Follow-Up Session               |
|                                   2:00 PM - 2:30 PM              |
|  Camera: [Webcam v]                                              |
|  Mic:    [Default Mic v]          The provider will admit you     |
|  Speaker:[Default Speaker v]      shortly. Please wait.           |
|                                                                  |
|  [🎤 Mute]  [📷 Camera Off]     [Leave Waiting Room]            |
|                                                                  |
+------------------------------------------------------------------+
```

Patient sees self-preview and device selectors. "Waiting for provider..." message until provider joins.

### 5.2 Active Video Call (1:1)

```
+------------------------------------------------------------------+
|  Following Up · Dr. Sarah Johnson        00:14:32    [Minimize]  |
+------------------------------------------------------------------+
|                                                                  |
|                                                                  |
|                  +---------------------------+                   |
|                  |                           |                   |
|                  |                           |                   |
|                  |    REMOTE VIDEO           |                   |
|                  |    (Provider/Patient)      |                   |
|                  |                           |                   |
|                  |                           |                   |
|                  +---------------------------+                   |
|                                                                  |
|                                        +--------+               |
|                                        | SELF   |               |
|                                        | VIEW   |               |
|                                        +--------+               |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|     [🎤 Mute]   [📷 Camera]   [🔴 End Call]                     |
|                                                                  |
+------------------------------------------------------------------+
```

- Remote video fills main area. Self-view is a small draggable picture-in-picture overlay (bottom-right).
- Call duration timer top-right.
- Control bar fixed at bottom: mute, camera toggle, end call.
- When FR-VID-6 (screen sharing) is implemented, add `[🖥 Share]` to the control bar.

### 5.3 Provider Video Call (with Sidebar)

```
+------------------------------------------------------------------+
|  Following Up · Alex Thompson            00:14:32    [Minimize]  |
+----------------------------------------------+-------------------+
|                                              |  SIDEBAR          |
|                                              |  [Intake] [Notes] |
|                                              |                   |
|      REMOTE VIDEO                            |  Allergies:       |
|      (Patient)                               |  - Penicillin     |
|                                              |  Medications:     |
|                                              |  - Lisinopril     |
|                                              |  Conditions:      |
|                                 +--------+   |  - Hypertension   |
|                                 | SELF   |   |                   |
|                                 | VIEW   |   |  Notes:           |
|                                 +--------+   |  [____________]   |
|                                              |  [____________]   |
+----------------------------------------------+-------------------+
|                                                                  |
|     [🎤 Mute]   [📷 Camera]   [🔴 End Call]     [📋 Sidebar]    |
|                                                                  |
+------------------------------------------------------------------+
```

Provider view has a collapsible right sidebar showing intake form data and notes. Toggle via sidebar button in control bar.

---

## 6. Patient Portal (`/patient`)

### 6.1 Sidebar Navigation

```
+------------------+
| [Avatar]         |
| Alex Thompson    |
+------------------+
| > Appointments   |
|   Messages       |
|   Intake Forms   |
|   Payments       |
|   Profile        |
+------------------+
```

### 6.2 Appointments List (Default View)

```
+------+-----------------------------------------------------------+
| SIDE |  My Appointments                                          |
| BAR  |  [Upcoming]  [Past]                                       |
|      |------------------------------------------------------------|
|      |                                                            |
|      |  +------------------------------------------------------+ |
|      |  | Thu, Mar 19 · 2:00 PM                     CONFIRMED  | |
|      |  | Dr. Sarah Johnson · Follow-Up Session                 | |
|      |  | Video Consultation · 30 min                           | |
|      |  | Sunrise Family Medicine                                | |
|      |  |                                                       | |
|      |  | Intake: Complete ✓   Payment: $75.00 Paid ✓           | |
|      |  |                                                       | |
|      |  | [🎥 Join Video]  [Reschedule]  [Cancel]               | |
|      |  +------------------------------------------------------+ |
|      |                                                            |
|      |  +------------------------------------------------------+ |
|      |  | Mon, Mar 24 · 10:00 AM                    CONFIRMED  | |
|      |  | Dr. Patel · Annual Physical                            | |
|      |  | In Person · 45 min                                    | |
|      |  | Bright Smile Dental                                    | |
|      |  |                                                       | |
|      |  | Intake: Pending ⚠    Payment: Pay at visit             | |
|      |  |                                                       | |
|      |  | [📋 Complete Intake]  [Reschedule]  [Cancel]           | |
|      |  +------------------------------------------------------+ |
|      |                                                            |
+------+-----------------------------------------------------------+
```

Cards grouped by practice (FR-PP-8 multi-practice view). Each card shows: date/time, provider, service, type, status badge, intake status, payment status, contextual actions.

### 6.3 Messages View

```
+------+-------------------+---------------------------------------+
| SIDE | Threads           | Dr. Sarah Johnson                     |
| BAR  |                   | Follow-Up · Mar 19                    |
|      | [Dr. Sarah J. ●]  |---------------------------------------|
|      |  Follow-Up Mar 19 |                                       |
|      |  "Thank you f..." | Dr. Johnson              9:52 AM     |
|      |                   | Thank you for the session today.      |
|      | [Dr. Patel]       | Please continue the exercises we      |
|      |  Annual Mar 24    | discussed.                            |
|      |  "Please brin..." |                                       |
|      |                   |              You         10:15 AM     |
|      |                   |              Will do! Should I        |
|      |                   |              schedule a follow-up?    |
|      |                   |                                       |
|      |                   | Dr. Johnson             10:16 AM     |
|      |                   | Yes, let's meet in 2 weeks.           |
|      |                   | ✓ Read                                |
|      |                   |                                       |
|      |                   |---------------------------------------|
|      |                   | [Type a message...          ] [Send]  |
+------+-------------------+---------------------------------------+
```

Left panel: thread list with unread indicators. Right panel: active thread with messages. Real-time via WebSocket.

---

## 7. Practice Admin (`/admin`)

### 7.1 Sidebar Navigation

```
+------------------+
| [Practice Logo]  |
| Sunrise Family   |
+------------------+
| > Overview       |
|   Appointments   |
|   Providers      |
|   Services       |
|   Patients       |
|   Settings       |
+------------------+
```

### 7.2 Overview Dashboard

```
+------+-----------------------------------------------------------+
| SIDE |  Practice Overview                    Thu, Mar 19, 2026   |
| BAR  |------------------------------------------------------------|
|      |                                                            |
|      |  [12 Today] [48 This Week] [156 This Month] [89% Util.]   |
|      |                                                            |
|      |  Today's Appointments                                      |
|      |  +------------------------------------------------------+ |
|      |  | Provider          | Confirmed | Progress | Done | NS  | |
|      |  |-------------------+-----------+----------+------+-----| |
|      |  | Dr. Sarah Johnson |     3     |    1     |  2   |  0  | |
|      |  | Dr. Patel         |     2     |    0     |  1   |  1  | |
|      |  | Nurse Kim         |     4     |    1     |  0   |  0  | |
|      |  +------------------------------------------------------+ |
|      |                                                            |
|      |  Recent Activity                                           |
|      |  • Alex Thompson booked with Dr. Johnson — 10:05 AM       |
|      |  • Maya Rodriguez cancelled — 9:30 AM                     |
|      |  • Payment received: $150.00 — 9:02 AM                    |
|      |                                                            |
+------+-----------------------------------------------------------+
```

### 7.3 Provider Management

```
+------+-----------------------------------------------------------+
| SIDE |  Providers                            [+ Invite Provider] |
| BAR  |------------------------------------------------------------|
|      |                                                            |
|      |  +------------------------------------------------------+ |
|      |  | [Avatar] Dr. Sarah Johnson          ACTIVE            | |
|      |  | Therapist, LCSW · Mental Health                       | |
|      |  | 3 services · 24 appointments this month               | |
|      |  | [Edit Profile]  [Manage Availability]  [Deactivate]   | |
|      |  +------------------------------------------------------+ |
|      |                                                            |
|      |  +------------------------------------------------------+ |
|      |  | [Avatar] Dr. Patel                    ACTIVE            | |
|      |  | Primary Care, MD · Family Medicine                    | |
|      |  | 5 services · 31 appointments this month               | |
|      |  | [Edit Profile]  [Manage Availability]  [Deactivate]   | |
|      |  +------------------------------------------------------+ |
|      |                                                            |
|      |  +------------------------------------------------------+ |
|      |  | [Avatar] Nurse Kim                    ACTIVE            | |
|      |  | NP · Family Medicine                                  | |
|      |  | 4 services · 18 appointments this month               | |
|      |  | [Edit Profile]  [Manage Availability]  [Deactivate]   | |
|      |  +------------------------------------------------------+ |
+------+-----------------------------------------------------------+
```

### 7.4 Practice Settings

```
+------+-----------------------------------------------------------+
| SIDE |  Practice Settings                                        |
| BAR  |------------------------------------------------------------|
|      |  [General] [Branding] [Payments] [Cancellation] [Booking] |
|      |                                                            |
|      |  General                                                   |
|      |  Practice Name    [Sunrise Family Medicine_____]           |
|      |  Slug             [sunrise-family_______________]          |
|      |  Timezone         [America/New_York___________ v]          |
|      |  Phone            [(555) 123-4567______________]           |
|      |  Email            [info@sunrise.example.com____]           |
|      |  Address          [123 Medical Center Dr_______]           |
|      |                   [Suite 100___________________]           |
|      |                   [New York, NY 10001__________]           |
|      |                                                            |
|      |  Branding                                                  |
|      |  Logo             [Upload]  [Current: sunrise-logo.png]   |
|      |  Cover Photo      [Upload]  [Current: cover.jpg]          |
|      |  Brand Color      [#2563EB]  [■ Preview]                  |
|      |                                                            |
|      |  [     Save Changes     ]                                 |
+------+-----------------------------------------------------------+
```

---

## 8. Compliance Roadmap Page (`/compliance-roadmap`)

```
+------------------------------------------------------------------+
| [MedConnect Logo]                                 [Back to Home]  |
+------------------------------------------------------------------+
|                                                                  |
|  HIPAA Compliance Roadmap                                        |
|  What production deployment requires                             |
|                                                                  |
|  +------------------------------------------------------------+ |
|  | [!] This platform currently operates in DEMO MODE with     | |
|  | synthetic data. This page documents what would be required  | |
|  | for production deployment with real patient data.           | |
|  +------------------------------------------------------------+ |
|                                                                  |
|  Table of Contents                                               |
|  1. Administrative Safeguards                                    |
|  2. Physical Safeguards                                          |
|  3. Technical Safeguards                                         |
|  4. Encryption Standards                                         |
|  5. Business Associate Agreements                                |
|  6. Infrastructure Migration Path                                |
|  7. Audit Logging Architecture                                   |
|  8. Data Retention Policies                                      |
|  9. Breach Notification Procedures                               |
|                                                                  |
|  --- Section content (rendered Markdown, scroll) ---             |
|                                                                  |
+------------------------------------------------------------------+
```

Static content page. No auth required. Content sourced from SRS-4 §9.

---

## 9. Responsive Behavior

| Breakpoint | Layout |
|------------|--------|
| < 640px (mobile) | Sidebar hidden (hamburger toggle). Single column. Cards stack vertically. Video fills viewport. |
| 640-1024px (tablet) | Sidebar collapsed (icon-only, 64px). Two-column grids become single column. |
| > 1024px (desktop) | Full sidebar (240px). Multi-column grids. Video with sidebar panel. |

### Mobile Booking Flow
Steps rendered as full-screen cards. Progress indicator becomes a simple "Step 3 of 6" text. Calendar picker uses native mobile date input where available.

### Mobile Video Call
Video fills entire viewport. Controls overlay at bottom. Self-view is a small corner thumbnail. No sidebar — intake/notes accessed via a bottom sheet.

---

## Cross-References

- **PRD §3.1-3.15:** Functional requirements implemented by these wireframes.
- **SRS-1 §13.6:** WCAG 2.1 AA accessibility NFRs applied to all layouts.
- **SRS-2 §14:** API endpoints backing each view.
- **SRS-4 §4:** WebSocket events for real-time updates in messaging and notifications.

---

**Company:** SJD Labs, LLC | **Founder:** Stephen Deslate
