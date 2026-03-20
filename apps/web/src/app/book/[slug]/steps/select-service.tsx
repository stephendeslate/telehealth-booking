'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface ServiceData {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price_cents: number;
  consultation_type: string;
  intake_template_id?: string;
}

interface Props {
  practiceId: string;
  providerId: string;
  onSelect: (service: ServiceData) => void;
  onBack: () => void;
}

export function SelectService({ practiceId, providerId, onSelect, onBack }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['booking-services', practiceId, providerId],
    queryFn: async () => {
      const { data } = await api.get(`/practices/${practiceId}/services`, {
        params: { provider_id: providerId },
      });
      return data.data || data || [];
    },
  });

  const services: ServiceData[] = data || [];

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Loading services...</div>;
  }

  if (services.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">No services available for this provider.</p>
        <button onClick={onBack} className="text-sm text-blue-600 hover:text-blue-800">
          ← Choose a different provider
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-3">
        {services.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s)}
            className="w-full text-left p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="font-medium">{s.name}</p>
              <p className="font-medium text-blue-600">
                {s.price_cents > 0 ? `$${(s.price_cents / 100).toFixed(2)}` : 'Free'}
              </p>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {s.duration_minutes} min · {s.consultation_type.replace('_', ' ')}
            </p>
            {s.description && (
              <p className="text-sm text-gray-400 mt-1">{s.description}</p>
            )}
          </button>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back
        </button>
      </div>
    </div>
  );
}
