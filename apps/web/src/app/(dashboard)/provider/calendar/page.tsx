'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function CalendarPage() {
  const { currentPractice } = useAuth();
  const queryClient = useQueryClient();

  const { data: provider } = useQuery({
    queryKey: ['my-provider-profile', currentPractice?.id],
    queryFn: async () => {
      const { data } = await api.get(`/practices/${currentPractice!.id}/providers/me`);
      return data;
    },
    enabled: !!currentPractice,
  });

  const { data: calendarStatus, isLoading } = useQuery({
    queryKey: ['calendar-status', provider?.id],
    queryFn: async () => {
      const { data } = await api.get(
        `/practices/${currentPractice!.id}/providers/${provider.id}/calendar/status`
      );
      return data;
    },
    enabled: !!provider?.id,
  });

  const connectMutation = useMutation({
    mutationFn: (calendarProvider: string) =>
      api.post(`/practices/${currentPractice!.id}/providers/${provider.id}/calendar/connect`, {
        provider: calendarProvider,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-status'] }),
  });

  const disconnectMutation = useMutation({
    mutationFn: () =>
      api.delete(`/practices/${currentPractice!.id}/providers/${provider.id}/calendar/disconnect`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-status'] }),
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Calendar Integration</h1>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : (
        <div className="space-y-4">
          {calendarStatus?.connected ? (
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Connected to {calendarStatus.provider}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Calendar ID: {calendarStatus.calendar_id}
                  </p>
                  <p className="text-sm text-gray-500">
                    Last synced: {calendarStatus.last_synced
                      ? new Date(calendarStatus.last_synced).toLocaleString()
                      : 'Never'}
                  </p>
                </div>
                <span className="px-2 py-1 text-xs rounded-full font-medium bg-green-100 text-green-700">
                  Active
                </span>
              </div>
              <button
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="mt-4 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg border p-6">
              <p className="text-gray-500 mb-4">
                Connect your calendar to automatically sync availability and appointments.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => connectMutation.mutate('GOOGLE')}
                  disabled={connectMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
                >
                  Connect Google Calendar
                </button>
                <button
                  onClick={() => connectMutation.mutate('OUTLOOK')}
                  disabled={connectMutation.isPending}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium disabled:opacity-50"
                >
                  Connect Outlook
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
