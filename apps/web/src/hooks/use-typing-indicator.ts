'use client';

import { useState, useEffect } from 'react';
import { useSocket } from './use-socket';

export function useTypingIndicator(appointmentId: string | null) {
  const { on } = useSocket();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!appointmentId) return;

    const cleanup1 = on('typing:started', (data: { appointmentId: string; userId: string; userName: string }) => {
      if (data.appointmentId === appointmentId) {
        setTypingUsers((prev) =>
          prev.includes(data.userName) ? prev : [...prev, data.userName],
        );
      }
    });

    const cleanup2 = on('typing:stopped', (data: { appointmentId: string; userId: string; userName: string }) => {
      if (data.appointmentId === appointmentId) {
        setTypingUsers((prev) => prev.filter((n) => n !== data.userName));
      }
    });

    return () => {
      cleanup1();
      cleanup2();
    };
  }, [on, appointmentId]);

  return { typingUsers, isTyping: typingUsers.length > 0 };
}
