import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore } from '../store';
import type { Message } from '../types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export function useSocket(expenseId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const addLocalMessage = useStore((state) => state.addLocalMessage);
  const token = useStore((state) => state.token);

  useEffect(() => {
    if (!token) return;

    // Connect to Socket.io server
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket.io connected successfully');
      if (expenseId) {
        socket.emit('join:expense', expenseId);
      }
    });

    // Handle new incoming chat messages
    socket.on('message:new', (payload: Message) => {
      if (expenseId && payload.expenseId === expenseId) {
        addLocalMessage(payload);
      }
    });

    socket.on('error', (err: any) => {
      console.error('Socket error received:', err);
    });

    // Cleanup connection on unmount or room switch
    return () => {
      socket.disconnect();
    };
  }, [token, expenseId, addLocalMessage]);

  const sendMessage = (content: string) => {
    if (socketRef.current && expenseId && content.trim() !== '') {
      socketRef.current.emit('message:send', { expenseId, content: content.trim() });
    }
  };

  return { sendMessage };
}

export default useSocket;
