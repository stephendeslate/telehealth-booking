import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MedConnect - Telehealth Booking Platform',
  description: 'Book telehealth consultations with healthcare providers',
};

function DemoBanner() {
  return (
    <div className="bg-amber-500 text-black text-center py-1 text-sm font-medium">
      Demo Environment — All patient data is synthetic (Synthea-generated). Not for clinical use.
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}
