'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function AdminSettingsPage() {
  const { currentPractice } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    phone: '',
    website: '',
    address: '',
    cancellation_policy_hours: 24,
    approval_mode: 'AUTO_CONFIRM',
  });

  const { data: practice, isLoading } = useQuery({
    queryKey: ['practice-settings', currentPractice?.id],
    queryFn: async () => {
      const { data } = await api.get(`/practices/${currentPractice!.id}`);
      return data;
    },
    enabled: !!currentPractice,
  });

  useEffect(() => {
    if (practice) {
      setForm({
        name: practice.name || '',
        description: practice.description || '',
        phone: practice.phone || '',
        website: practice.website || '',
        address: practice.address || '',
        cancellation_policy_hours: practice.settings?.cancellation_policy_hours ?? 24,
        approval_mode: practice.settings?.approval_mode ?? 'AUTO_CONFIRM',
      });
    }
  }, [practice]);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.patch(`/practices/${currentPractice!.id}`, {
        name: form.name,
        description: form.description,
        phone: form.phone,
        website: form.website,
        address: form.address,
        settings: {
          cancellation_policy_hours: form.cancellation_policy_hours,
          approval_mode: form.approval_mode,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practice-settings'] });
      setMessage('Settings saved');
    },
    onError: () => setMessage('Failed to save settings'),
  });

  if (isLoading) return <div className="text-center py-8 text-gray-500">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Practice Settings</h1>

      {message && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg">{message}</div>
      )}

      <div className="bg-white rounded-lg border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Practice Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <input
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>

        <hr />

        <h2 className="font-semibold">Booking Policy</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cancellation Window (hours)
            </label>
            <input
              type="number"
              value={form.cancellation_policy_hours}
              onChange={(e) =>
                setForm({ ...form, cancellation_policy_hours: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Approval Mode</label>
            <select
              value={form.approval_mode}
              onChange={(e) => setForm({ ...form, approval_mode: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="AUTO_CONFIRM">Auto Confirm</option>
              <option value="MANUAL_APPROVAL">Manual Approval</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
