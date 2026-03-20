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

interface TypingState {
  userId: string;
  isTyping: boolean;
}

interface ReadReceipt {
  messageId: string;
  readBy: string;
  readAt: string;
}

export function useMessages(appointmentId: string | null) {
  const { on, emit } = useSocket();
  const queryClient = useQueryClient();
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [readReceipts, setReadReceipts] = useState<ReadReceipt[]>([]);

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['messages', appointmentId],
    queryFn: async () => {
      if (!appointmentId) return [];
      const { data } = await api.get(`/appointments/${appointmentId}/messages`);
      return data.data || data;
    },
    enabled: !!appointmentId,
  });

  // Join appointment room for scoped events
  useEffect(() => {
    if (!appointmentId) return;
    emit('appointment:join', { appointmentId });
    return () => {
      emit('appointment:leave', { appointmentId });
    };
  }, [emit, appointmentId]);

  // Listen for new messages
  useEffect(() => {
    if (!appointmentId) return;
    const cleanup = on('message:new', (msg: Message) => {
      if (msg.appointment_id === appointmentId) {
        queryClient.invalidateQueries({ queryKey: ['messages', appointmentId] });
      }
    });
    return cleanup;
  }, [on, appointmentId, queryClient]);

  // Listen for typing indicators
  useEffect(() => {
    if (!appointmentId) return;
    const cleanup = on('typing:indicator', (data: TypingState & { appointmentId: string }) => {
      if (data.appointmentId === appointmentId) {
        setTypingUsers((prev) => ({ ...prev, [data.userId]: data.isTyping }));
      }
    });
    return cleanup;
  }, [on, appointmentId]);

  // Listen for read receipts
  useEffect(() => {
    if (!appointmentId) return;
    const cleanup = on('message:read_receipt', (receipt: ReadReceipt) => {
      setReadReceipts((prev) => [...prev, receipt]);
    });
    return cleanup;
  }, [on, appointmentId]);

  const sendMessage = useMutation({
    mutationFn: (content: string) => {
      emit('message:send', { appointmentId, content });
      return Promise.resolve();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['messages', appointmentId] }),
  });

  const markRead = useCallback(
    (messageId: string) => {
      if (!appointmentId) return;
      emit('message:read', { messageId, appointmentId });
    },
    [emit, appointmentId],
  );

  const sendTyping = useCallback(() => {
    emit('typing:start', { appointmentId });
  }, [emit, appointmentId]);

  const activeTypingUsers = Object.entries(typingUsers)
    .filter(([, isTyping]) => isTyping)
    .map(([userId]) => userId);

  return { messages, sendMessage, sendTyping, markRead, typingUsers: activeTypingUsers, readReceipts };
}
