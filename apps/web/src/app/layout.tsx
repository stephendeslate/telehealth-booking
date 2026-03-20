import type { Metadata } from 'next';
import { Providers } from '@/lib/providers';
import { DemoBanner } from '@/components/demo-banner';
import './globals.css';

export const metadata: Metadata = {
  title: 'MedConnect - Telehealth Booking Platform',
  description: 'Book telehealth consultations with healthcare providers',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <DemoBanner />
        <Providers>
          <div id="main-content">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
