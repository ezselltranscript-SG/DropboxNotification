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
  try {
    const dbx = createDropboxClient();
    const path = process.env.DROPBOX_FOLDER_PATH || '';
    
    console.log('🔍 Buscando en la ruta:', path || '(raíz)');
    
    const response = await dbx.filesListFolder({
      path: path || '',
      recursive: true,
      limit: 10,  // Aumentamos el límite para ver más archivos
      include_deleted: false
    });

    console.log(`📂 Contenido de la carpeta (${response.result.entries.length} elementos):`);
    response.result.entries.forEach((entry, i) => {
      console.log(`   ${i + 1}. [${entry['.tag']}] ${entry.name}${entry['.tag'] === 'file' ? ` (${entry.size} bytes)` : ''}`);
    });

    const files = response.result.entries
      .filter(entry => entry['.tag'] === 'file')
      .sort((a, b) => new Date(b.server_modified) - new Date(a.server_modified));

    if (files.length === 0) {
      console.log('ℹ️ No se encontraron archivos');
      return [];
    }
    
    const lastFile = files[0];
    console.log('✅ Archivo más reciente:', lastFile.name);
    
    return [{
      name: lastFile.name,
      path: lastFile.path_display || lastFile.path_lower
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
