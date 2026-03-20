'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SelectProvider } from './steps/select-provider';
import { SelectService } from './steps/select-service';
import { SelectTime } from './steps/select-time';
import { PatientInfo } from './steps/patient-info';
import { IntakeForm } from './steps/intake-form';
import { ReviewPay } from './steps/review-pay';
import { Confirmation } from './steps/confirmation';

export interface BookingState {
  practiceId: string;
  practiceName: string;
  providerId: string | null;
  providerName: string | null;
  serviceId: string | null;
  serviceName: string | null;
  serviceDuration: number;
  servicePriceCents: number;
  consultationType: string | null;
  serviceConsultationType: string | null;
  startTime: string | null;
  endTime: string | null;
  reservationSessionId: string | null;
  reservationExpiresAt: string | null;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  isGuest: boolean;
  intakeTemplateId: string | null;
  intakeResponses: Record<string, any> | null;
  dataProcessingConsent: boolean;
  appointmentId: string | null;
}

const INITIAL_STATE: Omit<BookingState, 'practiceId' | 'practiceName'> = {
  providerId: null,
  providerName: null,
  serviceId: null,
  serviceName: null,
  serviceDuration: 0,
  servicePriceCents: 0,
  consultationType: null,
  serviceConsultationType: null,
  startTime: null,
  endTime: null,
  reservationSessionId: null,
  reservationExpiresAt: null,
  patientName: '',
  patientEmail: '',
  patientPhone: '',
  isGuest: true,
  intakeTemplateId: null,
  intakeResponses: null,
  dataProcessingConsent: false,
  appointmentId: null,
};

const STEPS = [
  { key: 'provider', label: 'Provider' },
  { key: 'service', label: 'Service' },
  { key: 'time', label: 'Date & Time' },
  { key: 'patient', label: 'Your Info' },
  { key: 'intake', label: 'Intake' },
  { key: 'review', label: 'Review & Pay' },
];

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [step, setStep] = useState(0);
  const [booking, setBooking] = useState<BookingState | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const { data: practice, isLoading, error } = useQuery({
    queryKey: ['practice-public', slug],
    queryFn: async () => {
      const { data } = await api.get(`/practices/${slug}/public`);
      return data;
    },
    enabled: !!slug,
  });

  useEffect(() => {
    if (practice && !booking) {
      setBooking({
        ...INITIAL_STATE,
        practiceId: practice.id,
        practiceName: practice.name,
      });
    }
  }, [practice, booking]);

  const updateBooking = useCallback((updates: Partial<BookingState>) => {
    setBooking((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  const goNext = useCallback(() => setStep((s) => s + 1), []);
  const goBack = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  const handleConfirmed = useCallback((appointmentId: string) => {
    updateBooking({ appointmentId });
    setConfirmed(true);
  }, [updateBooking]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading practice...</div>
      </div>
    );
  }

  if (error || !practice) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Practice Not Found</h1>
          <p className="text-gray-500">The booking page you&apos;re looking for doesn&apos;t exist.</p>
        </div>
      </div>
    );
  }

  if (!booking) return null;

  if (confirmed) {
    return <Confirmation booking={booking} practiceName={practice.name} />;
  }

  // Skip intake step if no intake template
  const visibleSteps = booking.intakeTemplateId
    ? STEPS
    : STEPS.filter((s) => s.key !== 'intake');
  const currentStepKey = visibleSteps[step]?.key;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">{practice.name}</h1>
          <p className="text-gray-500 mt-1">Book an Appointment</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1 mb-8">
          {visibleSteps.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  i < step
                    ? 'bg-blue-600 text-white'
                    : i === step
                      ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-600'
                      : 'bg-gray-200 text-gray-500'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </div>
              {i < visibleSteps.length - 1 && (
                <div className={`w-8 h-0.5 ${i < step ? 'bg-blue-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step label */}
        <h2 className="text-lg font-semibold mb-4 text-center">
          {visibleSteps[step]?.label}
        </h2>

        {/* Step content */}
        <div className="bg-white rounded-lg border p-6">
          {currentStepKey === 'provider' && (
            <SelectProvider
              practiceId={booking.practiceId}
              onSelect={(id, name) => {
                updateBooking({ providerId: id, providerName: name });
                goNext();
              }}
            />
          )}
          {currentStepKey === 'service' && (
            <SelectService
              practiceId={booking.practiceId}
              providerId={booking.providerId!}
              onSelect={(service) => {
                updateBooking({
                  serviceId: service.id,
                  serviceName: service.name,
                  serviceDuration: service.duration_minutes,
                  servicePriceCents: service.price_cents,
                  serviceConsultationType: service.consultation_type,
                  consultationType:
                    service.consultation_type !== 'BOTH' ? service.consultation_type : null,
                  intakeTemplateId: service.intake_template_id || null,
                });
                goNext();
              }}
              onBack={goBack}
            />
          )}
          {currentStepKey === 'time' && (
            <SelectTime
              practiceId={booking.practiceId}
              providerId={booking.providerId!}
              serviceId={booking.serviceId!}
              durationMinutes={booking.serviceDuration}
              serviceConsultationType={booking.serviceConsultationType}
              consultationType={booking.consultationType}
              reservationSessionId={booking.reservationSessionId}
              reservationExpiresAt={booking.reservationExpiresAt}
              onSelect={(slot, reservation) => {
                updateBooking({
                  startTime: slot.start,
                  endTime: slot.end,
                  consultationType: slot.consultationType || booking.consultationType,
                  reservationSessionId: reservation.session_id,
                  reservationExpiresAt: reservation.expires_at,
                });
                goNext();
              }}
              onBack={goBack}
            />
          )}
          {currentStepKey === 'patient' && (
            <PatientInfo
              booking={booking}
              onSubmit={(info) => {
                updateBooking(info);
                goNext();
              }}
              onBack={goBack}
            />
          )}
          {currentStepKey === 'intake' && booking.intakeTemplateId && (
            <IntakeForm
              templateId={booking.intakeTemplateId}
              onSubmit={(responses) => {
                updateBooking({ intakeResponses: responses });
                goNext();
              }}
              onBack={goBack}
            />
          )}
          {currentStepKey === 'review' && (
            <ReviewPay
              booking={booking}
              onUpdateBooking={updateBooking}
              onConfirmed={handleConfirmed}
              onBack={goBack}
            />
          )}
        </div>
      </div>
    </div>
  );
}
