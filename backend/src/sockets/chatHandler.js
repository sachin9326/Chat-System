const { ChatStore } = require('../config/redis');

module.exports = (io, socket) => {
  console.log(`User connected: ${socket.id}`);

  // When a user joins a room
  socket.on('join-room', async ({ roomId, displayName, userId, publicKey }) => {
    await ChatStore.joinRoom(roomId, socket.id, { userId, displayName, publicKey });
    
    socket.join(roomId);

    // Notify others in room
    const joinMessage = {
      id: Date.now().toString(),
      type: 'system',
      text: `${displayName} has joined the chat.`,
      timestamp: new Date().toISOString()
    };
    
    // Emit system message
    io.to(roomId).emit('message-system', joinMessage);
    
    // Update user list and distribute public keys to all in room
    const userList = await ChatStore.getRoomUsers(roomId);
    io.to(roomId).emit('user-list-update', userList);
    
    console.log(`${displayName} joined room: ${roomId}`);
  });

  // Relay encrypted messages directly to a specific target without server knowledge
  socket.on('send-message-encrypted', ({ roomId, senderId, targetSocketId, encryptedPayload }) => {
    // Target specific user so others can't see the encrypted blob meant for them
    socket.to(targetSocketId).emit('message-receive-encrypted', {
      senderId,
      encryptedPayload
    });
  });

  // Relay multimedia buffer/stream
  socket.on('send-media-encrypted', ({ roomId, senderId, targetSocketId, encryptedBuffer, fileName, fileType }) => {
    socket.to(targetSocketId).emit('media-receive-encrypted', {
      senderId,
      encryptedBuffer,
      fileName,
      fileType
    });
  });

  // Type indicators
  socket.on('typing', ({ roomId, displayName, isTyping }) => {
    socket.to(roomId).emit('user-typing', { displayName, isTyping });
  });

  // Read receipts and burn countdown
  socket.on('message-viewed', ({ roomId, messageId }) => {
    // Once a message is 'viewed' by any recipient, broadcast to start burn timer
    socket.to(roomId).emit('start-burn-timer', { messageId });
  });

  // Manual leave room event
  socket.on('leave-room', async ({ roomId }) => {
    socket.leave(roomId);
    
    const users = await ChatStore.getRoomUsers(roomId);
    const currentUser = users.find(u => u.socketId === socket.id);
    
    await ChatStore.leaveRoom(roomId, socket.id);
    
    if (currentUser) {
      const leaveMessage = {
        id: Date.now().toString(),
        type: 'system',
        text: `${currentUser.displayName} has left the chat.`,
        timestamp: new Date().toISOString()
      };
      
      io.to(roomId).emit('message-system', leaveMessage);
    }
  });

  // Disconnect
  socket.on('disconnecting', async () => {
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        const users = await ChatStore.getRoomUsers(roomId);
        const currentUser = users.find(u => u.socketId === socket.id);
        
        await ChatStore.leaveRoom(roomId, socket.id);
        
        if (currentUser) {
          const leaveMessage = {
            id: Date.now().toString(),
            type: 'system',
            text: `${currentUser.displayName} has left the chat.`,
            timestamp: new Date().toISOString()
          };
          io.to(roomId).emit('message-system', leaveMessage);
          
          const updatedUsers = await ChatStore.getRoomUsers(roomId);
          io.to(roomId).emit('user-list-update', updatedUsers);
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
};
