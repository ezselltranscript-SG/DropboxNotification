import { listFolderChanges } from './dropboxClient.js';

export async function handleDropboxChanges() {
  const files = await listFolderChanges();
  return files[0] || null;
}
