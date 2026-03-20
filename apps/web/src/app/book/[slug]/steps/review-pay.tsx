'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BookingState } from '../page';

interface Props {
  booking: BookingState;
  onUpdateBooking: (updates: Partial<BookingState>) => void;
  onConfirmed: (appointmentId: string) => void;
  onBack: () => void;
}

export function ReviewPay({ booking, onUpdateBooking, onConfirmed, onBack }: Props) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState('');

  // Countdown timer for reservation
  useEffect(() => {
    if (!booking.reservationExpiresAt) return;
    const update = () => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(booking.reservationExpiresAt!).getTime() - Date.now()) / 1000),
      );
      setCountdown(remaining);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [booking.reservationExpiresAt]);

  const bookMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        practice_id: booking.practiceId,
        provider_profile_id: booking.providerId,
        service_id: booking.serviceId,
        start_time: booking.startTime,
        reservation_session_id: booking.reservationSessionId,
        data_processing_consent: booking.dataProcessingConsent,
      };

      if (booking.consultationType && booking.serviceConsultationType === 'BOTH') {
        payload.consultation_type = booking.consultationType;
      }

      if (booking.isGuest) {
        payload.patient_name = booking.patientName;
        payload.patient_email = booking.patientEmail;
        if (booking.patientPhone) payload.patient_phone = booking.patientPhone;
      }

      if (booking.intakeResponses && Object.keys(booking.intakeResponses).length > 0) {
        payload.intake_responses = booking.intakeResponses;
      }

      // In production, stripe_payment_method_id would come from Stripe Elements
      // For demo, we skip payment if no Stripe configured

      const { data } = await api.post('/appointments', payload);
      return data;
    },
    onSuccess: (data) => {
      onConfirmed(data.id);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to complete booking. Please try again.';
      setError(msg);
    },
  });

  const startTime = booking.startTime ? new Date(booking.startTime) : null;
  const expired = countdown === 0;

  return (
    <div>
      {/* Countdown */}
      {countdown !== null && countdown > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          Complete your booking within {Math.floor(countdown / 60)}:
          {String(countdown % 60).padStart(2, '0')} before your slot is released.
        </div>
      )}
      {expired && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Your reservation has expired. Please go back and select a new time slot.
        </div>
      )}

      {/* Booking summary */}
      <div className="space-y-3 mb-6">
        <div className="flex justify-between py-2 border-b">
          <span className="text-sm text-gray-500">Practice</span>
          <span className="text-sm font-medium">{booking.practiceName}</span>
        </div>
        <div className="flex justify-between py-2 border-b">
          <span className="text-sm text-gray-500">Provider</span>
          <span className="text-sm font-medium">{booking.providerName}</span>
        </div>
        <div className="flex justify-between py-2 border-b">
          <span className="text-sm text-gray-500">Service</span>
          <span className="text-sm font-medium">{booking.serviceName}</span>
        </div>
        <div className="flex justify-between py-2 border-b">
          <span className="text-sm text-gray-500">Date & Time</span>
          <span className="text-sm font-medium">
            {startTime
              ? startTime.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                }) +
                ' at ' +
                startTime.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : '-'}
          </span>
        </div>
        <div className="flex justify-between py-2 border-b">
          <span className="text-sm text-gray-500">Duration</span>
          <span className="text-sm font-medium">{booking.serviceDuration} minutes</span>
        </div>
        {booking.consultationType && (
          <div className="flex justify-between py-2 border-b">
            <span className="text-sm text-gray-500">Type</span>
            <span className="text-sm font-medium">
              {booking.consultationType.replace('_', ' ')}
            </span>
          </div>
        )}
        <div className="flex justify-between py-2 border-b">
          <span className="text-sm text-gray-500">Patient</span>
          <span className="text-sm font-medium">
            {booking.patientName || 'You'}
          </span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-sm text-gray-500">Total</span>
          <span className="text-lg font-bold text-blue-600">
            {booking.servicePriceCents > 0
              ? `$${(booking.servicePriceCents / 100).toFixed(2)}`
              : 'Free'}
          </span>
        </div>
      </div>

      {/* Payment (placeholder for Stripe Elements) */}
      {booking.servicePriceCents > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-sm text-gray-500 text-center">
            Payment processing via Stripe Elements
          </p>
          <p className="text-xs text-gray-400 text-center mt-1">
            (Demo mode — no real payment required)
          </p>
        </div>
      )}

      {/* Consent */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={booking.dataProcessingConsent}
            onChange={(e) => onUpdateBooking({ dataProcessingConsent: e.target.checked })}
            className="mt-0.5 rounded"
          />
          <span className="text-sm text-gray-600">
            I agree to the processing of my data for appointment booking. I understand that my
            information will be shared with the healthcare provider for the purpose of this
            consultation. <span className="text-red-500">*</span>
          </span>
        </label>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back
        </button>
        <button
          onClick={() => bookMutation.mutate()}
          disabled={!booking.dataProcessingConsent || bookMutation.isPending || expired}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {bookMutation.isPending
            ? 'Booking...'
            : booking.servicePriceCents > 0
              ? `Pay $${(booking.servicePriceCents / 100).toFixed(2)} & Book`
              : 'Confirm Booking'}
        </button>
      </div>
    </div>
  );
}
