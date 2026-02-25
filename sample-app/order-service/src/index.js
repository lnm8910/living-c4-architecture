const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'order-service' });
});

// Order endpoints
app.get('/orders/:id', async (req, res) => {
  // In real app: fetch from PostgreSQL
  res.json({
    id: req.params.id,
    userId: '123',
    items: [{ product: 'Widget', quantity: 2 }],
    status: 'pending'
  });
});

app.post('/orders', async (req, res) => {
  const { userId, items } = req.body;

  // Verify user exists (calls User Service)
  try {
    await axios.get(`${USER_SERVICE_URL}/users/${userId}`);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid user' });
  }

  // In real app:
  // 1. Store order in PostgreSQL
  // 2. Publish to RabbitMQ for notification-service

  res.status(201).json({ id: '456', userId, items, status: 'created' });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Order Service running on port ${PORT}`);
});
