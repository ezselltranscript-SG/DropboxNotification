import express from 'express';
import bodyParser from 'body-parser';
import { verifyChallenge, handleDropboxChanges } from './utils.js';
import { getAuthorizationUrl, exchangeCodeForTokens, storeTokens } from './auth.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// OAuth2 login endpoint
app.get('/oauth/login', (req, res) => {
  const authUrl = getAuthorizationUrl();
  res.redirect(authUrl);
});

// OAuth2 callback endpoint
app.get('/oauth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Store tokens (using a temporary user ID for now)
    const userId = process.env.DROPBOX_USER_ID || '1';
    await storeTokens(userId, tokens);

    res.send('Successfully authenticated with Dropbox!');
  } catch (error) {
    console.error('❌ OAuth error:', error);
    res.status(500).send('Failed to authenticate with Dropbox');
  }
});

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
