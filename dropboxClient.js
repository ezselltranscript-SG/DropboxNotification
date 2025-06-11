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
    console.log('🔍 Creando cliente de Dropbox...');
    const dbx = createDropboxClient();
    const folderPath = process.env.DROPBOX_FOLDER_PATH || '';
    console.log('📂 Ruta de la carpeta:', folderPath || '(raíz)');
    
    // Primero listar el contenido de la raíz para ver qué hay
    console.log('🔄 Listando contenido de la raíz...');
    const rootResponse = await dbx.filesListFolder({
      path: '',
      recursive: true,
      include_deleted: false
    });
    
    //console.log('📦 Contenido de la raíz:');
    rootResponse.result.entries.forEach((entry, i) => {
      console.log(`   ${i + 1}. [${entry['.tag']}] ${entry.path_display}`);
    });
    
    // Ahora buscar en la carpeta específica
    //console.log(`🔍 Buscando archivos en: '${folderPath}'`);
    const response = await dbx.filesListFolder({
      path: folderPath,
      recursive: true,
      include_deleted: false
    });

    //console.log(`📦 Se encontraron ${response.result.entries.length} elementos en la carpeta`);
    
    // Mostrar información de depuración
    response.result.entries.forEach((entry, i) => {
      //console.log(`   ${i + 1}. [${entry['.tag']}] ${entry.name}${entry['.tag'] === 'file' ? ` (${entry.size} bytes)` : ''}`);
    });

    // Filtrar solo archivos y ordenar por fecha
    const files = response.result.entries
      .filter(entry => entry['.tag'] === 'file')
      .sort((a, b) => new Date(b.server_modified) - new Date(a.server_modified));

    console.log(`📊 ${files.length} archivos encontrados después de filtrar`);

    if (files.length === 0) {
      console.log('ℹ️ No se encontraron archivos en la carpeta');
      return [];
    }
    
    // Devolver solo el archivo más reciente
    const lastFile = files[0];
    console.log('✅ Most recent file:', lastFile.name);
    
    return [{
      name: lastFile.name,
      path: lastFile.path_display || lastFile.path_lower
    }];
  } catch (error) {
    console.error('❌ Error en listFolderChanges:', {
      message: error.message,
      status: error.status,
      stack: error.stack?.split('\n')[0]
    });
    throw error;
  }
}
