import express from 'express';
import bodyParser from 'body-parser';
import { verifyChallenge, handleDropboxChanges } from './utils.js';
import { exchangeCodeForTokens } from './auth.js';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// OAuth2 callback endpoint
app.get('/oauth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);
    
    // Save token to .env file
    const envPath = path.join(process.cwd(), '.env');
    const envContent = await fs.readFile(envPath, 'utf8');
    const updatedContent = envContent.replace(
      /^DROPBOX_TOKEN=.*$/m,
      `DROPBOX_TOKEN=${tokens.access_token}`
    );
    await fs.writeFile(envPath, updatedContent);

    res.send('Successfully authenticated with Dropbox! You can close this window.');
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
  // Construct authorization URL
  const params = new URLSearchParams({
    client_id: process.env.DROPBOX_APP_KEY,
    response_type: 'code',
    redirect_uri: process.env.REDIRECT_URI,
    token_access_type: 'offline'
  });
  const authUrl = `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;

  console.log(`🚀 Dropbox Webhook server running on port ${PORT}`);
  console.log('\n🔑 To authorize with Dropbox, visit this URL:');
  console.log(authUrl);
});
