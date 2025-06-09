import { listFolderChanges } from './dropboxClient.js';
import { checkIfProcessed, markAsProcessed } from './supabaseClient.js';
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

  for (const entry of changes) {
    // Log every path seen
    console.log('📦 Dropbox entry:', entry.path_display);

    // Only consider file entries inside the target folder
    if (
      entry['.tag'] === 'file' &&
      entry.path_display.startsWith(process.env.DROPBOX_FOLDER_PATH)
    ) {
      const fileName = entry.path_display.split('/').pop();
      console.log(`📄 File candidate in folder: ${fileName}`);

      const alreadyProcessed = await checkIfProcessed(entry.id);
      if (alreadyProcessed) {
        console.log(`✅ Already processed: ${fileName}`);
        continue;
      }

      console.log(`🚀 New file uploaded: ${fileName}`);
      await markAsProcessed(entry);
    }
  }
}
