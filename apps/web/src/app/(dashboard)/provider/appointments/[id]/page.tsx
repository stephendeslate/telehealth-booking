'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';

export default function ProviderAppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);

  const { data: appointment, isLoading } = useQuery({
    queryKey: ['appointment', id],
    queryFn: async () => {
      const { data } = await api.get(`/appointments/${id}`);
      setNotes(data.notes || '');
      return data;
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => api.post(`/appointments/${id}/confirm`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointment', id] }),
  });

  const notesMutation = useMutation({
    mutationFn: () => api.patch(`/appointments/${id}`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', id] });
      setEditingNotes(false);
    },
  });

  if (isLoading) return <div className="text-center py-8 text-gray-500">Loading...</div>;
  if (!appointment) return <div className="text-center py-8 text-gray-500">Not found</div>;

  const canConfirm = appointment.status === 'PENDING';
  const canJoinVideo =
    appointment.consultation_type === 'VIDEO' &&
    ['CONFIRMED', 'IN_PROGRESS'].includes(appointment.status);

  return (
    <div className="max-w-2xl">
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-4">
        &larr; Back
      </button>

      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">{appointment.patient?.name || 'Patient'}</h1>
            <p className="text-gray-500 mt-1">{appointment.service?.name}</p>
          </div>
          <span
            className={`px-3 py-1 text-sm rounded-full font-medium ${
              appointment.status === 'CONFIRMED'
                ? 'bg-green-100 text-green-700'
                : appointment.status === 'PENDING'
                  ? 'bg-yellow-100 text-yellow-700'
                  : appointment.status === 'IN_PROGRESS'
                    ? 'bg-blue-100 text-blue-700'
                    : appointment.status === 'COMPLETED'
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-red-100 text-red-700'
            }`}
          >
            {appointment.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Date</p>
            <p className="font-medium">{new Date(appointment.start_time).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-gray-500">Time</p>
            <p className="font-medium">
              {new Date(appointment.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' - '}
              {new Date(appointment.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Type</p>
            <p className="font-medium">{appointment.consultation_type}</p>
          </div>
          <div>
            <p className="text-gray-500">Patient Email</p>
            <p className="font-medium">{appointment.patient?.email || '-'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Clinical Notes</h2>
          {!editingNotes && (
            <button onClick={() => setEditingNotes(true)} className="text-sm text-blue-600 hover:text-blue-800">
              Edit
            </button>
          )}
        </div>
        {editingNotes ? (
          <div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              rows={4}
              placeholder="Add clinical notes..."
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => notesMutation.mutate()}
                disabled={notesMutation.isPending}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {notesMutation.isPending ? 'Saving...' : 'Save Notes'}
              </button>
              <button
                onClick={() => { setEditingNotes(false); setNotes(appointment.notes || ''); }}
                className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600">{appointment.notes || 'No notes yet'}</p>
        )}
      </div>

      <div className="flex gap-3">
        {canConfirm && (
          <button
            onClick={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm disabled:opacity-50"
          >
            {confirmMutation.isPending ? 'Confirming...' : 'Confirm Appointment'}
          </button>
        )}
        {canJoinVideo && (
          <Link
            href={`/video/${appointment.id}`}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
          >
            Join Video Call
          </Link>
        )}
        <Link
          href={`/provider/appointments/${appointment.id}/messages`}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm"
        >
          Messages
        </Link>
      </div>
    </div>
  );
}
