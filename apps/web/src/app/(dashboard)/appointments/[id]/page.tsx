'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);

  const { data: appointment, isLoading } = useQuery({
    queryKey: ['appointment', id],
    queryFn: async () => {
      const { data } = await api.get(`/appointments/${id}`);
      return data;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      api.post(`/appointments/${id}/cancel`, { reason: cancelReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', id] });
      setShowCancel(false);
    },
  });

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>;
  }

  if (!appointment) {
    return <div className="text-center py-8 text-gray-500">Appointment not found</div>;
  }

  const canCancel = ['PENDING', 'CONFIRMED'].includes(appointment.status);
  const canJoinVideo =
    appointment.consultation_type === 'VIDEO' &&
    ['CONFIRMED', 'IN_PROGRESS'].includes(appointment.status);

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        &larr; Back
      </button>

      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">
              {appointment.service?.name || 'Appointment'}
            </h1>
            <p className="text-gray-500 mt-1">
              {appointment.provider_profile?.user?.name &&
                `Dr. ${appointment.provider_profile.user.name}`}
            </p>
          </div>
          <span
            className={`px-3 py-1 text-sm rounded-full font-medium ${
              appointment.status === 'CONFIRMED'
                ? 'bg-green-100 text-green-700'
                : appointment.status === 'PENDING'
                  ? 'bg-yellow-100 text-yellow-700'
                  : appointment.status === 'COMPLETED'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
            }`}
          >
            {appointment.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Date</p>
            <p className="font-medium">
              {new Date(appointment.start_time).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Time</p>
            <p className="font-medium">
              {new Date(appointment.start_time).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              -{' '}
              {new Date(appointment.end_time).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Type</p>
            <p className="font-medium">{appointment.consultation_type}</p>
          </div>
          <div>
            <p className="text-gray-500">Practice</p>
            <p className="font-medium">{appointment.practice?.name}</p>
          </div>
        </div>

        {appointment.notes && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-gray-500 text-sm">Notes</p>
            <p className="mt-1 text-sm">{appointment.notes}</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {canJoinVideo && (
          <Link
            href={`/video/${appointment.id}`}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
          >
            Join Video Call
          </Link>
        )}

        <Link
          href={`/appointments/${appointment.id}/messages`}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm"
        >
          Messages
        </Link>

        {canCancel && (
          <button
            onClick={() => setShowCancel(true)}
            className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium text-sm"
          >
            Cancel
          </button>
        )}
      </div>

      {showCancel && (
        <div className="mt-4 bg-white rounded-lg border p-4">
          <h3 className="font-medium mb-2">Cancel Appointment</h3>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Reason for cancellation (optional)"
            className="w-full px-3 py-2 border rounded-lg text-sm mb-3"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50"
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancel'}
            </button>
            <button
              onClick={() => setShowCancel(false)}
              className="px-4 py-2 bg-gray-100 rounded-lg text-sm"
            >
              Keep Appointment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
