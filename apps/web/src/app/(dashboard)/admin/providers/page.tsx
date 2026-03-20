'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function AdminProvidersPage() {
  const { currentPractice } = useAuth();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('PROVIDER');
  const [inviteMessage, setInviteMessage] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-providers', currentPractice?.id],
    queryFn: async () => {
      const { data } = await api.get(`/practices/${currentPractice!.id}/providers`);
      return data.data || data || [];
    },
    enabled: !!currentPractice,
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      api.post(`/practices/${currentPractice!.id}/invitations`, {
        email: inviteEmail,
        role: inviteRole,
      }),
    onSuccess: () => {
      setShowInvite(false);
      setInviteEmail('');
      setInviteMessage('Invitation sent!');
    },
    onError: () => setInviteMessage('Failed to send invitation'),
  });

  const providers = data || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Providers</h1>
        <button
          onClick={() => setShowInvite(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          Invite Provider
        </button>
      </div>

      {inviteMessage && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg">{inviteMessage}</div>
      )}

      {showInvite && (
        <div className="mb-6 bg-white rounded-lg border p-4">
          <h3 className="font-medium mb-3">Invite a Provider</h3>
          <div className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email address"
              className="flex-1 px-3 py-2 border rounded-lg text-sm"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="PROVIDER">Provider</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button
              onClick={() => inviteMutation.mutate()}
              disabled={inviteMutation.isPending || !inviteEmail}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              Send
            </button>
            <button
              onClick={() => setShowInvite(false)}
              className="px-4 py-2 bg-gray-100 rounded-lg text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : providers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <p className="text-gray-500">No providers yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {providers.map((p: any) => (
            <div key={p.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{p.user?.name || 'Unknown'}</p>
                <p className="text-sm text-gray-500">
                  {p.specialty || 'No specialty'} · {p.user?.email}
                </p>
              </div>
              <span
                className={`px-2 py-1 text-xs rounded-full font-medium ${
                  p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {p.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
