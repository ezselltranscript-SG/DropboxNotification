import fetch from 'node-fetch';
import 'dotenv/config';

// Dropbox OAuth configuration
const config = {
  clientId: process.env.DROPBOX_APP_KEY,
  clientSecret: process.env.DROPBOX_APP_SECRET,
  redirectUri: process.env.REDIRECT_URI || 'http://localhost:3000/oauth/callback',
};

// Generate authorization URL
export function getAuthorizationUrl() {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    token_access_type: 'offline', // Request refresh token
  });

  return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
}

// Exchange code for tokens
export async function exchangeCodeForTokens(code) {
  const params = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
  });

  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Failed to exchange code: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

// Refresh access token
export async function refreshAccessToken(refreshToken) {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

// Store tokens in Supabase
export async function storeTokens(userId, { accessToken, refreshToken, expiresIn }) {
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const { error } = await supabase
    .from('dropbox_tokens')
    .upsert({
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
    });

  if (error) {
    throw new Error(`Failed to store tokens: ${error.message}`);
  }
}

// Get stored tokens
export async function getStoredTokens(userId) {
  const { data, error } = await supabase
    .from('dropbox_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to get tokens: ${error.message}`);
  }

  return data;
}

// Get valid access token (refreshes if needed)
export async function getValidAccessToken(userId) {
  const tokens = await getStoredTokens(userId);
  if (!tokens) {
    throw new Error('No tokens found');
  }

  // Check if token is expired or will expire soon (5 minutes buffer)
  const expiresAt = new Date(tokens.expires_at);
  const now = new Date();
  const buffer = 5 * 60 * 1000; // 5 minutes in milliseconds

  if (expiresAt.getTime() - now.getTime() <= buffer) {
    // Token is expired or will expire soon, refresh it
    const { accessToken, expiresIn } = await refreshAccessToken(tokens.refresh_token);
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Update stored token
    await supabase
      .from('dropbox_tokens')
      .update({
        access_token: accessToken,
        expires_at: newExpiresAt,
      })
      .eq('user_id', userId);

    return accessToken;
  }

  return tokens.access_token;
}
