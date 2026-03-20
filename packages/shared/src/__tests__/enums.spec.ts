import { describe, it, expect } from 'vitest';
import {
  UserRole,
  MembershipRole,
  AppointmentStatus,
  ConsultationType,
  VideoRoomStatus,
  PaymentStatus,
  ConfirmationMode,
  CalendarProvider,
  CalendarEventDirection,
  CalendarConnectionStatus,
  MessageType,
  IntakeFieldType,
  IntakeStatus,
  NotificationType,
  SpecialtyCategory,
  ConsentType,
  AuditAction,
  UploadPurpose,
} from '../enums';

describe('Enums', () => {
  it('UserRole has exactly 2 values', () => {
    const values = Object.values(UserRole);
    expect(values).toHaveLength(2);
    expect(values).toContain('PLATFORM_ADMIN');
    expect(values).toContain('USER');
  });

  it('MembershipRole has exactly 3 values', () => {
    const values = Object.values(MembershipRole);
    expect(values).toHaveLength(3);
    expect(values).toContain('OWNER');
    expect(values).toContain('ADMIN');
    expect(values).toContain('PROVIDER');
  });

  it('AppointmentStatus has exactly 6 values', () => {
    const values = Object.values(AppointmentStatus);
    expect(values).toHaveLength(6);
    expect(values).toEqual(
      expect.arrayContaining([
        'PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW',
      ]),
    );
  });

  it('ConsultationType has exactly 4 values', () => {
    expect(Object.values(ConsultationType)).toHaveLength(4);
  });

  it('VideoRoomStatus has exactly 4 values', () => {
    expect(Object.values(VideoRoomStatus)).toHaveLength(4);
  });

  it('PaymentStatus has exactly 5 values', () => {
    expect(Object.values(PaymentStatus)).toHaveLength(5);
  });

  it('ConfirmationMode has exactly 2 values', () => {
    expect(Object.values(ConfirmationMode)).toHaveLength(2);
  });

  it('CalendarProvider has exactly 2 values', () => {
    expect(Object.values(CalendarProvider)).toHaveLength(2);
  });

  it('CalendarEventDirection has exactly 2 values', () => {
    expect(Object.values(CalendarEventDirection)).toHaveLength(2);
  });

  it('CalendarConnectionStatus has exactly 3 values', () => {
    expect(Object.values(CalendarConnectionStatus)).toHaveLength(3);
  });

  it('MessageType has exactly 2 values', () => {
    expect(Object.values(MessageType)).toHaveLength(2);
  });

  it('IntakeFieldType has exactly 9 values', () => {
    expect(Object.values(IntakeFieldType)).toHaveLength(9);
  });

  it('IntakeStatus has exactly 3 values', () => {
    expect(Object.values(IntakeStatus)).toHaveLength(3);
  });

  it('NotificationType has exactly 10 values', () => {
    expect(Object.values(NotificationType)).toHaveLength(10);
  });

  it('SpecialtyCategory has exactly 7 values', () => {
    expect(Object.values(SpecialtyCategory)).toHaveLength(7);
  });

  it('ConsentType has exactly 5 values', () => {
    expect(Object.values(ConsentType)).toHaveLength(5);
  });

  it('AuditAction has exactly 26 values', () => {
    expect(Object.values(AuditAction)).toHaveLength(26);
  });

  it('UploadPurpose has exactly 3 values', () => {
    expect(Object.values(UploadPurpose)).toHaveLength(3);
  });
});
