'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function ProviderProfilePage() {
  const { currentPractice } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ bio: '', qualifications: '' });
  const [message, setMessage] = useState('');

  const { data: provider, isLoading } = useQuery({
    queryKey: ['my-provider-profile', currentPractice?.id],
    queryFn: async () => {
      const { data } = await api.get(`/practices/${currentPractice!.id}/providers/me`);
      setForm({ bio: data.bio || '', qualifications: data.qualifications || '' });
      return data;
    },
    enabled: !!currentPractice,
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.patch(`/practices/${currentPractice!.id}/providers/${provider.id}`, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-provider-profile'] });
      setEditing(false);
      setMessage('Profile updated');
    },
    onError: () => setMessage('Failed to update profile'),
  });

  if (isLoading) return <div className="text-center py-8 text-gray-500">Loading...</div>;
  if (!provider) return <div className="text-center py-8 text-gray-500">Provider profile not found</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Provider Profile</h1>

      {message && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg">{message}</div>
      )}

      <div className="bg-white rounded-lg border p-6">
        {!editing ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="font-medium">{provider.user?.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Specialty</p>
              <p className="font-medium">{provider.specialty || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Bio</p>
              <p className="font-medium">{provider.bio || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Qualifications</p>
              <p className="font-medium">{provider.qualifications || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-medium">{provider.is_active ? 'Active' : 'Inactive'}</p>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Edit Profile
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Qualifications</label>
              <textarea
                value={form.qualifications}
                onChange={(e) => setForm({ ...form, qualifications: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 bg-gray-100 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
