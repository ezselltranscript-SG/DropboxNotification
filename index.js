import express from 'express';
import bodyParser from 'body-parser';
import { verifyChallenge, handleDropboxChanges } from './utils.js';

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Dropbox webhook verification
app.get('/webhook', verifyChallenge);

// Webhook listener
app.post('/webhook', async (req, res) => {
  // Acknowledge webhook immediately
  res.sendStatus(200);

  const { list_folder } = req.body;

  // Log the full incoming webhook for debugging
  console.log('📩 Received POST /webhook with body:', JSON.stringify(req.body, null, 2));

  if (!list_folder || !list_folder.accounts || !Array.isArray(list_folder.accounts)) {
    console.log('⚠️ No account data in webhook payload.');
    return;
  }

  // Process each account ID
  for (const accountId of list_folder.accounts) {
    try {
      console.log(`🔍 Processing account ID: ${accountId}`);
      await handleDropboxChanges(accountId);
    } catch (err) {
      console.error(`❌ Error processing account ${accountId}:`, err.message);
    }
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Dropbox Webhook server running on port ${PORT}`);
});
