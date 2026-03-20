'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface SlotData {
  start: string;
  end: string;
  consultationType?: string;
}

interface ReservationData {
  session_id: string;
  expires_at: string;
}

interface Props {
  practiceId: string;
  providerId: string;
  serviceId: string;
  durationMinutes: number;
  serviceConsultationType: string | null;
  consultationType: string | null;
  reservationSessionId: string | null;
  reservationExpiresAt: string | null;
  onSelect: (slot: SlotData, reservation: ReservationData) => void;
  onBack: () => void;
}

export function SelectTime({
  practiceId,
  providerId,
  serviceId,
  durationMinutes,
  serviceConsultationType,
  consultationType,
  reservationSessionId,
  reservationExpiresAt,
  onSelect,
  onBack,
}: Props) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [selectedSlot, setSelectedSlot] = useState<SlotData | null>(null);
  const [chosenType, setChosenType] = useState<string>(consultationType || 'VIDEO');
  const [countdown, setCountdown] = useState<number | null>(null);

  const { data: slots, isLoading } = useQuery({
    queryKey: ['availability', providerId, selectedDate, serviceId],
    queryFn: async () => {
      const { data } = await api.get(`/providers/${providerId}/availability`, {
        params: { date: selectedDate, service_id: serviceId },
      });
      return data.data || data || [];
    },
  });

  const reserveMutation = useMutation({
    mutationFn: async (slot: SlotData) => {
      const { data } = await api.post('/appointments/reserve', {
        practice_id: practiceId,
        provider_profile_id: providerId,
        service_id: serviceId,
        start_time: slot.start,
      });
      return data;
    },
    onSuccess: (data, slot) => {
      onSelect(
        { ...slot, consultationType: serviceConsultationType === 'BOTH' ? chosenType : undefined },
        { session_id: data.session_id || data.id, expires_at: data.expires_at },
      );
    },
  });

  // Countdown timer for existing reservation
  useEffect(() => {
    if (!reservationExpiresAt) {
      setCountdown(null);
      return;
    }
    const update = () => {
      const remaining = Math.max(0, Math.floor((new Date(reservationExpiresAt).getTime() - Date.now()) / 1000));
      setCountdown(remaining);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [reservationExpiresAt]);

  const handleSelectSlot = useCallback(
    (slot: SlotData) => {
      setSelectedSlot(slot);
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    if (selectedSlot) {
      reserveMutation.mutate(selectedSlot);
    }
  }, [selectedSlot, reserveMutation]);

  // Generate date options (next 14 days)
  const dateOptions: string[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dateOptions.push(d.toISOString().split('T')[0]);
  }

  const availableSlots: SlotData[] = slots || [];

  return (
    <div>
      {/* Countdown warning */}
      {countdown !== null && countdown > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          Slot reserved for {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
        </div>
      )}
      {countdown === 0 && reservationSessionId && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Your reservation has expired. Please select a new time slot.
        </div>
      )}

      {/* Consultation type choice if service supports BOTH */}
      {serviceConsultationType === 'BOTH' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Consultation Type</label>
          <div className="flex gap-2">
            {['VIDEO', 'IN_PERSON', 'PHONE'].map((t) => (
              <button
                key={t}
                onClick={() => setChosenType(t)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                  chosenType === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Date picker */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {dateOptions.map((d) => {
            const date = new Date(d + 'T12:00:00');
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = date.getDate();
            const month = date.toLocaleDateString('en-US', { month: 'short' });
            return (
              <button
                key={d}
                onClick={() => { setSelectedDate(d); setSelectedSlot(null); }}
                className={`flex-shrink-0 w-16 py-2 rounded-lg text-center text-sm ${
                  selectedDate === d
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <div className="text-xs">{dayName}</div>
                <div className="font-medium">{dayNum}</div>
                <div className="text-xs">{month}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time slots */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Available Times</label>
        {isLoading ? (
          <div className="text-center py-6 text-gray-500">Loading availability...</div>
        ) : availableSlots.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            No available slots on this date.
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {availableSlots.map((slot) => {
              const time = new Date(slot.start);
              const label = time.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              });
              const isSelected = selectedSlot?.start === slot.start;
              return (
                <button
                  key={slot.start}
                  onClick={() => handleSelectSlot(slot)}
                  className={`py-2 rounded-lg text-sm font-medium ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={!selectedSlot || reserveMutation.isPending}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {reserveMutation.isPending ? 'Reserving...' : 'Reserve & Continue'}
        </button>
      </div>
      {reserveMutation.isError && (
        <p className="mt-2 text-sm text-red-600 text-right">
          Failed to reserve slot. It may no longer be available.
        </p>
      )}
    </div>
  );
}
