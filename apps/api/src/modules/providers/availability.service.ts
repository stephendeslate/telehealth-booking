import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ADVANCE_BOOKING_WINDOW_DAYS,
  SLOT_RESERVATION_TTL_MINUTES,
} from '@medconnect/shared';

export interface AvailableSlot {
  start_time: string; // ISO 8601 UTC
  end_time: string;   // ISO 8601 UTC
}

export interface AvailabilityQuery {
  practiceId: string;
  providerProfileId: string;
  date: string; // YYYY-MM-DD
  serviceDurationMinutes: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  practiceTimezone: string;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 6-layer availability resolution:
   * 1. Availability rules (recurring weekly schedule)
   * 2. Buffer times (before/after from service config)
   * 3. Blocked dates (provider-set blackout periods)
   * 4. Calendar events (external calendar blocks — stub for now)
   * 5. Appointments + reservations (already booked/held)
   * 6. Advance booking window (can't book too far ahead or in the past)
   */
  async getAvailableSlots(query: AvailabilityQuery): Promise<AvailableSlot[]> {
    const {
      practiceId,
      providerProfileId,
      date,
      serviceDurationMinutes,
      bufferBeforeMinutes = 0,
      bufferAfterMinutes = 0,
      practiceTimezone,
    } = query;

    // Layer 6: Advance booking window check
    const requestedDate = new Date(date + 'T00:00:00Z');
    const now = new Date();
    const today = new Date(now.toISOString().split('T')[0] + 'T00:00:00Z');
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + ADVANCE_BOOKING_WINDOW_DAYS);

    if (requestedDate < today || requestedDate > maxDate) {
      return [];
    }

    // Layer 1: Get availability rules for this day of week
    const dayOfWeek = this.getDayOfWeek(date, practiceTimezone);
    const rules = await this.prisma.availabilityRule.findMany({
      where: {
        practice_id: practiceId,
        provider_profile_id: providerProfileId,
        day_of_week: dayOfWeek,
        is_active: true,
      },
    });

    if (rules.length === 0) return [];

    // Generate raw slots from rules
    let slots: AvailableSlot[] = [];
    for (const rule of rules) {
      const ruleSlots = this.generateSlotsFromRule(
        date,
        rule.start_time,
        rule.end_time,
        serviceDurationMinutes,
        practiceTimezone,
      );
      slots.push(...ruleSlots);
    }

    if (slots.length === 0) return [];

    // Layer 3: Remove slots on blocked dates
    const blockedDates = await this.prisma.blockedDate.findMany({
      where: {
        practice_id: practiceId,
        provider_profile_id: providerProfileId,
        start_date: { lte: new Date(date) },
        end_date: { gte: new Date(date) },
      },
    });

    if (blockedDates.length > 0) {
      return []; // Entire day is blocked
    }

    // Layer 4: Calendar events (stub — would filter out external calendar blocks)
    // For now, no external calendar filtering. Will be wired in Phase 7.

    if (slots.length === 0) return [];

    // Layer 5: Remove slots that conflict with existing appointments or reservations
    const dayStart = new Date(slots[0]!.start_time);
    const dayEnd = new Date(slots[slots.length - 1]!.end_time);

    const [appointments, reservations] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          practice_id: practiceId,
          provider_profile_id: providerProfileId,
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          start_time: { lt: dayEnd },
          end_time: { gt: dayStart },
        },
        select: { start_time: true, end_time: true },
      }),
      this.prisma.slotReservation.findMany({
        where: {
          practice_id: practiceId,
          provider_profile_id: providerProfileId,
          expires_at: { gt: now },
          start_time: { lt: dayEnd },
          end_time: { gt: dayStart },
        },
        select: { start_time: true, end_time: true },
      }),
    ]);

    const busyPeriods = [
      ...appointments.map((a) => ({
        start: new Date(a.start_time).getTime(),
        end: new Date(a.end_time).getTime(),
      })),
      ...reservations.map((r) => ({
        start: new Date(r.start_time).getTime(),
        end: new Date(r.end_time).getTime(),
      })),
    ];

    // Layer 2: Apply buffer times when checking conflicts
    slots = slots.filter((slot) => {
      const slotStart = new Date(slot.start_time).getTime();
      const slotEnd = new Date(slot.end_time).getTime();
      const bufferedStart = slotStart - bufferBeforeMinutes * 60 * 1000;
      const bufferedEnd = slotEnd + bufferAfterMinutes * 60 * 1000;

      return !busyPeriods.some(
        (busy) => bufferedStart < busy.end && bufferedEnd > busy.start,
      );
    });

    // Layer 6 (cont.): Remove past time slots for today
    if (date === today.toISOString().split('T')[0]) {
      const nowMs = now.getTime();
      slots = slots.filter((slot) => new Date(slot.start_time).getTime() > nowMs);
    }

    return slots;
  }

  private getDayOfWeek(dateStr: string, timezone: string): number {
    // Get the day of week in the practice's timezone
    const date = new Date(dateStr + 'T12:00:00Z'); // noon UTC to avoid DST edge cases
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    });
    const dayName = formatter.format(date);
    const days: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    return days[dayName] ?? date.getUTCDay();
  }

  private generateSlotsFromRule(
    dateStr: string,
    ruleStart: Date,
    ruleEnd: Date,
    durationMinutes: number,
    timezone: string,
  ): AvailableSlot[] {
    const slots: AvailableSlot[] = [];

    // Extract HH:mm from the Time columns
    const startHour = ruleStart.getUTCHours();
    const startMinute = ruleStart.getUTCMinutes();
    const endHour = ruleEnd.getUTCHours();
    const endMinute = ruleEnd.getUTCMinutes();

    // Build start/end times in the practice timezone, then convert to UTC
    // Use a simple approach: construct the local time, then use timezone offset
    const localStart = this.localToUtc(dateStr, startHour, startMinute, timezone);
    const localEnd = this.localToUtc(dateStr, endHour, endMinute, timezone);

    const startMs = localStart.getTime();
    const endMs = localEnd.getTime();
    const durationMs = durationMinutes * 60 * 1000;

    let current = startMs;
    while (current + durationMs <= endMs) {
      slots.push({
        start_time: new Date(current).toISOString(),
        end_time: new Date(current + durationMs).toISOString(),
      });
      current += durationMs;
    }

    return slots;
  }

  private localToUtc(dateStr: string, hours: number, minutes: number, timezone: string): Date {
    // Build a date string representing the local time
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localStr = `${dateStr}T${pad(hours)}:${pad(minutes)}:00`;

    // Use a trick: format dates back and forth to find the UTC offset
    // Create a reference date in the target timezone
    const refDate = new Date(localStr + 'Z');

    // Get the timezone offset by comparing formatted times
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // Find offset by iteration (more reliable than parsing)
    // Start with an approximation: the local time string as if it's UTC,
    // then adjust by the difference between what timezone says and what we want
    const parts = formatter.formatToParts(refDate);
    const tzHour = parseInt(parts.find((p) => p.type === 'hour')!.value);
    const tzMinute = parseInt(parts.find((p) => p.type === 'minute')!.value);
    const tzDay = parseInt(parts.find((p) => p.type === 'day')!.value);
    const refDay = refDate.getUTCDate();

    // Offset in minutes: what UTC shows vs what TZ shows
    let offsetMinutes = (tzHour * 60 + tzMinute) - (hours * 60 + minutes);

    // Handle day boundary
    if (tzDay > refDay) offsetMinutes += 24 * 60;
    else if (tzDay < refDay) offsetMinutes -= 24 * 60;

    // The UTC time we want is localTime - offset
    return new Date(refDate.getTime() - offsetMinutes * 60 * 1000);
  }
}
