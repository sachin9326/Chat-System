import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import JoinScreen from './components/JoinScreen';
import ChatScreen from './components/ChatScreen';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
        <Routes>
          <Route path="/" element={<JoinScreen />} />
          <Route path="/room/:roomId" element={<ChatScreen />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
