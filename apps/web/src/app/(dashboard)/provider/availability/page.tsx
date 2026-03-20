'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export default function AvailabilityPage() {
  const { currentPractice } = useAuth();
  const queryClient = useQueryClient();
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');

  const { data: provider } = useQuery({
    queryKey: ['my-provider-profile', currentPractice?.id],
    queryFn: async () => {
      const { data } = await api.get(`/practices/${currentPractice!.id}/providers/me`);
      return data;
    },
    enabled: !!currentPractice,
  });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['availability-rules', provider?.id],
    queryFn: async () => {
      const { data } = await api.get(
        `/practices/${currentPractice!.id}/providers/${provider.id}/availability`
      );
      return data.data || data || [];
    },
    enabled: !!provider?.id,
  });

  const saveMutation = useMutation({
    mutationFn: (rule: { day_of_week: string; start_time: string; end_time: string }) =>
      api.post(`/practices/${currentPractice!.id}/providers/${provider.id}/availability`, rule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-rules'] });
      setEditingDay(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) =>
      api.delete(`/practices/${currentPractice!.id}/providers/${provider.id}/availability/${ruleId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['availability-rules'] }),
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Availability</h1>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {DAYS.map((day) => {
            const dayRules = (rules as any[]).filter((r: any) => r.day_of_week === day);
            return (
              <div key={day} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium capitalize">{day.toLowerCase()}</p>
                    {dayRules.length > 0 ? (
                      <div className="mt-1 space-y-1">
                        {dayRules.map((r: any) => (
                          <div key={r.id} className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">
                              {r.start_time} - {r.end_time}
                            </span>
                            <button
                              onClick={() => deleteMutation.mutate(r.id)}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 mt-1">Not available</p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setEditingDay(day);
                      setStartTime('09:00');
                      setEndTime('17:00');
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Add Hours
                  </button>
                </div>

                {editingDay === day && (
                  <div className="mt-3 flex items-center gap-3">
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="px-2 py-1 border rounded text-sm"
                    />
                    <span className="text-gray-400">to</span>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="px-2 py-1 border rounded text-sm"
                    />
                    <button
                      onClick={() =>
                        saveMutation.mutate({ day_of_week: day, start_time: startTime, end_time: endTime })
                      }
                      disabled={saveMutation.isPending}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingDay(null)}
                      className="px-3 py-1 bg-gray-100 rounded text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
