import express from 'express';
import bodyParser from 'body-parser';
import { verifyChallenge, handleDropboxChanges } from './utils.js';

// Configuración inicial
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Webhook verification
app.get('/webhook/2257b161-8822-401d-b3f8-ba2e1ae2150a', (req, res) => {
  const challenge = req.query.challenge;
  if (challenge) {
    return res.status(200).send(challenge);
  }
  return res.status(400).send('Missing challenge');
});

// Webhook listener
app.post('/webhook/2257b161-8822-401d-b3f8-ba2e1ae2150a', async (req, res) => {
  // Acknowledge webhook immediately
  res.status(200).send('Webhook received');

  const { list_folder } = req.body;
  if (!list_folder?.accounts?.length) return;

  try {
    const lastFile = await handleDropboxChanges(list_folder.accounts[0]);
    if (lastFile) {
      console.log(JSON.stringify({
        name: lastFile.name,
        path: lastFile.path
      }, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('🔍 Environment variables:');
  console.log(`   - DROPBOX_FOLDER_PATH: ${process.env.DROPBOX_FOLDER_PATH || 'Not set'}`);
  console.log(`   - DROPBOX_TOKEN: ${process.env.DROPBOX_TOKEN ? 'Set' : 'Not set'}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
  // Consider restarting the server or handling the error appropriately
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
