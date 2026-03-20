'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import type { BookingState } from '../page';

interface Props {
  booking: BookingState;
  onSubmit: (info: Partial<BookingState>) => void;
  onBack: () => void;
}

export function PatientInfo({ booking, onSubmit, onBack }: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<'logged-in' | 'guest'>(user ? 'logged-in' : 'guest');
  const [name, setName] = useState(booking.patientName || user?.name || '');
  const [email, setEmail] = useState(booking.patientEmail || user?.email || '');
  const [phone, setPhone] = useState(booking.patientPhone || '');

  const handleSubmit = () => {
    if (mode === 'logged-in' && user) {
      onSubmit({
        patientName: user.name,
        patientEmail: user.email,
        patientPhone: '',
        isGuest: false,
      });
    } else {
      onSubmit({
        patientName: name,
        patientEmail: email,
        patientPhone: phone,
        isGuest: true,
      });
    }
  };

  const isValid = mode === 'logged-in' ? !!user : (name.trim() && email.trim());

  return (
    <div>
      {/* Mode toggle */}
      {user ? (
        <div className="mb-6">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setMode('logged-in')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                mode === 'logged-in'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Book as {user.name}
            </button>
            <button
              onClick={() => setMode('guest')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                mode === 'guest'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Book for someone else
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 mb-4">
          Enter your details below, or{' '}
          <a href="/login" className="text-blue-600 hover:text-blue-800">
            sign in
          </a>{' '}
          to book with your account.
        </p>
      )}

      {mode === 'logged-in' && user ? (
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="font-medium">{user.name}</p>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="(555) 123-4567"
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-6 pt-4 border-t">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
