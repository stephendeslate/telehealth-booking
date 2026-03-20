'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function AdminDashboardPage() {
  const { currentPractice } = useAuth();

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['admin-analytics', currentPractice?.id],
    queryFn: async () => {
      const { data } = await api.get(`/practices/${currentPractice!.id}/admin/analytics`);
      return data;
    },
    enabled: !!currentPractice,
  });

  const cards = [
    { label: 'Total Appointments', value: analytics?.totalAppointments ?? '-' },
    { label: 'Completed', value: analytics?.completedAppointments ?? '-' },
    { label: 'Cancelled', value: analytics?.cancelledAppointments ?? '-' },
    { label: 'No Shows', value: analytics?.noShowAppointments ?? '-' },
    { label: 'Total Patients', value: analytics?.totalPatients ?? '-' },
    { label: 'New Patients (30d)', value: analytics?.newPatients ?? '-' },
    {
      label: 'Revenue',
      value: analytics?.totalRevenue != null
        ? `$${(analytics.totalRevenue / 100).toFixed(2)}`
        : '-',
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Practice Dashboard</h1>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cards.map((card) => (
            <div key={card.label} className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="text-2xl font-bold mt-1">{card.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
