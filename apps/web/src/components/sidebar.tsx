'use client';

import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const patientNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/appointments', label: 'Appointments', icon: '📅' },
  { href: '/messages', label: 'Messages', icon: '💬' },
  { href: '/profile', label: 'Profile', icon: '👤' },
  { href: '/payments', label: 'Payments', icon: '💳' },
];

const providerNav: NavItem[] = [
  { href: '/provider', label: 'Today', icon: '📋' },
  { href: '/provider/appointments', label: 'Appointments', icon: '📅' },
  { href: '/provider/messages', label: 'Messages', icon: '💬' },
  { href: '/provider/availability', label: 'Availability', icon: '🕐' },
  { href: '/provider/profile', label: 'Profile', icon: '👤' },
];

const adminNav: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: '📊' },
  { href: '/admin/appointments', label: 'Appointments', icon: '📅' },
  { href: '/admin/providers', label: 'Providers', icon: '👥' },
  { href: '/admin/services', label: 'Services', icon: '🏥' },
  { href: '/admin/patients', label: 'Patients', icon: '🧑' },
  { href: '/admin/payments', label: 'Payments', icon: '💳' },
  { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
];

export function Sidebar() {
  const { currentPractice } = useAuth();
  const pathname = usePathname();

  const role = currentPractice?.role;
  let nav: NavItem[];

  if (role === 'OWNER' || role === 'ADMIN') {
    nav = adminNav;
  } else if (role === 'PROVIDER') {
    nav = providerNav;
  } else {
    nav = patientNav;
  }

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <Link href="/" className="text-xl font-bold">
          MedConnect
        </Link>
        {currentPractice && (
          <p className="text-xs text-gray-400 mt-1 truncate">{currentPractice.name}</p>
        )}
      </div>

      <nav className="flex-1 p-2">
        {nav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
