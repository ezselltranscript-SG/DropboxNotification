import express from 'express';
import { handleDropboxChanges } from './utils.js';

const app = express();
app.use(express.json());

// Webhook verification
app.get('/webhook/2257b161-8822-401d-b3f8-ba2e1ae2150a', (req, res) => {
  const challenge = req.query.challenge;
  if (challenge) return res.status(200).send(challenge);
  return res.status(400).send('Missing challenge');
});

// Webhook listener
app.post('/webhook/2257b161-8822-401d-b3f8-ba2e1ae2150a', async (req, res) => {
  const { list_folder } = req.body;
  res.status(200).send('OK');
  
  if (!list_folder?.accounts?.length) return;
  
  const file = await handleDropboxChanges();
  if (file) {
    console.log(JSON.stringify({
      name: file.name,
      path: file.path
    }));
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught Exception:', error);
  // Consider restarting the server or handling the error appropriately
  process.exit(1);
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('🛑 Server terminated');
    process.exit(0);
  });
});
