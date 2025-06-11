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
    const folderPath = process.env.DROPBOX_FOLDER_PATH || '';
    
    // Obtener archivos de la carpeta
    const response = await dbx.filesListFolder({
      path: folderPath,
      recursive: false,
      limit: 1,
      include_deleted: false
    });

    // Filtrar solo archivos y ordenar por fecha
    const files = response.result.entries
      .filter(entry => entry['.tag'] === 'file')
      .sort((a, b) => new Date(b.server_modified) - new Date(a.server_modified));

    if (files.length === 0) return [];
    
    // Devolver solo el archivo más reciente
    const lastFile = files[0];
    return [{
      name: lastFile.name,
      path: lastFile.path_display || lastFile.path_lower
    }];
  } catch (error) {
    // Solo registrar errores críticos
    throw error;
  }
}
