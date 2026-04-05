import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { generateKeypair } from '../utils/crypto';

const ChatContext = createContext();

export const useChat = () => useContext(ChatContext);

const SOCKET_SERVER_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export const ChatProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [session, setSession] = useState({
    token: null,
    userId: sessionStorage.getItem('userId'),
    displayName: sessionStorage.getItem('displayName')
  });
  const [keys, setKeys] = useState({ keyPair: null, publicKeyJwk: null });

  // Initialize keys once per session load
  useEffect(() => {
    const initCrypto = async () => {
      const generated = await generateKeypair();
      setKeys(generated);
    };
    initCrypto();
  }, []);

  const connectSocket = async (token) => {
    if (socket) socket.disconnect();
    
    const newSocket = io(SOCKET_SERVER_URL, {
      auth: { token }
    });
    
    setSocket(newSocket);
    return newSocket;
  };

  const disconnectSocket = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  };

  const value = {
    socket,
    session,
    setSession,
    keys,
    connectSocket,
    disconnectSocket
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
