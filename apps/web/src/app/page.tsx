'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-600">MedConnect</h1>
          <nav aria-label="Main navigation">
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero section */}
        <section className="bg-gradient-to-b from-blue-50 to-white py-20">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-4xl font-bold mb-4">
              Modern Telehealth Booking for Healthcare Practices
            </h2>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              Streamline patient scheduling, video consultations, and practice management — all in
              one platform built for healthcare providers.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/register"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                Start Your Practice
              </Link>
              <Link
                href="/book/demo-practice"
                className="px-6 py-3 bg-white border text-gray-700 rounded-lg font-medium hover:bg-gray-50"
              >
                Try Demo Booking
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4">
            <h3 className="text-2xl font-bold text-center mb-12">Everything Your Practice Needs</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white rounded-lg border p-6">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h4 className="font-semibold mb-2">Online Booking</h4>
                <p className="text-sm text-gray-600">
                  Patients book appointments directly from your practice page. Automated slot
                  management prevents double-booking.
                </p>
              </div>
              <div className="bg-white rounded-lg border p-6">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h4 className="font-semibold mb-2">Video Consultations</h4>
                <p className="text-sm text-gray-600">
                  HIPAA-ready video calls with waiting rooms, screen sharing, and automatic session
                  management.
                </p>
              </div>
              <div className="bg-white rounded-lg border p-6">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h4 className="font-semibold mb-2">Integrated Payments</h4>
                <p className="text-sm text-gray-600">
                  Accept payments at booking via Stripe. Automatic refunds on cancellation with
                  configurable policies.
                </p>
              </div>
              <div className="bg-white rounded-lg border p-6">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h4 className="font-semibold mb-2">Intake Forms</h4>
                <p className="text-sm text-gray-600">
                  Customizable intake forms sent before appointments. Collect patient history, consent,
                  and insurance info.
                </p>
              </div>
              <div className="bg-white rounded-lg border p-6">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h4 className="font-semibold mb-2">Secure Messaging</h4>
                <p className="text-sm text-gray-600">
                  Real-time messaging between patients and providers with read receipts and offline
                  email notifications.
                </p>
              </div>
              <div className="bg-white rounded-lg border p-6">
                <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h4 className="font-semibold mb-2">Multi-Tenant</h4>
                <p className="text-sm text-gray-600">
                  Each practice operates independently with its own providers, services, patients,
                  and settings — fully isolated.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Demo practices */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h3 className="text-2xl font-bold mb-3">Try the Demo</h3>
            <p className="text-gray-600 mb-8">
              Explore MedConnect with synthetic patient data. No real health information is used.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { name: 'City Health Clinic', slug: 'city-health-clinic', specialty: 'General Practice' },
                { name: 'Mind & Body Wellness', slug: 'mind-body-wellness', specialty: 'Psychiatry' },
                { name: 'Peak Performance PT', slug: 'peak-performance-pt', specialty: 'Physical Therapy' },
              ].map((practice) => (
                <Link
                  key={practice.slug}
                  href={`/book/${practice.slug}`}
                  className="bg-white rounded-lg border p-6 hover:border-blue-500 hover:shadow-sm transition-all text-left"
                >
                  <p className="font-semibold mb-1">{practice.name}</p>
                  <p className="text-sm text-gray-500">{practice.specialty}</p>
                  <p className="text-xs text-blue-600 mt-3 font-medium">Book an appointment →</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <h3 className="text-2xl font-bold mb-3">Ready to modernize your practice?</h3>
            <p className="text-gray-600 mb-6">
              Set up your practice in minutes. Start accepting online bookings today.
            </p>
            <Link
              href="/register"
              className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Create Your Practice
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between text-sm text-gray-500">
          <p>MedConnect — A portfolio project by SJD Labs, LLC</p>
          <div className="flex gap-6">
            <Link href="/compliance-roadmap" className="hover:text-gray-700">
              Compliance
            </Link>
            <Link href="/login" className="hover:text-gray-700">
              Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
