import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { 
  Send, 
  Users, 
  Copy, 
  CheckCircle2, 
  LogOut, 
  Menu,
  X,
  MessageSquare
} from 'lucide-react';

const SOCKET_SERVER_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const ChatScreen = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [userList, setUserList] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const messagesEndRef = useRef(null);

  const displayName = sessionStorage.getItem('displayName');
  const userId = sessionStorage.getItem('userId');

  useEffect(() => {
    if (!displayName || !userId) {
      // Redirect to join if missing session data
      navigate(`/?room=${roomId}`);
      return;
    }

    const newSocket = io(SOCKET_SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join-room', { roomId, displayName, userId });
    });

    newSocket.on('room-history', (history) => {
      setMessages(history);
    });

    newSocket.on('message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    newSocket.on('user-list-update', (users) => {
      setUserList(users);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [roomId, displayName, userId, navigate]);

  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;

    socket.emit('send-message', {
      roomId,
      userId,
      displayName,
      text: newMessage.trim()
    });

    setNewMessage('');
  };

  const copyRoomLink = () => {
    const url = `${window.location.origin}/?room=${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleLeave = () => {
    if (socket) {
      socket.emit('leave-room', { roomId });
      socket.disconnect();
    }
    sessionStorage.removeItem('displayName');
    navigate('/');
  };

  if (!displayName || !userId) return null; // Prevent janky render before redirect

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans">
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-20 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-30 w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        
        {/* Sidebar Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 leading-tight">Anonymous</h2>
              <p className="text-xs text-indigo-500 font-medium">Room: {roomId}</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="p-4 flex flex-col gap-2 border-b border-gray-100">
          <button 
            onClick={copyRoomLink}
            className="flex items-center justify-between w-full px-4 py-2.5 bg-gray-50 hover:bg-indigo-50 text-gray-700 hover:text-indigo-600 rounded-xl transition-colors text-sm font-semibold group"
          >
            <span className="flex items-center gap-2">
              {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Invite Link'}
            </span>
          </button>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center gap-2 mb-4 px-2 text-gray-500">
            <Users className="w-4 h-4" />
            <span className="font-semibold text-xs tracking-wider uppercase">Active Users ({userList.length})</span>
          </div>
          <ul className="space-y-1">
            {userList.map((user, idx) => (
              <li key={idx} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-cyan-100 flex items-center justify-center text-indigo-600 font-bold text-sm border border-indigo-200">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                </div>
                <span className={`text-sm font-medium ${user.userId === userId ? 'text-indigo-600' : 'text-gray-700'}`}>
                  {user.displayName} {user.userId === userId && '(You)'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button 
            onClick={handleLeave}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors text-sm font-semibold"
          >
            <LogOut className="w-4 h-4" />
            Leave Room
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-white relative">
        
        {/* Header */}
        <header className="h-16 border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 bg-white/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-gray-500 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex flex-col">
              <h1 className="font-bold text-gray-900 hidden sm:block">Room: {roomId}</h1>
              <span className="text-xs text-green-500 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                Connected
              </span>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-gray-50/50">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
              <MessageSquare className="w-12 h-12 opacity-20" />
              <p className="text-sm font-medium">No messages yet. Say hello!</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              if (msg.type === 'system') {
                return (
                  <div key={index} className="flex justify-center">
                    <span className="px-4 py-1.5 bg-gray-200/50 text-gray-500 rounded-full text-xs font-semibold backdrop-blur-sm">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              const isMe = msg.userId === userId;
              return (
                <div key={index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-baseline gap-2 mb-1 px-1">
                    <span className="text-xs font-semibold text-gray-500">
                      {isMe ? 'You' : msg.displayName}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div 
                    className={`px-5 py-3.5 max-w-[85%] sm:max-w-[70%] rounded-2xl shadow-sm ${
                      isMe 
                        ? 'bg-indigo-600 text-white rounded-br-none' 
                        : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap word-break">
                      {msg.text}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-4 bg-white border-t border-gray-200">
          <form 
            onSubmit={handleSendMessage}
            className="flex items-center gap-3 max-w-4xl mx-auto relative"
          >
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 py-3.5 pl-5 pr-14 bg-gray-100/80 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-full text-sm outline-none transition-all"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-full transition-colors shadow-sm"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default ChatScreen;
