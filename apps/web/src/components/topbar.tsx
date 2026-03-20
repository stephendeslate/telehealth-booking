'use client';

import { useAuth } from '@/lib/auth';
import { NotificationBell } from './notification-bell';
import Link from 'next/link';

export function Topbar() {
  const { user, practices, currentPractice, setCurrentPractice, logout } = useAuth();

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        {practices.length > 1 && (
          <select
            value={currentPractice?.id || ''}
            onChange={(e) => {
              const p = practices.find((pr) => pr.id === e.target.value);
              setCurrentPractice(p || null);
            }}
            className="text-sm border border-gray-300 rounded-md px-2 py-1"
          >
            {practices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />

        <div className="relative group">
          <button className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <span className="hidden md:inline">{user?.name}</span>
          </button>

          <div className="hidden group-hover:block absolute right-0 mt-1 w-48 bg-white border rounded-lg shadow-lg z-50">
            <Link
              href="/profile"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Profile
            </Link>
            <button
              onClick={() => {
                logout();
                window.location.href = '/login';
              }}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
