require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const { apiLimiter } = require('./src/middleware/rateLimiter');
const { router: authRouter, JWT_SECRET } = require('./src/routes/authController');
const chatHandler = require('./src/sockets/chatHandler');

const app = express();
app.use(cors());
app.use(express.json()); // For handling REST payloads

// Apply rate limiter to all APIs
app.use('/api/', apiLimiter);
app.use('/api/auth', authRouter);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // For dev, allow all origins
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 10 * 1024 * 1024, // Allow up to 10MB payloads for encrypted multimedia buffers
});

// Socket.io Middleware for JWT authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
    socket.user = decoded; // Attach user info to socket
    next();
  });
});

const PORT = process.env.PORT || 3001;

io.on('connection', (socket) => {
  chatHandler(io, socket);
});

// A simple health check route
app.get('/', (req, res) => {
  res.send('StealthChat server is running securely.');
});

server.listen(PORT, () => {
  console.log(`StealthChat Server is listening on port ${PORT}`);
});
