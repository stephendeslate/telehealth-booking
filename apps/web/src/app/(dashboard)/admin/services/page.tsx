'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function AdminServicesPage() {
  const { currentPractice } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    duration_minutes: 30,
    price_cents: 0,
    consultation_type: 'VIDEO',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-services', currentPractice?.id],
    queryFn: async () => {
      const { data } = await api.get(`/practices/${currentPractice!.id}/services`);
      return data.data || data || [];
    },
    enabled: !!currentPractice,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post(`/practices/${currentPractice!.id}/services`, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.patch(`/practices/${currentPractice!.id}/services/${editingId}`, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/practices/${currentPractice!.id}/services/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-services'] }),
  });

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({ name: '', description: '', duration_minutes: 30, price_cents: 0, consultation_type: 'VIDEO' });
  }

  function startEdit(service: any) {
    setForm({
      name: service.name,
      description: service.description || '',
      duration_minutes: service.duration_minutes,
      price_cents: service.price_cents,
      consultation_type: service.consultation_type,
    });
    setEditingId(service.id);
    setShowForm(true);
  }

  const services = data || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Services</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          Add Service
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-white rounded-lg border p-4">
          <h3 className="font-medium mb-3">{editingId ? 'Edit Service' : 'New Service'}</h3>
          <div className="space-y-3">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Service name"
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description"
              className="w-full px-3 py-2 border rounded-lg text-sm"
              rows={2}
            />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Duration (min)</label>
                <input
                  type="number"
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={(form.price_cents / 100).toFixed(2)}
                  onChange={(e) => setForm({ ...form, price_cents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select
                  value={form.consultation_type}
                  onChange={(e) => setForm({ ...form, consultation_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="VIDEO">Video</option>
                  <option value="IN_PERSON">In Person</option>
                  <option value="PHONE">Phone</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => editingId ? updateMutation.mutate() : createMutation.mutate()}
                disabled={createMutation.isPending || updateMutation.isPending || !form.name}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {editingId ? 'Update' : 'Create'}
              </button>
              <button onClick={resetForm} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : services.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <p className="text-gray-500">No services configured</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {services.map((s: any) => (
            <div key={s.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-gray-500">
                  {s.duration_minutes}min · ${(s.price_cents / 100).toFixed(2)} · {s.consultation_type}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(s)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteMutation.mutate(s.id)}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
