const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { authLimiter } = require('../middleware/rateLimiter');

// In production, keep this very secure and complex
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_ghost_chat_key_2024!';

router.post('/session', authLimiter, (req, res) => {
  const { displayName, userId } = req.body;

  if (!displayName || !userId) {
    return res.status(400).json({ error: 'Display name and User ID are required.' });
  }

  // Generate a short-lived token (expires when tab closes, but 12h max server-side)
  const token = jwt.sign({ displayName, userId }, JWT_SECRET, { expiresIn: '12h' });

  res.json({ token, message: 'Session generated successfully' });
});

module.exports = { router, JWT_SECRET };
