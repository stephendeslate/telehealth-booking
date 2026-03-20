'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type RoomStatus = 'connecting' | 'waiting' | 'in-call' | 'ended' | 'error';

export default function VideoConsultationPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [roomStatus, setRoomStatus] = useState<RoomStatus>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const { data: appointment } = useQuery({
    queryKey: ['video-appointment', appointmentId],
    queryFn: async () => {
      const { data } = await api.get(`/appointments/${appointmentId}`);
      return data;
    },
  });

  const { data: videoToken } = useQuery({
    queryKey: ['video-token', appointmentId],
    queryFn: async () => {
      const { data } = await api.post(`/video/rooms/${appointmentId}/token`);
      return data;
    },
    enabled: !!appointment && ['CONFIRMED', 'IN_PROGRESS'].includes(appointment.status),
  });

  // Simulate connection flow
  useEffect(() => {
    if (videoToken) {
      setRoomStatus('waiting');
      // In production, connect to Twilio here using the token
      // For demo, simulate connection after a brief delay
      const timer = setTimeout(() => setRoomStatus('in-call'), 2000);
      return () => clearTimeout(timer);
    }
  }, [videoToken]);

  // Elapsed time counter
  useEffect(() => {
    if (roomStatus !== 'in-call') return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [roomStatus]);

  const endCallMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/video/rooms/${appointmentId}/disconnect`);
    },
    onSuccess: () => {
      setRoomStatus('ended');
    },
    onError: () => {
      setRoomStatus('ended');
    },
  });

  const handleEndCall = useCallback(() => {
    endCallMutation.mutate();
  }, [endCallMutation]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  if (!appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <p>Loading appointment...</p>
      </div>
    );
  }

  if (!['CONFIRMED', 'IN_PROGRESS'].includes(appointment.status)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2">Video Not Available</h1>
          <p className="text-gray-400 mb-4">
            This appointment is not currently active for video consultation.
          </p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-700 rounded-lg text-sm hover:bg-gray-600"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (roomStatus === 'ended') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">Call Ended</h1>
          <p className="text-gray-400 mb-1">Duration: {formatTime(elapsedSeconds)}</p>
          <p className="text-gray-500 text-sm mb-6">Thank you for your consultation.</p>
          <button
            onClick={() => router.push('/appointments')}
            className="px-6 py-2 bg-blue-600 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Back to Appointments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800/50">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${roomStatus === 'in-call' ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`} />
          <span className="text-sm font-medium">
            {appointment.service?.name || 'Consultation'}
          </span>
          {roomStatus === 'in-call' && (
            <span className="text-xs text-gray-400">{formatTime(elapsedSeconds)}</span>
          )}
        </div>
        <div className="text-sm text-gray-400">
          {appointment.provider?.user?.name || 'Provider'} &amp; {appointment.patient?.name || 'Patient'}
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 flex items-center justify-center relative">
        {roomStatus === 'waiting' && (
          <div className="text-center">
            <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-medium mb-1">Waiting Room</h2>
            <p className="text-gray-400 text-sm">Your consultation will begin shortly...</p>
          </div>
        )}

        {roomStatus === 'connecting' && (
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Connecting...</p>
          </div>
        )}

        {roomStatus === 'in-call' && (
          <>
            {/* Remote video (placeholder) */}
            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
              <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center">
                <span className="text-3xl font-bold text-gray-500">
                  {(appointment.provider?.user?.name || 'P')[0]}
                </span>
              </div>
            </div>

            {/* Self video (PiP) */}
            <div className="absolute bottom-24 right-4 w-48 h-36 bg-gray-700 rounded-lg border border-gray-600 flex items-center justify-center">
              {isVideoOff ? (
                <span className="text-sm text-gray-400">Camera off</span>
              ) : (
                <span className="text-sm text-gray-400">You</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      {(roomStatus === 'in-call' || roomStatus === 'waiting') && (
        <div className="flex items-center justify-center gap-4 py-6 bg-gray-800/50">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isMuted ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              )}
            </svg>
          </button>

          <button
            onClick={() => setIsVideoOff(!isVideoOff)}
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isVideoOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isVideoOff ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              )}
            </svg>
          </button>

          <button
            onClick={() => setIsScreenSharing(!isScreenSharing)}
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </button>

          <button
            onClick={handleEndCall}
            className="w-14 h-12 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center"
            title="End call"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
