'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, currentPractice } = useAuth();

  const { data: upcomingAppointments = [] } = useQuery({
    queryKey: ['upcoming-appointments'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/appointments', {
          params: { status: 'CONFIRMED', limit: 5 },
        });
        return data.data || [];
      } catch {
        return [];
      }
    },
  });

  // Determine if user is a patient (no practice) or practice member
  const isPatient = !currentPractice;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">
        Welcome, {user?.name?.split(' ')[0]}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Upcoming Appointments</h3>
          <p className="text-3xl font-bold">{upcomingAppointments.length}</p>
        </div>

        {isPatient && (
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Book Appointment</h3>
            <p className="text-sm text-gray-600 mb-3">Find a provider and book a consultation.</p>
            <Link
              href="/book"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Browse providers &rarr;
            </Link>
          </div>
        )}

        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Messages</h3>
          <p className="text-sm text-gray-600 mb-3">View your conversations.</p>
          <Link
            href={isPatient ? '/messages' : '/provider/messages'}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Open messages &rarr;
          </Link>
        </div>
      </div>

      {upcomingAppointments.length > 0 && (
        <div className="bg-white rounded-lg border">
          <div className="px-6 py-4 border-b">
            <h2 className="font-semibold">Upcoming Appointments</h2>
          </div>
          <div className="divide-y">
            {upcomingAppointments.map((appt: any) => (
              <Link
                key={appt.id}
                href={`/appointments/${appt.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium">{appt.service?.name || 'Appointment'}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(appt.start_time).toLocaleDateString()} at{' '}
                    {new Date(appt.start_time).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded-full font-medium ${
                    appt.status === 'CONFIRMED'
                      ? 'bg-green-100 text-green-700'
                      : appt.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {appt.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
