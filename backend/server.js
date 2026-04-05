const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // For dev, allow all origins
    methods: ['GET', 'POST']
  }
});

// In-memory store for active rooms
// Structure:
// rooms = {
//   [roomId]: {
//     users: { [socketId]: { displayName, userId } },
//     messages: [ { id, userId, displayName, text, timestamp } ]
//   }
// }
const rooms = {};

const PORT = process.env.PORT || 3001;

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // When a user joins a room
  socket.on('join-room', ({ roomId, displayName, userId }) => {
    // If room doesn't exist, create it
    if (!rooms[roomId]) {
      rooms[roomId] = {
        users: {},
        messages: []
      };
      console.log(`Room created: ${roomId}`);
    }

    // Add user to room
    rooms[roomId].users[socket.id] = { displayName, userId };
    
    // Join socket.io room format
    socket.join(roomId);

    // Send existing messages to the newly joined user
    socket.emit('room-history', rooms[roomId].messages);

    // Notify others in room
    const joinMessage = {
      id: Date.now().toString(),
      type: 'system',
      text: `${displayName} has joined the chat.`,
      timestamp: new Date().toISOString()
    };
    rooms[roomId].messages.push(joinMessage);
    
    io.to(roomId).emit('message', joinMessage);
    
    // Update user list for the room
    const userList = Object.values(rooms[roomId].users);
    io.to(roomId).emit('user-list-update', userList);
    
    console.log(`${displayName} joined room: ${roomId}`);
  });

  // When a user sends a message
  socket.on('send-message', ({ roomId, userId, displayName, text }) => {
    if (rooms[roomId]) {
      const message = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        type: 'user',
        userId,
        displayName,
        text,
        timestamp: new Date().toISOString()
      };
      
      rooms[roomId].messages.push(message);
      io.to(roomId).emit('message', message);
    }
  });

  // When a user disconnects
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Find what room this user was in, and remove them
    for (const roomId in rooms) {
      if (rooms[roomId].users[socket.id]) {
        const user = rooms[roomId].users[socket.id];
        delete rooms[roomId].users[socket.id];
        
        // Notify others
        const leaveMessage = {
          id: Date.now().toString(),
          type: 'system',
          text: `${user.displayName} has left the chat.`,
          timestamp: new Date().toISOString()
        };
        rooms[roomId].messages.push(leaveMessage);
        
        io.to(roomId).emit('message', leaveMessage);
        io.to(roomId).emit('user-list-update', Object.values(rooms[roomId].users));
        
        console.log(`${user.displayName} left room: ${roomId}`);
        
        // Check if room is empty to delete it
        if (Object.keys(rooms[roomId].users).length === 0) {
          delete rooms[roomId];
          console.log(`Room empty and destroyed: ${roomId}`);
        }
        
        // Since a socket is generally in one room (per our app logic), we can break
        break;
      }
    }
  });

  // Manual leave room event
  socket.on('leave-room', ({ roomId }) => {
    socket.leave(roomId);
    if (rooms[roomId] && rooms[roomId].users[socket.id]) {
      const user = rooms[roomId].users[socket.id];
      delete rooms[roomId].users[socket.id];
        
      const leaveMessage = {
        id: Date.now().toString(),
        type: 'system',
        text: `${user.displayName} has left the chat.`,
        timestamp: new Date().toISOString()
      };
      rooms[roomId].messages.push(leaveMessage);
        
      io.to(roomId).emit('message', leaveMessage);
      io.to(roomId).emit('user-list-update', Object.values(rooms[roomId].users));
        
      if (Object.keys(rooms[roomId].users).length === 0) {
        delete rooms[roomId];
        console.log(`Room empty and destroyed: ${roomId}`);
      }
    }
  });
});

// A simple health check route
app.get('/', (req, res) => {
  res.send('Chat server is running.');
});

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
