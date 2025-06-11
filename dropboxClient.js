import pkg from 'dropbox';
const { Dropbox } = pkg;
import 'dotenv/config';
import fetch from 'node-fetch';

// Create Dropbox client with error handling
function createDropboxClient() {
  const token = process.env.DROPBOX_TOKEN;
  if (!token) {
    const error = new Error('DROPBOX_TOKEN is not set in environment variables');
    console.error('❌', error.message);
    throw error;
  }
  
  console.log('🔑 Dropbox client created with token:', token ? 'Token is set' : 'Token is NOT set');
  
  return new Dropbox({
    accessToken: token,
    fetch: fetch
  });
}

// Format path for Dropbox API
function formatDropboxPath(path) {
  if (!path || path === '/') return '';
  let formattedPath = path.trim().replace(/\/*$/, '');
  if (!formattedPath.startsWith('/')) {
    formattedPath = '/' + formattedPath;
  }
  console.log('📁 Formatted path:', formattedPath);
  return formattedPath;
}

// Get latest changes
export async function listFolderChanges() {
  console.log('🔄 Starting listFolderChanges');
  const dbx = createDropboxClient();
  const path = formatDropboxPath(process.env.DROPBOX_FOLDER_PATH || '');
  
  try {
    console.log('🔍 Listing folder contents:', path);
    
    // Primero obtener el cursor actual para la carpeta
    const response = await dbx.filesListFolder({
      path,
      recursive: true,
      include_deleted: false,
      limit: 1,
      include_has_explicit_shared_members: false
    });

    console.log('📊 API Response:', JSON.stringify({
      entries: response.result.entries.map(e => ({
        name: e.name,
        path_display: e.path_display,
        '.tag': e['.tag']
      }))
    }, null, 2));

    const files = response.result.entries.filter(entry => entry['.tag'] === 'file');
    
    if (files.length === 0) {
      console.log('ℹ️ No files found in folder');
      return [];
    }

    const lastFile = files[0];
    console.log('✅ Found file:', {
      name: lastFile.name,
      path: lastFile.path_display,
      size: lastFile.size,
      modified: lastFile.server_modified
    });
    
    return [{
      name: lastFile.name,
      path: lastFile.path_display,
      size: lastFile.size,
      modified: lastFile.server_modified
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
