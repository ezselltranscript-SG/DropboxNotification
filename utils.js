import { listFolderChanges } from './dropboxClient.js';
import dotenv from 'dotenv';
dotenv.config();

export function verifyChallenge(req, res) {
  const challenge = req.query.challenge;
  if (challenge) {
    return res.status(200).send(challenge);
  }
  res.status(400).send('Missing challenge');
}

export async function handleDropboxChanges(accountId) {
  try {
    const changes = await listFolderChanges();
    if (changes.length > 0) {
      // Solo retornamos el último archivo subido
      const lastFile = changes[changes.length - 1];
      return {
        name: lastFile.name,
        path: lastFile.path_display
      };
    }
    return null;
  } catch (err) {
    console.error('❌ Failed to fetch Dropbox changes:', err.message);
    return null;
  }
}
