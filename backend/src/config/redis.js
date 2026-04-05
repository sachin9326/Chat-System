const Redis = require('ioredis');

let redisClient;
let useRedis = true;

try {
  // Attempt to connect to local Redis
  redisClient = new Redis({
    host: '127.0.0.1',
    port: 6379,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 2) {
        console.warn('⚠️ Could not connect to Redis, falling back to In-Memory store.');
        useRedis = false;
        return null; // Stop retrying
      }
      return 1000;
    }
  });

  redisClient.on('error', (err) => {
    if (useRedis) {
      console.warn('Redis error:', err.message);
    }
  });
} catch (e) {
  useRedis = false;
}

// In-Memory Fallback for Rooms State
const memoryRooms = {}; // { roomId: { users: { socketId: { userId, displayName, publicKey } } } }

const ChatStore = {
  async joinRoom(roomId, socketId, userData) {
    if (useRedis && redisClient.status === 'ready') {
      const userKey = `room:${roomId}:user:${socketId}`;
      await redisClient.hset(userKey, userData);
      // Ensure key expires eventually (e.g. 24 hours)
      await redisClient.expire(userKey, 86400);
    } else {
      if (!memoryRooms[roomId]) memoryRooms[roomId] = { users: {} };
      memoryRooms[roomId].users[socketId] = userData;
    }
  },

  async leaveRoom(roomId, socketId) {
    if (useRedis && redisClient.status === 'ready') {
      const userKey = `room:${roomId}:user:${socketId}`;
      await redisClient.del(userKey);
    } else {
      if (memoryRooms[roomId] && memoryRooms[roomId].users[socketId]) {
        delete memoryRooms[roomId].users[socketId];
        if (Object.keys(memoryRooms[roomId].users).length === 0) {
          delete memoryRooms[roomId];
        }
      }
    }
  },

  async getRoomUsers(roomId) {
    if (useRedis && redisClient.status === 'ready') {
      const keys = await redisClient.keys(`room:${roomId}:user:*`);
      const users = [];
      for (const key of keys) {
        const u = await redisClient.hgetall(key);
        // We include socketId for target-specific broadcasts
        const socketId = key.split(':').pop(); 
        users.push({ socketId, ...u });
      }
      return users;
    } else {
      if (memoryRooms[roomId]) {
        return Object.entries(memoryRooms[roomId].users).map(([sid, u]) => ({ socketId: sid, ...u }));
      }
      return [];
    }
  }
};

module.exports = { redisClient, ChatStore, isRedisReady: () => useRedis && redisClient.status === 'ready' };
