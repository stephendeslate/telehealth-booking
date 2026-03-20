'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSocket } from './use-socket';

interface Message {
  id: string;
  appointment_id: string;
  sender_id: string;
  content: string;
  type: string;
  read_at: string | null;
  created_at: string;
  sender?: { id: string; name: string; avatar_url: string | null };
}

export function useMessages(appointmentId: string | null) {
  const { on, emit } = useSocket();
  const queryClient = useQueryClient();

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['messages', appointmentId],
    queryFn: async () => {
      if (!appointmentId) return [];
      const { data } = await api.get(`/appointments/${appointmentId}/messages`);
      return data.data || data;
    },
    enabled: !!appointmentId,
  });

  useEffect(() => {
    if (!appointmentId) return;

    const cleanup = on('message:new', (msg: Message) => {
      if (msg.appointment_id === appointmentId) {
        queryClient.invalidateQueries({ queryKey: ['messages', appointmentId] });
      }
    });
    return cleanup;
  }, [on, appointmentId, queryClient]);

  const sendMessage = useMutation({
    mutationFn: (content: string) => {
      emit('message:send', { appointmentId, content });
      return Promise.resolve();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['messages', appointmentId] }),
  });

  const sendTyping = useCallback(() => {
    emit('typing:start', { appointmentId });
  }, [emit, appointmentId]);

  return { messages, sendMessage, sendTyping };
}
