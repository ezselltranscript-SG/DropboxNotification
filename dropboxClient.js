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

// Get the most recently added file
export async function listFolderChanges() {
  const dbx = createDropboxClient();
  const path = formatDropboxPath(process.env.DROPBOX_FOLDER_PATH || '');
  
  try {
    console.log('🔍 Searching in folder path:', path);
    
    // Get the most recent file in the folder
    const response = await dbx.filesListFolder({
      path,
      recursive: true,
      limit: 10,  // Aumentamos el límite para asegurarnos de ver archivos
      include_deleted: false
    });

    console.log('📄 Found entries:', response.result.entries.length);
    response.result.entries.forEach(entry => {
      console.log(`- ${entry['.tag']} ${entry.name} (${entry.path_display})`);
    });

    const files = response.result.entries
      .filter(entry => entry['.tag'] === 'file')
      .sort((a, b) => new Date(b.server_modified) - new Date(a.server_modified));
    
    if (files.length === 0) {
      console.log('❌ No files found in folder');
      return [];
    }

    const lastFile = files[0];
    console.log('✅ Most recent file:', lastFile.name);
    
    return [{
      name: lastFile.name,
      path: lastFile.path_display
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
