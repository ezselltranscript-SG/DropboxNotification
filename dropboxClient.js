import pkg from 'dropbox';
const { Dropbox } = pkg;
import 'dotenv/config';

// Create Dropbox client with error handling
function createDropboxClient() {
  const token = process.env.DROPBOX_TOKEN;
  if (!token) {
    throw new Error('DROPBOX_TOKEN is not set in environment variables');
  }
  return new Dropbox({
    accessToken: token,
    fetch: require('node-fetch')
  });
}

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
  const dbx = createDropboxClient();
  const path = formatDropboxPath(process.env.DROPBOX_FOLDER_PATH || '');
  
  try {
    console.log('🔍 Checking folder:', path);
    const response = await dbx.filesListFolder({
      path,
      recursive: true,
      include_deleted: false,
      limit: 1, // Solo necesitamos el archivo más reciente
      include_has_explicit_shared_members: false
    });

    const files = response.result.entries.filter(entry => entry['.tag'] === 'file');
    if (files.length === 0) {
      console.log('ℹ️ No files found in folder');
      return [];
    }

    const lastFile = files[0]; // Ya que ordenamos por fecha descendente
    console.log('✅ Found file:', lastFile.name);
    return [{
      name: lastFile.name,
      path: lastFile.path_display
    }];
  } catch (error) {
    console.error('❌ Dropbox API Error:', {
      message: error.error?.error_summary || error.message,
      status: error.status
    });
    throw error; // Propagar el error para manejarlo en el nivel superior
  }
}
