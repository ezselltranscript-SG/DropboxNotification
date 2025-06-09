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
  console.log(`🔁 Checking for new files in: ${process.env.DROPBOX_FOLDER_PATH}`);

  let changes = [];
  try {
    changes = await listFolderChanges();
  } catch (err) {
    console.error('❌ Failed to fetch Dropbox changes:', err.message);
    return;
  }

  if (!changes.length) {
    console.log('📭 No new file changes returned by Dropbox.');
    return;
  }

  // Process each new file
  for (const entry of changes) {
    const fileName = entry.path_display.split('/').pop();
    console.log(`🚀 Processing new file: ${fileName}`);
    
    // Here you can add your custom processing logic
    // For example, sending to a webhook or processing the file
    if (process.env.WEBHOOK_URL) {
      try {
        await axios.post(process.env.WEBHOOK_URL, entry);
        console.log(`✅ Webhook notification sent for: ${fileName}`);
      } catch (error) {
        console.error(`❌ Failed to send webhook for ${fileName}:`, error.message);
      }
    }
  }
}
