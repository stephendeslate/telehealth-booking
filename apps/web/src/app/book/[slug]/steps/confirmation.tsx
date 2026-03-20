'use client';

import Link from 'next/link';
import type { BookingState } from '../page';

interface Props {
  booking: BookingState;
  practiceName: string;
}

export function Confirmation({ booking, practiceName }: Props) {
  const startTime = booking.startTime ? new Date(booking.startTime) : null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg border p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold mb-2">Booking Confirmed!</h1>
        <p className="text-gray-500 mb-6">
          Your appointment has been booked with {practiceName}.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Provider</span>
            <span className="font-medium">{booking.providerName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Service</span>
            <span className="font-medium">{booking.serviceName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Date</span>
            <span className="font-medium">
              {startTime?.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Time</span>
            <span className="font-medium">
              {startTime?.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </div>
          {booking.consultationType && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Type</span>
              <span className="font-medium">{booking.consultationType.replace('_', ' ')}</span>
            </div>
          )}
        </div>

        <p className="text-sm text-gray-400 mb-6">
          A confirmation email has been sent to{' '}
          <span className="font-medium text-gray-600">{booking.patientEmail || 'your email'}</span>.
        </p>

        <div className="space-y-2">
          {!booking.isGuest && (
            <Link
              href="/appointments"
              className="block w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              View My Appointments
            </Link>
          )}
          <Link
            href="/"
            className="block w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
