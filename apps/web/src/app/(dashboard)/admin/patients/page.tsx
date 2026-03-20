'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function AdminPatientsPage() {
  const { currentPractice } = useAuth();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-patients', currentPractice?.id, search],
    queryFn: async () => {
      const params: any = { limit: 50 };
      if (search) params.search = search;
      const { data } = await api.get(`/practices/${currentPractice!.id}/admin/patients`, { params });
      return data.data || data || [];
    },
    enabled: !!currentPractice,
  });

  const patients = data || [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Patients</h1>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full max-w-md px-3 py-2 border rounded-lg text-sm"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : patients.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <p className="text-gray-500">No patients found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {patients.map((p: any) => (
            <div key={p.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-gray-500">{p.email}</p>
              </div>
              <p className="text-sm text-gray-400">
                Joined {new Date(p.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
