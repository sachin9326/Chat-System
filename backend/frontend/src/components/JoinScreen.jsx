import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Ghost, Shuffle, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { useChat } from '../context/ChatContext';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const JoinScreen = () => {
  const [displayName, setDisplayName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState(null);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setSession } = useChat();

  useEffect(() => {
    const roomParam = searchParams.get('room');
    if (roomParam) setRoomId(roomParam);
  }, [searchParams]);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!displayName.trim() || !roomId.trim()) return;
    
    setIsJoining(true);
    setError(null);

    let userId = sessionStorage.getItem('userId');
    if (!userId) {
      userId = uuidv4();
      sessionStorage.setItem('userId', userId);
    }
    
    const dName = displayName.trim();
    sessionStorage.setItem('displayName', dName);

    try {
      // Get JWT Session Handshake
      const res = await fetch(`${BACKEND_URL}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: dName, userId })
      });
      
      if (!res.ok) {
        throw new Error('Failed to create secure session');
      }
      
      const data = await res.json();
      
      setSession({
        token: data.token,
        userId,
        displayName: dName
      });

      // Give a tiny delay for Framer exit animations to feel weighty
      setTimeout(() => navigate(`/room/${roomId.trim()}`), 400);

    } catch (err) {
      setError(err.message || 'Network error');
      setIsJoining(false);
    }
  };

  const generateRandomRoom = () => {
    const randomId = Math.random().toString(36).substring(2, 10);
    setRoomId(randomId);
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen p-4 overflow-hidden bg-black selection:bg-cyan-500/30">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-cyan-600/20 blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md bg-white/5 backdrop-blur-2xl shadow-2xl rounded-3xl p-8 border border-white/10 z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <motion.div 
            initial={{ rotate: -15 }}
            animate={{ rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 10 }}
            className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-cyan-400 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/30"
          >
            <Ghost className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 text-center">
            StealthChat
          </h1>
          <p className="text-gray-400 text-sm mt-3 flex items-center gap-2 justify-center">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            E2E Encrypted. Zero Logs. Zero Trace.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-medium text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-widest font-bold text-gray-500 mb-2 ml-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Cipher"
              className="w-full px-4 py-3.5 rounded-xl border border-white/10 bg-white/5 text-white focus:bg-white/10 focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent outline-none transition-all duration-200 placeholder:text-gray-600"
              required
              maxLength={25}
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest font-bold text-gray-500 mb-2 ml-1">
              Room ID
            </label>
            <div className="relative">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter or generate ID"
                className="w-full pl-4 pr-12 py-3.5 rounded-xl border border-white/10 bg-white/5 text-white focus:bg-white/10 focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent outline-none transition-all duration-200 placeholder:text-gray-600 font-mono"
                required
              />
              <button
                type="button"
                onClick={generateRandomRoom}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-cyan-400 rounded-lg transition-colors group"
                title="Generate Random Room ID"
              >
                <Shuffle className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
              </button>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isJoining}
            type="submit"
            className="w-full mt-4 py-4 px-4 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white rounded-xl font-bold shadow-lg shadow-cyan-500/20 flex items-center justify-center space-x-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{isJoining ? 'Establishing...' : 'Infiltrate Room'}</span>
            {!isJoining && <ArrowRight className="w-5 h-5" />}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

export default JoinScreen;
