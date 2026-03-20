'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useMessages } from '@/hooks/use-messages';
import { useTypingIndicator } from '@/hooks/use-typing-indicator';
import { useAuth } from '@/lib/auth';

export default function MessagesPage() {
  const { user } = useAuth();
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const { messages, sendMessage, sendTyping } = useMessages(selectedAppointmentId);
  const { typingUsers, isTyping } = useTypingIndicator(selectedAppointmentId);

  const { data: appointments = [] } = useQuery({
    queryKey: ['message-appointments'],
    queryFn: async () => {
      const { data } = await api.get('/appointments', {
        params: { limit: 50 },
      });
      return (data.data || []).filter(
        (a: any) => !['CANCELLED', 'NO_SHOW'].includes(a.status),
      );
    },
  });

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMessage.mutate(newMessage);
    setNewMessage('');
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-lg border overflow-hidden">
      {/* Conversation list */}
      <div className="w-80 border-r overflow-y-auto">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Messages</h2>
        </div>
        {appointments.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No conversations</p>
        ) : (
          <div className="divide-y">
            {appointments.map((appt: any) => (
              <button
                key={appt.id}
                onClick={() => setSelectedAppointmentId(appt.id)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${
                  selectedAppointmentId === appt.id ? 'bg-blue-50' : ''
                }`}
              >
                <p className="text-sm font-medium truncate">
                  {appt.service?.name || 'Appointment'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(appt.start_time).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {!selectedAppointmentId ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Select a conversation
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => {
                const isOwn = msg.sender_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs rounded-lg px-4 py-2 ${
                        msg.type === 'SYSTEM'
                          ? 'bg-gray-100 text-gray-500 text-xs text-center max-w-full'
                          : isOwn
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {!isOwn && msg.type !== 'SYSTEM' && (
                        <p className="text-xs font-medium mb-0.5 opacity-70">
                          {msg.sender?.name}
                        </p>
                      )}
                      <p className="text-sm">{msg.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          isOwn ? 'text-blue-200' : 'text-gray-400'
                        }`}
                      >
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
              {isTyping && (
                <p className="text-xs text-gray-400 italic">
                  {typingUsers.join(', ')} typing...
                </p>
              )}
            </div>

            <form onSubmit={handleSend} className="border-t p-3 flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  sendTyping();
                }}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Send
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
