'use client';

export default function ComplianceRoadmapPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Compliance Roadmap</h1>
        <p className="text-gray-500 mb-8">
          MedConnect&apos;s path toward healthcare regulatory compliance. This is a demonstration
          platform — no real patient data is processed.
        </p>

        <div className="space-y-6">
          {/* HIPAA */}
          <section className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                In Progress
              </span>
              <h2 className="text-lg font-semibold">HIPAA Compliance</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Health Insurance Portability and Accountability Act requirements for protected health
              information (PHI).
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>Encryption at rest (AES-256) and in transit (TLS 1.3)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>Role-based access control with practice-level isolation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>Append-only audit logging for all PHI access</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>Row-Level Security (RLS) preventing cross-tenant data access</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">○</span>
                <span>BAA execution with cloud infrastructure providers</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">○</span>
                <span>BAA with Twilio, Stripe, and email service providers</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">○</span>
                <span>Formal risk assessment and security policies documentation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">○</span>
                <span>Breach notification procedures</span>
              </li>
            </ul>
          </section>

          {/* SOC 2 */}
          <section className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                Planned
              </span>
              <h2 className="text-lg font-semibold">SOC 2 Type II</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Service Organization Control audit for security, availability, and confidentiality.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>Infrastructure-as-code for reproducible deployments</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>Automated CI/CD pipeline with security scanning</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">○</span>
                <span>Formal change management procedures</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">○</span>
                <span>Incident response plan</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">○</span>
                <span>Third-party penetration testing</span>
              </li>
            </ul>
          </section>

          {/* GDPR */}
          <section className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                In Progress
              </span>
              <h2 className="text-lg font-semibold">GDPR</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              General Data Protection Regulation requirements for EU patient data.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>Explicit consent collection with versioned records</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>Data export (right to portability) via patient data export</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>Purpose-limited data collection</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">○</span>
                <span>Right to erasure (account deletion workflow)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">○</span>
                <span>Data Processing Agreement (DPA) templates</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">○</span>
                <span>Cookie consent management</span>
              </li>
            </ul>
          </section>

          {/* Accessibility */}
          <section className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                In Progress
              </span>
              <h2 className="text-lg font-semibold">WCAG 2.1 AA</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Web Content Accessibility Guidelines for users with disabilities.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>Semantic HTML with ARIA landmarks</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>Keyboard navigation support</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>Minimum 4.5:1 color contrast ratios</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">○</span>
                <span>Screen reader optimization and testing</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">○</span>
                <span>Reduced motion support</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">○</span>
                <span>Automated axe-core integration testing</span>
              </li>
            </ul>
          </section>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Note:</strong> MedConnect is a demonstration platform using synthetic patient
            data (Synthea). No real PHI is stored or processed. The compliance items above represent
            the technical foundations that would be required for a production deployment.
          </p>
        </div>
      </div>
    </div>
  );
}
