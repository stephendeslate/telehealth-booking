'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const STATUS_FILTERS = ['ALL', 'PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export default function AdminAppointmentsPage() {
  const { currentPractice } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-appointments', currentPractice?.id, statusFilter],
    queryFn: async () => {
      const params: any = { limit: 50 };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const { data } = await api.get('/appointments', { params });
      return data;
    },
    enabled: !!currentPractice,
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => api.post(`/appointments/${id}/confirm`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-appointments'] }),
  });

  const appointments = data?.data || [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Manage Appointments</h1>

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
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Patient</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Provider</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Service</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Date</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {appointments.map((appt: any) => (
                <tr key={appt.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">{appt.patient?.name || '-'}</td>
                  <td className="px-6 py-4">{appt.provider_profile?.user?.name || '-'}</td>
                  <td className="px-6 py-4">{appt.service?.name || '-'}</td>
                  <td className="px-6 py-4">
                    {new Date(appt.start_time).toLocaleDateString()}{' '}
                    {new Date(appt.start_time).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full font-medium ${
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
                  </td>
                  <td className="px-6 py-4">
                    {appt.status === 'PENDING' && (
                      <button
                        onClick={() => confirmMutation.mutate(appt.id)}
                        disabled={confirmMutation.isPending}
                        className="text-sm text-green-600 hover:text-green-800 font-medium"
                      >
                        Approve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
