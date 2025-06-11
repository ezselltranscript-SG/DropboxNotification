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

// Webhook verification with unique ID
app.get('/webhook/2257b161-8822-401d-b3f8-ba2e1ae2150a', verifyChallenge);

// Webhook listener with unique ID
app.post('/webhook/2257b161-8822-401d-b3f8-ba2e1ae2150a', async (req, res) => {
  console.log('🔔 Received webhook:', JSON.stringify(req.body, null, 2));
  
  // Acknowledge webhook immediately
  res.status(200).send('Webhook received');

  const { list_folder } = req.body;
  if (!list_folder?.accounts?.length) {
    console.log('⚠️ No accounts in webhook payload');
    return;
  }

  try {
    console.log('🔍 Processing changes for account:', list_folder.accounts[0]);
    const lastFile = await handleDropboxChanges(list_folder.accounts[0]);
    if (lastFile) {
      console.log('✅ Last uploaded file:', JSON.stringify(lastFile, null, 2));
    }
  } catch (error) {
    console.error('❌ Error processing webhook:', {
      message: error.message,
      status: error.status,
      stack: error.stack?.split('\n')[0]
    });
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
