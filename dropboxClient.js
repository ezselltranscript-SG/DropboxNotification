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

    // Listar contenido directo de la carpeta principal
    const response = await dbx.filesListFolder({
      path: folderPath,
      recursive: true,
      include_deleted: false
    });

    console.log(`📦 Contenido directo de ${folderPath}:`);
    response.result.entries.forEach((entry, i) => {
      console.log(`   ${i + 1}. [${entry['.tag']}] ${entry.name}`);
    });

    // Si hay archivos directos, devolver el más reciente
    const files = response.result.entries.filter(e => e['.tag'] === 'file');
    if (files.length > 0) {
      files.sort((a, b) => new Date(b.server_modified) - new Date(a.server_modified));
      const lastFile = files[0];
      console.log('✅ Last file:', lastFile.name);
      return [{ name: lastFile.name, path: lastFile.path_display || lastFile.path_lower }];
    }

    // Buscar en subcarpetas inmediatas
    const folders = response.result.entries.filter(e => e['.tag'] === 'folder');
    for (const folder of folders) {
      const subResponse = await dbx.filesListFolder({
        path: folder.path_display,
        recursive: true,
        include_deleted: false
      });
      const subFiles = subResponse.result.entries.filter(e => e['.tag'] === 'file');
      if (subFiles.length > 0) {
        subFiles.sort((a, b) => new Date(b.server_modified) - new Date(a.server_modified));
        const lastFile = subFiles[0];
        console.log('✅ Last file in subfolder:', lastFile.name);
        return [{ name: lastFile.name, path: lastFile.path_display || lastFile.path_lower }];
      }
    }

    console.log('ℹ️ No se encontraron archivos en la carpeta ni en subcarpetas inmediatas');
    return [];
  } catch (error) {
    console.error('❌ Error en listFolderChanges:', error);
    throw error;
  }
}

