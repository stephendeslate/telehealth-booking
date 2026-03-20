'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Props {
  templateId: string;
  onSubmit: (responses: Record<string, any>) => void;
  onBack: () => void;
}

interface IntakeField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'number' | 'date';
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

export function IntakeForm({ templateId, onSubmit, onBack }: Props) {
  const [responses, setResponses] = useState<Record<string, any>>({});

  const { data: template, isLoading } = useQuery({
    queryKey: ['intake-template', templateId],
    queryFn: async () => {
      const { data } = await api.get(`/intake-templates/${templateId}`);
      return data;
    },
  });

  const fields: IntakeField[] = template?.fields || [];

  const updateField = (id: string, value: any) => {
    setResponses((prev) => ({ ...prev, [id]: value }));
  };

  const isValid = fields
    .filter((f) => f.required)
    .every((f) => {
      const val = responses[f.id];
      return val !== undefined && val !== '' && val !== null;
    });

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Loading intake form...</div>;
  }

  if (fields.length === 0) {
    onSubmit({});
    return null;
  }

  return (
    <div>
      {template?.name && (
        <p className="text-sm text-gray-500 mb-4">{template.name}</p>
      )}

      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>

            {field.type === 'text' && (
              <input
                value={responses[field.id] || ''}
                onChange={(e) => updateField(field.id, e.target.value)}
                placeholder={field.placeholder}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            )}

            {field.type === 'textarea' && (
              <textarea
                value={responses[field.id] || ''}
                onChange={(e) => updateField(field.id, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            )}

            {field.type === 'number' && (
              <input
                type="number"
                value={responses[field.id] || ''}
                onChange={(e) => updateField(field.id, e.target.value)}
                placeholder={field.placeholder}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            )}

            {field.type === 'date' && (
              <input
                type="date"
                value={responses[field.id] || ''}
                onChange={(e) => updateField(field.id, e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            )}

            {field.type === 'select' && (
              <select
                value={responses[field.id] || ''}
                onChange={(e) => updateField(field.id, e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">Select...</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}

            {field.type === 'checkbox' && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!responses[field.id]}
                  onChange={(e) => updateField(field.id, e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-600">{field.placeholder || 'Yes'}</span>
              </label>
            )}

            {field.type === 'radio' && field.options && (
              <div className="space-y-2">
                {field.options.map((opt) => (
                  <label key={opt} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={field.id}
                      checked={responses[field.id] === opt}
                      onChange={() => updateField(field.id, opt)}
                    />
                    <span className="text-sm text-gray-600">{opt}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-6 pt-4 border-t">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => onSubmit({})}
            className="px-4 py-2 bg-gray-100 rounded-lg text-sm text-gray-600 hover:bg-gray-200"
          >
            Skip for now
          </button>
          <button
            onClick={() => onSubmit(responses)}
            disabled={!isValid}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
