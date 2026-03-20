'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

const STATUS_FILTERS = ['ALL', 'PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export default function ProviderAppointmentsPage() {
  const { currentPractice } = useAuth();
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['provider-appointments', currentPractice?.id, statusFilter],
    queryFn: async () => {
      const params: any = { limit: 50 };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const { data } = await api.get('/appointments', { params });
      return data;
    },
    enabled: !!currentPractice,
  });

  const appointments = data?.data || [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Appointments</h1>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
              statusFilter === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === 'ALL' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <p className="text-gray-500">No appointments found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {appointments.map((appt: any) => (
            <Link
              key={appt.id}
              href={`/provider/appointments/${appt.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
            >
              <div>
                <p className="font-medium">{appt.patient?.name || 'Patient'}</p>
                <p className="text-sm text-gray-500">
                  {appt.service?.name} ·{' '}
                  {new Date(appt.start_time).toLocaleDateString()} at{' '}
                  {new Date(appt.start_time).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{appt.consultation_type}</span>
                <span
                  className={`px-2 py-1 text-xs rounded-full font-medium ${
                    appt.status === 'CONFIRMED'
                      ? 'bg-green-100 text-green-700'
                      : appt.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-700'
                        : appt.status === 'COMPLETED'
                          ? 'bg-blue-100 text-blue-700'
                          : appt.status === 'CANCELLED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {appt.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
