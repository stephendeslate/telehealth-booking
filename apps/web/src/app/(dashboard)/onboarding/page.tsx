'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const SPECIALTIES = [
  'General Practice',
  'Internal Medicine',
  'Pediatrics',
  'Dermatology',
  'Psychiatry',
  'Psychology',
  'Cardiology',
  'Orthopedics',
  'Neurology',
  'Endocrinology',
  'Oncology',
  'Physical Therapy',
  'Nutrition',
  'Other',
];

const STEPS = ['Practice Profile', 'Specialty', 'First Provider', 'First Service'];

export default function OnboardingPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [step, setStep] = useState(0);
  const [practiceForm, setPracticeForm] = useState({
    name: '',
    description: '',
    phone: '',
    website: '',
    address: '',
  });
  const [specialty, setSpecialty] = useState('');
  const [providerForm, setProviderForm] = useState({
    bio: '',
    qualifications: '',
  });
  const [serviceForm, setServiceForm] = useState({
    name: '',
    description: '',
    duration_minutes: 30,
    price_cents: 0,
    consultation_type: 'VIDEO',
  });
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const createPracticeMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/practices', {
        ...practiceForm,
        specialty,
      });
      return data;
    },
    onSuccess: async (data) => {
      setPracticeId(data.id);
      await refreshUser();
      setStep(2);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create practice');
    },
  });

  const updateProviderMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/practices/${practiceId}/providers/me`, {
        bio: providerForm.bio,
        qualifications: providerForm.qualifications,
        specialty,
      });
    },
    onSuccess: () => setStep(3),
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to update provider profile');
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/practices/${practiceId}/services`, serviceForm);
    },
    onSuccess: () => {
      router.push('/admin');
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create service');
    },
  });

  const isPending =
    createPracticeMutation.isPending ||
    updateProviderMutation.isPending ||
    createServiceMutation.isPending;

  return (
    <div className="max-w-xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-2">Set Up Your Practice</h1>
      <p className="text-gray-500 mb-6">Complete these steps to get your booking page live.</p>

      {/* Progress */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                i < step
                  ? 'bg-blue-600 text-white'
                  : i === step
                    ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-600'
                    : 'bg-gray-200 text-gray-500'
              }`}
            >
              {i < step ? '✓' : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-12 h-0.5 ${i < step ? 'bg-blue-600' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
      )}

      <div className="bg-white rounded-lg border p-6">
        {/* Step 0: Practice Profile */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-semibold">Practice Profile</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Practice Name *</label>
              <input
                value={practiceForm.name}
                onChange={(e) => setPracticeForm({ ...practiceForm, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="e.g., City Health Clinic"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={practiceForm.description}
                onChange={(e) => setPracticeForm({ ...practiceForm, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                rows={2}
                placeholder="Brief description of your practice"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  value={practiceForm.phone}
                  onChange={(e) => setPracticeForm({ ...practiceForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input
                  value={practiceForm.website}
                  onChange={(e) => setPracticeForm({ ...practiceForm, website: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                value={practiceForm.address}
                onChange={(e) => setPracticeForm({ ...practiceForm, address: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div className="pt-4">
              <button
                onClick={() => setStep(1)}
                disabled={!practiceForm.name.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Specialty */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-semibold">Select Your Specialty</h2>
            <div className="grid grid-cols-2 gap-2">
              {SPECIALTIES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpecialty(s)}
                  className={`p-3 rounded-lg text-sm text-left ${
                    specialty === s
                      ? 'bg-blue-50 border-blue-500 border-2 text-blue-700 font-medium'
                      : 'border hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-4">
              <button onClick={() => setStep(0)} className="text-sm text-gray-500 hover:text-gray-700">
                ← Back
              </button>
              <button
                onClick={() => createPracticeMutation.mutate()}
                disabled={!specialty || isPending}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {createPracticeMutation.isPending ? 'Creating...' : 'Create Practice'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Provider Profile */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-semibold">Your Provider Profile</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                value={providerForm.bio}
                onChange={(e) => setProviderForm({ ...providerForm, bio: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                rows={3}
                placeholder="Brief professional bio"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Qualifications</label>
              <input
                value={providerForm.qualifications}
                onChange={(e) => setProviderForm({ ...providerForm, qualifications: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="e.g., MD, Board Certified Internal Medicine"
              />
            </div>
            <div className="flex items-center justify-between pt-4">
              <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-gray-700">
                ← Back
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(3)}
                  className="px-4 py-2 bg-gray-100 rounded-lg text-sm text-gray-600 hover:bg-gray-200"
                >
                  Skip
                </button>
                <button
                  onClick={() => updateProviderMutation.mutate()}
                  disabled={isPending}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {updateProviderMutation.isPending ? 'Saving...' : 'Save & Continue'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: First Service */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-semibold">Create Your First Service</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service Name *</label>
              <input
                value={serviceForm.name}
                onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="e.g., Initial Consultation"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={serviceForm.description}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Duration (min)</label>
                <input
                  type="number"
                  value={serviceForm.duration_minutes}
                  onChange={(e) =>
                    setServiceForm({ ...serviceForm, duration_minutes: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={(serviceForm.price_cents / 100).toFixed(2)}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      price_cents: Math.round(parseFloat(e.target.value || '0') * 100),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select
                  value={serviceForm.consultation_type}
                  onChange={(e) => setServiceForm({ ...serviceForm, consultation_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="VIDEO">Video</option>
                  <option value="IN_PERSON">In Person</option>
                  <option value="PHONE">Phone</option>
                  <option value="BOTH">Video or In Person</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4">
              <button onClick={() => setStep(2)} className="text-sm text-gray-500 hover:text-gray-700">
                ← Back
              </button>
              <button
                onClick={() => createServiceMutation.mutate()}
                disabled={!serviceForm.name.trim() || isPending}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {createServiceMutation.isPending ? 'Creating...' : 'Create & Go Live'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
