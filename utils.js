import { listFolderChanges } from './dropboxClient.js';

export function verifyChallenge(req, res) {
  const challenge = req.query.challenge;
  if (challenge) {
    return res.status(200).send(challenge);
  }
  return res.status(400).send('Missing challenge');
}

export async function handleDropboxChanges() {
  const changes = await listFolderChanges();
  return changes[0] || null;
}
