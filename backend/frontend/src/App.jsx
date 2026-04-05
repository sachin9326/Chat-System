import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import JoinScreen from './components/JoinScreen';
import ChatScreen from './components/ChatScreen';
import { ChatProvider } from './context/ChatContext';

function App() {
  return (
    <ChatProvider>
      <Router>
        <div className="min-h-screen bg-black text-white selection:bg-cyan-500/30">
          <Routes>
            <Route path="/" element={<JoinScreen />} />
            <Route path="/room/:roomId" element={<ChatScreen />} />
          </Routes>
        </div>
      </Router>
    </ChatProvider>
  );
}

export default App;
