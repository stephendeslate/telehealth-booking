/** Slot reservation TTL in minutes */
export const SLOT_RESERVATION_TTL_MINUTES = 10;

/** Default buffer before appointment in minutes */
export const DEFAULT_BUFFER_BEFORE_MINUTES = 0;

/** Default buffer after appointment in minutes */
export const DEFAULT_BUFFER_AFTER_MINUTES = 0;

/** Maximum advance booking window in days */
export const ADVANCE_BOOKING_WINDOW_DAYS = 90;

/** Refresh token expiry in days */
export const REFRESH_TOKEN_EXPIRY_DAYS = 7;

/** Access token expiry in minutes */
export const ACCESS_TOKEN_EXPIRY_MINUTES = 15;

/** Password bcrypt rounds */
export const BCRYPT_ROUNDS = 12;

/** No-show detection delay after appointment end in minutes */
export const NO_SHOW_DETECTION_DELAY_MINUTES = 15;

/** Video room hard limit after appointment end in minutes */
export const VIDEO_ROOM_HARD_LIMIT_MINUTES = 30;

/** Video reconnection grace period in minutes */
export const VIDEO_RECONNECTION_GRACE_MINUTES = 5;

/** Manual approval timeout in hours */
export const MANUAL_APPROVAL_TIMEOUT_HOURS = 48;

/** Typing indicator auto-expire in seconds */
export const TYPING_INDICATOR_EXPIRE_SECONDS = 5;

/** Unread message email delay in minutes */
export const UNREAD_MESSAGE_EMAIL_DELAY_MINUTES = 5;

/** Follow-up email delay after completion in hours */
export const FOLLOW_UP_EMAIL_DELAY_HOURS = 24;

/** Data export rate limit (1 per N hours) */
export const DATA_EXPORT_RATE_LIMIT_HOURS = 24;

/** Orphaned upload cleanup delay in hours */
export const ORPHANED_UPLOAD_CLEANUP_DELAY_HOURS = 1;

/** Platform fee percentage */
export const PLATFORM_FEE_PERCENT = 1;

/** Max participants for group sessions */
export const MAX_GROUP_PARTICIPANTS = 6;

/** Default max participants */
export const DEFAULT_MAX_PARTICIPANTS = 2;

/** Upload size limits in bytes */
export const UPLOAD_LIMITS = {
  avatar: 2 * 1024 * 1024, // 2MB
  practice_logo: 1 * 1024 * 1024, // 1MB
  practice_cover: 5 * 1024 * 1024, // 5MB
} as const;

/** Allowed MIME types per upload purpose */
export const UPLOAD_MIME_TYPES = {
  avatar: ['image/jpeg', 'image/png', 'image/webp'],
  practice_logo: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  practice_cover: ['image/jpeg', 'image/png', 'image/webp'],
} as const;

/** Upload max dimensions */
export const UPLOAD_MAX_DIMENSIONS = {
  avatar: { width: 1024, height: 1024 },
  practice_logo: { width: 512, height: 512 },
  practice_cover: { width: 1920, height: 600 },
} as const;

/** Default cancellation policy */
export const DEFAULT_CANCELLATION_POLICY = {
  free_cancel_hours: 24,
  late_cancel_fee_percent: 50,
  no_refund_hours: 2,
} as const;

/** Default reminder settings */
export const DEFAULT_REMINDER_SETTINGS = {
  email_24h: true,
  email_1h: true,
  sms_1h: false,
} as const;

/** Default notification preferences */
export const DEFAULT_NOTIFICATION_PREFERENCES = {
  email: true,
  sms: false,
  push: false,
} as const;

/** Rate limiting tiers (requests per window) */
export const RATE_LIMITS = {
  public: { limit: 100, ttl: 60 },
  auth: { limit: 10, ttl: 60 },
  api: { limit: 500, ttl: 60 },
  webhook: { limit: 1000, ttl: 60 },
  password_reset: { limit: 5, ttl: 900 },
} as const;

/** BullMQ job defaults */
export const JOB_DEFAULTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: { age: 86400 }, // 24 hours
  removeOnFail: { age: 604800 }, // 7 days
} as const;

/** Queue names */
export const QUEUES = {
  SCHEDULING: 'scheduling',
  APPOINTMENTS: 'appointments',
  NOTIFICATIONS: 'notifications',
  VIDEO: 'video',
  CALENDAR: 'calendar',
  EXPORTS: 'exports',
  UPLOADS: 'uploads',
} as const;

/** Appointment state machine valid transitions */
export const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
} as const;
