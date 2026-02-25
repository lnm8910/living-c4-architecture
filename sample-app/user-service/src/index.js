const express = require('express');

const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'user-service' });
});

// User endpoints
app.get('/users/:id', async (req, res) => {
  // In real app: fetch from PostgreSQL, cache in Redis
  res.json({ id: req.params.id, name: 'John Doe', email: 'john@example.com' });
});

app.post('/users', async (req, res) => {
  // In real app: hash password with bcryptjs, store in PostgreSQL
  res.status(201).json({ id: '123', ...req.body });
});

app.post('/users/login', async (req, res) => {
  // In real app: verify credentials, return JWT
  res.json({ token: 'jwt-token-here' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
});
