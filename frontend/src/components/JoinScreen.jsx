import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { MessageSquare, Shuffle, ArrowRight } from 'lucide-react';

const JoinScreen = () => {
  const [displayName, setDisplayName] = useState('');
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Check if there's a room parameter in the URL from a shared link
    const roomParam = searchParams.get('room');
    if (roomParam) {
      setRoomId(roomParam);
    }
  }, [searchParams]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (!displayName.trim() || !roomId.trim()) return;

    // Ensure we have a persistent user ID for this session
    let userId = sessionStorage.getItem('userId');
    if (!userId) {
      userId = uuidv4();
      sessionStorage.setItem('userId', userId);
    }
    
    // Save display name
    sessionStorage.setItem('displayName', displayName.trim());

    // Navigate to chat
    navigate(`/room/${roomId.trim()}`);
  };

  const generateRandomRoom = () => {
    const randomId = Math.random().toString(36).substring(2, 10);
    setRoomId(randomId);
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl shadow-2xl rounded-3xl p-8 border border-white/20">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-cyan-400 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/30">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500 text-center">
            Anonymous Chat
          </h1>
          <p className="text-gray-500 text-sm mt-2 text-center">
            No registration, no tracking. Just talk.
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. MidnightFalcon"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all duration-200 placeholder:text-gray-400"
              required
              maxLength={25}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Room ID
            </label>
            <div className="relative">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter or generate ID"
                className="w-full pl-4 pr-12 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all duration-200 placeholder:text-gray-400"
                required
              />
              <button
                type="button"
                onClick={generateRandomRoom}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors group"
                title="Generate Random Room ID"
              >
                <Shuffle className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/30 flex items-center justify-center space-x-2 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>Join Room</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default JoinScreen;
