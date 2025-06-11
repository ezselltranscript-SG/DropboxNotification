import { listFolderChanges } from './dropboxClient.js';
import dotenv from 'dotenv';
dotenv.config();

export function verifyChallenge(req, res) {
  const challenge = req.query.challenge;
  if (challenge) {
    console.log('✅ Webhook verification successful');
    return res.status(200).send(challenge);
  }
  console.error('❌ Missing challenge parameter');
  return res.status(400).send('Missing challenge');
}

export async function handleDropboxChanges(accountId) {
  console.log('🔄 Processing changes for account:', accountId);
  
  try {
    const changes = await listFolderChanges();
    if (changes.length > 0) {
      const lastFile = changes[0];
      console.log('📄 Last file:', lastFile);
      return lastFile;
    }
    console.log('ℹ️ No new files found');
    return null;
  } catch (error) {
    console.error('❌ Error in handleDropboxChanges:', {
      message: error.message,
      status: error.status,
      stack: error.stack?.split('\n')[0]
    });
    throw error; // Propagar el error para manejarlo en el nivel superior
  }
}
