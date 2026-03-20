'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Props {
  practiceId: string;
  onSelect: (id: string, name: string) => void;
}

export function SelectProvider({ practiceId, onSelect }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['booking-providers', practiceId],
    queryFn: async () => {
      const { data } = await api.get(`/practices/${practiceId}/providers`);
      return data.data || data || [];
    },
  });

  const providers = data || [];

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Loading providers...</div>;
  }

  if (providers.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No providers available at this practice.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {providers.map((p: any) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id, p.user?.name || p.name || 'Unknown')}
          className="w-full text-left p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
        >
          <p className="font-medium">{p.user?.name || p.name || 'Unknown'}</p>
          {p.specialty && (
            <p className="text-sm text-gray-500 mt-0.5">{p.specialty}</p>
          )}
          {p.bio && (
            <p className="text-sm text-gray-400 mt-1 line-clamp-2">{p.bio}</p>
          )}
        </button>
      ))}
    </div>
  );
}
