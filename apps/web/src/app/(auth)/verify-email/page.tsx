'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }

    api
      .post('/auth/verify-email', { token })
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
      {status === 'verifying' && (
        <>
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Verifying your email...</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="text-green-500 text-4xl mb-4">&#10003;</div>
          <h2 className="text-xl font-semibold mb-2">Email Verified</h2>
          <p className="text-gray-600 mb-4">Your email has been verified successfully.</p>
          <Link href="/login" className="text-blue-600 hover:text-blue-800 font-medium">
            Continue to sign in
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="text-red-500 text-4xl mb-4">&#10007;</div>
          <h2 className="text-xl font-semibold mb-2">Verification Failed</h2>
          <p className="text-gray-600 mb-4">
            The verification link is invalid or has expired.
          </p>
          <Link href="/login" className="text-blue-600 hover:text-blue-800 font-medium">
            Back to sign in
          </Link>
        </>
      )}
    </div>
  );
}
