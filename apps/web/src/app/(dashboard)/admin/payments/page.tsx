'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function AdminPaymentsPage() {
  const { currentPractice } = useAuth();
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payments', currentPractice?.id, statusFilter],
    queryFn: async () => {
      const params: any = { limit: 50 };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const { data } = await api.get(`/practices/${currentPractice!.id}/admin/payments`, { params });
      return data.data || data || [];
    },
    enabled: !!currentPractice,
  });

  const payments = data || [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Payments</h1>

      <div className="flex gap-2 mb-4">
        {['ALL', 'SUCCEEDED', 'PENDING', 'REFUNDED', 'FAILED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              statusFilter === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === 'ALL' ? 'All' : s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : payments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <p className="text-gray-500">No payments found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Date</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Patient</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Service</th>
                <th className="text-right px-6 py-3 font-medium text-gray-500">Amount</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">{p.appointment?.patient?.name || '-'}</td>
                  <td className="px-6 py-4">{p.appointment?.service?.name || '-'}</td>
                  <td className="px-6 py-4 text-right font-medium">
                    ${(p.amount / 100).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        p.status === 'SUCCEEDED'
                          ? 'bg-green-100 text-green-700'
                          : p.status === 'REFUNDED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {p.status}
                    </span>
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
