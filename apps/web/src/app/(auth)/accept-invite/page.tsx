'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, refreshUser } = useAuth();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'pending' | 'accepting' | 'success' | 'error'>('pending');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link');
      setStatus('error');
    }
  }, [token]);

  async function handleAccept() {
    if (!token) return;
    setStatus('accepting');

    try {
      await api.post(`/providers/invitations/${token}/accept`);
      await refreshUser();
      setStatus('success');
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to accept invitation');
      setStatus('error');
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
        <h2 className="text-xl font-semibold mb-2">Accept Invitation</h2>
        <p className="text-gray-600 mb-4">Please sign in to accept this invitation.</p>
        <Link
          href={`/login?redirect=/accept-invite?token=${token}`}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
      <h2 className="text-xl font-semibold mb-4">Accept Invitation</h2>

      {status === 'pending' && (
        <>
          <p className="text-gray-600 mb-6">
            You&apos;ve been invited to join a practice on MedConnect.
          </p>
          <button
            onClick={handleAccept}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Accept Invitation
          </button>
        </>
      )}

      {status === 'accepting' && (
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
      )}

      {status === 'success' && (
        <>
          <div className="text-green-500 text-4xl mb-4">&#10003;</div>
          <p className="text-gray-600">Invitation accepted! Redirecting...</p>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="text-red-500 text-4xl mb-4">&#10007;</div>
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium">
            Go to dashboard
          </Link>
        </>
      )}
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
