import pkg from 'dropbox';
const { Dropbox } = pkg;
import 'dotenv/config';

// Create Dropbox client
const dbx = new Dropbox({
  accessToken: process.env.DROPBOX_TOKEN
});

// Format path for Dropbox API
function formatDropboxPath(path) {
  if (!path || path === '/') return '';
  let formattedPath = path.trim().replace(/\/*$/, '');
  if (!formattedPath.startsWith('/')) {
    formattedPath = '/' + formattedPath;
  }
  return formattedPath;
}

// Get latest changes
export async function listFolderChanges() {
  try {
    const path = formatDropboxPath(process.env.DROPBOX_FOLDER_PATH || '');
    const response = await dbx.filesListFolder({
      path,
      recursive: true,
      include_deleted: false
    });

    // Solo nos interesa el último archivo
    const files = response.result.entries.filter(entry => entry['.tag'] === 'file');
    if (files.length === 0) return [];

    // Devolvemos el último archivo
    const lastFile = files[files.length - 1];
    return [{
      name: lastFile.name,
      path: lastFile.path_display
    }];
  } catch (error) {
    console.error('Error:', error.message);
    return [];
  }
}
