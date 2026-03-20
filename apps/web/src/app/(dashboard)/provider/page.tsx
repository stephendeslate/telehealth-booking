'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

export default function ProviderDashboardPage() {
  const { currentPractice } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['provider-today', currentPractice?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await api.get('/appointments', {
        params: { date: today, limit: 50 },
      });
      return data;
    },
    enabled: !!currentPractice,
  });

  const appointments = data?.data || [];
  const now = new Date();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Today&apos;s Schedule</h1>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <p className="text-gray-500">No appointments scheduled for today</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt: any) => {
            const start = new Date(appt.start_time);
            const end = new Date(appt.end_time);
            const isPast = end < now;
            const isCurrent = start <= now && end >= now;

            return (
              <Link
                key={appt.id}
                href={`/provider/appointments/${appt.id}`}
                className={`block bg-white rounded-lg border p-4 hover:bg-gray-50 ${
                  isCurrent ? 'border-blue-500 ring-1 ring-blue-500' : ''
                } ${isPast ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-mono text-gray-500 w-28">
                      {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' - '}
                      {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div>
                      <p className="font-medium">{appt.patient?.name || 'Patient'}</p>
                      <p className="text-sm text-gray-500">{appt.service?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{appt.consultation_type}</span>
                    <span
                      className={`px-2 py-1 text-xs rounded-full font-medium ${
                        appt.status === 'CONFIRMED'
                          ? 'bg-green-100 text-green-700'
                          : appt.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-700'
                            : appt.status === 'COMPLETED'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {appt.status}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
