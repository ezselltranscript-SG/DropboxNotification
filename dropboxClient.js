import pkg from 'dropbox';
const { Dropbox } = pkg;
import 'dotenv/config';
import fetch from 'node-fetch';

// Create Dropbox client
function createDropboxClient() {
  return new Dropbox({
    accessToken: process.env.DROPBOX_TOKEN,
    fetch: fetch
  });
}

// Get the most recently added file
export async function listFolderChanges() {
  const dbx = createDropboxClient();
  const path = process.env.DROPBOX_FOLDER_PATH || '';
  
  try {
    const response = await dbx.filesListFolder({
      path,
      recursive: true,
      limit: 1
    });

    const file = response.result.entries.find(entry => entry['.tag'] === 'file');
    if (!file) return [];
    
    return [{
      name: file.name,
      path: file.path_display
    }];
  } catch (error) {
    console.error('❌ Dropbox API Error:', {
      message: error.message,
      error: error.error,
      status: error.status,
      stack: error.stack?.split('\n')[0]
    });
    throw error;
  }
}
