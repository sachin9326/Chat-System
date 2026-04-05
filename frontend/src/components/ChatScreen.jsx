import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Send, Users, Copy, CheckCircle2, LogOut, Menu, X, 
  Ghost, Paperclip, Image as ImageIcon, Flame 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from '../context/ChatContext';
import { encryptPayload, decryptPayload } from '../utils/crypto';

const ChatScreen = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { session, keys, connectSocket, disconnectSocket, socket } = useChat();
  
  const [messages, setMessages] = useState([]);
  const [userList, setUserList] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [fileAttachment, setFileAttachment] = useState(null);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const userListRef = useRef([]);

  useEffect(() => {
    userListRef.current = userList;
  }, [userList]);

  // Initialize socket connection using context
  useEffect(() => {
    if (!session.token || !keys.publicKeyJwk) {
      navigate(`/?room=${roomId}`);
      return;
    }

    let activeSocket;

    const init = async () => {
      activeSocket = await connectSocket(session.token);

      activeSocket.on('connect', () => {
        activeSocket.emit('join-room', { 
          roomId, 
          displayName: session.displayName, 
          userId: session.userId,
          publicKey: keys.publicKeyJwk
        });
      });

      activeSocket.on('message-system', (message) => {
        setMessages((prev) => {
           if (prev.some(m => m.id === message.id)) return prev;
           return [...prev, message];
        });
      });

      activeSocket.on('user-list-update', (users) => {
        setUserList(users);
      });

      activeSocket.on('message-receive-encrypted', async ({ senderId, encryptedPayload }) => {
        if (senderId === session.userId) return;
        
        const sender = userListRef.current.find(u => u.userId === senderId);
        if (sender && sender.publicKey) {
           const decrypted = await decryptPayload(encryptedPayload, keys.keyPair.privateKey, sender.publicKey);
           if (decrypted) {
              const parsed = JSON.parse(decrypted);
              setMessages((prev) => {
                 if (prev.some(m => m.id === parsed.id)) return prev;
                 return [...prev, parsed];
              });
           }
        }
      });

      activeSocket.on('user-typing', ({ displayName, isTyping }) => {
        setTypingUsers(prev => ({
          ...prev,
          [displayName]: isTyping
        }));
      });

      activeSocket.on('start-burn-timer', ({ messageId }) => {
        // Start a 30s countdown to delete locally
        setTimeout(() => {
          setMessages((prev) => prev.filter(m => m.id !== messageId));
        }, 15000); // 15 seconds for testing instead of 30, feels more demo-friendly
      });
    };

    init();

    return () => {
      if (activeSocket) {
        activeSocket.disconnect();
      }
      disconnectSocket();
    };
  }, [roomId, session, keys, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (!socket) return;
    
    socket.emit('typing', { 
      roomId, 
      displayName: session.displayName, 
      isTyping: e.target.value.length > 0 
    });
  };

  const processAndBroadcastMsg = async (payloadObj) => {
    const rawMsgStr = JSON.stringify(payloadObj);
    
    // Add to own local state immediately (unencrypted for self)
    setMessages(prev => [...prev, payloadObj]);

    // Send encrypted chunks to all other participants
    const others = userList.filter(u => u.socketId !== socket.id);
    for (const target of others) {
      if (target.publicKey) {
        const encrypted = await encryptPayload(rawMsgStr, keys.keyPair.privateKey, target.publicKey);
        socket.emit('send-message-encrypted', {
          roomId,
          senderId: session.userId,
          targetSocketId: target.socketId,
          encryptedPayload: encrypted
        });
      }
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && !fileAttachment) return;
    if (!socket || !keys.keyPair) return;

    let attachmentData = null;
    if (fileAttachment) {
      // Read file to base64 data url
      attachmentData = {
        name: fileAttachment.name,
        type: fileAttachment.type,
        dataUrl: await getBase64(fileAttachment)
      };
    }

    const payload = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      type: 'user',
      userId: session.userId,
      displayName: session.displayName,
      text: newMessage.trim(),
      attachment: attachmentData,
      timestamp: new Date().toISOString(),
      burned: false
    };

    setNewMessage('');
    setFileAttachment(null);
    socket.emit('typing', { roomId, displayName: session.displayName, isTyping: false });

    await processAndBroadcastMsg(payload);
  };

  const getBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert("File size exceeds 5MB limit.");
        return;
      }
      setFileAttachment(file);
    }
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
      disconnectSocket();
    }
    sessionStorage.removeItem('displayName');
    navigate('/');
  };

  const markMessageAsViewed = (messageId) => {
    if (!socket) return;
    // Tell socket this message was viewed so destruction starts
    socket.emit('message-viewed', { roomId, messageId });
    // Also trigger burn locally for the sender's own view if needed
    setTimeout(() => {
      setMessages((prev) => prev.filter(m => m.id !== messageId));
    }, 15000);
  };

  const activeTypers = Object.entries(typingUsers)
    .filter(([name, isT]) => isT && name !== session.displayName)
    .map(([name]) => name);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-black font-sans text-white relative">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-gray-900 to-black pointer-events-none" />

      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Glassmorphic */}
      <aside className={`fixed md:static inset-y-0 left-0 z-30 w-72 bg-gray-900/40 backdrop-blur-xl border-r border-white/10 transform transition-transform duration-300 ease-in-out flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Ghost className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-white leading-tight">Stealth</h2>
              <p className="text-xs text-cyan-400 font-mono tracking-wider">#{roomId}</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 border-b border-white/5">
          <button 
            onClick={copyRoomLink}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white rounded-xl transition-all text-sm font-semibold shadow-inner"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied to Clipboard!' : 'Copy Invite Link'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="flex items-center justify-between mb-4 px-2 text-gray-500">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="font-bold text-xs tracking-widest uppercase">Operatives</span>
            </div>
            <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-gray-300">{userList.length}</span>
          </div>
          
          <ul className="space-y-2">
            <AnimatePresence>
              {userList.map((user) => (
                <motion.li 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={user.socketId} 
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
                >
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-sm border border-cyan-500/30">
                      {user.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-gray-900 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  </div>
                  <span className={`text-sm font-medium ${user.userId === session.userId ? 'text-indigo-400 font-bold' : 'text-gray-300'}`}>
                    {user.displayName} {user.userId === session.userId && '(You)'}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>

        <div className="p-4 border-t border-white/5 bg-black/20">
          <button 
            onClick={handleLeave}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 rounded-xl transition-colors text-sm font-semibold"
          >
            <LogOut className="w-4 h-4" />
            Abort Mission
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-transparent relative z-10">
        
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-4 sm:px-6 bg-gray-900/40 backdrop-blur-md z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex flex-col">
              <h1 className="font-bold text-gray-100 hidden sm:flex items-center gap-2">
                Room: {roomId}
              </h1>
              <span className="text-[10px] text-gray-400 space-x-2">
                 <span>E2E Encrypted</span>
                 <span>•</span>
                 <span className="text-emerald-400">Connection Secure</span>
              </span>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-4">
              <Ghost className="w-16 h-16 opacity-30 animate-pulse" />
              <p className="text-sm font-medium tracking-wide">Signal established. Waiting for transmissions.</p>
            </div>
          ) : (
            <AnimatePresence>
              {messages.map((msg, index) => {
                if (msg.type === 'system') {
                  return (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      key={msg.id} 
                      className="flex justify-center"
                    >
                      <span className="px-4 py-1.5 bg-white/5 border border-white/10 text-gray-400 rounded-full text-xs font-semibold backdrop-blur-sm shadow-inner">
                        {msg.text}
                      </span>
                    </motion.div>
                  );
                }

                const isMe = msg.userId === session.userId;
                return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.95, y: 10, originX: isMe ? 1 : 0 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                    key={msg.id} 
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-baseline gap-2 mb-1.5 px-2">
                      <span className={`text-xs font-bold ${isMe ? 'text-indigo-400' : 'text-cyan-400'}`}>
                        {isMe ? 'You' : msg.displayName}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    
                    <div 
                      className={`relative px-5 py-3.5 max-w-[85%] sm:max-w-[70%] rounded-2xl shadow-xl backdrop-blur-md group cursor-pointer border ${
                        isMe 
                          ? 'bg-gradient-to-br from-indigo-600/90 to-purple-600/90 border-indigo-500/50 text-white rounded-br-sm' 
                          : 'bg-white/10 border-white/10 text-gray-100 rounded-bl-sm'
                      }`}
                      onClick={() => !isMe && markMessageAsViewed(msg.id)}
                      title={!isMe ? "Click to view and start burn timer" : ""}
                    >
                      {/* Self-Destruct Indicator */}
                      <div className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_10px_rgba(239,68,68,0.6)]">
                         <Flame className="w-3 h-3 animate-pulse" />
                      </div>

                      {/* Attachment Rendering */}
                      {msg.attachment && msg.attachment.type.startsWith('image/') && (
                         <div className="mb-3 rounded-lg overflow-hidden border border-white/10 bg-black/20">
                            <img src={msg.attachment.dataUrl} alt="attachment" className="w-full max-h-60 object-contain" />
                         </div>
                      )}

                      {msg.attachment && !msg.attachment.type.startsWith('image/') && (
                        <div className="mb-3 flex items-center gap-2 p-2 rounded-lg bg-black/20 border border-white/10">
                           <Paperclip className="w-4 h-4 text-cyan-400" />
                           <span className="text-xs truncate max-w-[200px] font-mono text-cyan-100">{msg.attachment.name}</span>
                        </div>
                      )}

                      {msg.text && (
                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap word-break">
                          {msg.text}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}

          {/* Typing Indicators */}
          {activeTypers.length > 0 && (
             <div className="flex items-center gap-2 text-xs text-gray-500 italic pl-2">
                <div className="flex gap-1">
                   <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                   <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                   <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce"></span>
                </div>
                {activeTypers.join(', ')} {activeTypers.length === 1 ? 'is' : 'are'} typing...
             </div>
          )}

          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Message Input - Floating Style */}
        <div className="p-4 bg-gradient-to-t from-gray-900 via-gray-900/90 to-transparent sticky bottom-0">
          
          {fileAttachment && (
             <div className="max-w-4xl mx-auto mb-3 px-4 py-2 bg-indigo-900/30 border border-indigo-500/30 rounded-xl flex items-center justify-between backdrop-blur-md">
                <div className="flex items-center gap-3 overflow-hidden">
                   {fileAttachment.type.startsWith('image/') ? <ImageIcon className="w-4 h-4 text-indigo-400 shrink-0" /> : <Paperclip className="w-4 h-4 text-indigo-400 shrink-0" />}
                   <span className="text-xs text-indigo-100 font-mono truncate">{fileAttachment.name}</span>
                   <span className="text-[10px] text-gray-500 ml-2">{(fileAttachment.size / 1024).toFixed(1)} KB</span>
                </div>
                <button onClick={() => setFileAttachment(null)} className="p-1 hover:bg-white/10 rounded-md text-gray-400 hover:text-white">
                   <X className="w-4 h-4" />
                </button>
             </div>
          )}

          <form 
            onSubmit={handleSendMessage}
            className="flex items-end gap-2 max-w-4xl mx-auto relative group"
          >
            <div className="flex-1 bg-white/5 border border-white/10 group-focus-within:border-cyan-500/50 group-focus-within:bg-white/10 rounded-2xl flex items-end p-1 transition-all shadow-lg backdrop-blur-md">
               <button 
                  type="button"
                  onClick={() => fileInputRef.current.click()}
                  className="p-3 text-gray-400 hover:text-cyan-400 rounded-xl hover:bg-white/5 transition-colors shrink-0"
               >
                  <Paperclip className="w-5 h-5" />
               </button>
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 onChange={handleFileChange} 
                 className="hidden" 
                 accept="image/*,.pdf,.doc,.docx,.txt"
               />

               <textarea
                 value={newMessage}
                 onChange={handleTyping}
                 onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                       e.preventDefault();
                       handleSendMessage(e);
                    }
                 }}
                 placeholder="Transmit encrypted payload..."
                 className="flex-1 max-h-32 min-h-[50px] py-3 px-2 bg-transparent text-gray-100 placeholder:text-gray-600 text-[15px] outline-none resize-none custom-scrollbar"
                 rows={1}
               />
            </div>
            
            <button
              type="submit"
              disabled={(!newMessage.trim() && !fileAttachment)}
              className="p-4 bg-gradient-to-tr from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 disabled:from-white/5 disabled:to-white/5 disabled:text-gray-600 disabled:cursor-not-allowed text-white rounded-2xl transition-all shadow-lg shadow-cyan-500/20 shrink-0 transform active:scale-95"
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
