import pkg from 'dropbox';
const { Dropbox } = pkg;
import 'dotenv/config';

let cursor = null;
let lastModifiedTime = new Date(process.env.LAST_MODIFIED_TIME || 0);

// Create a new Dropbox client for each operation
function createDropboxClient() {
  return new Dropbox({
    accessToken: process.env.DROPBOX_TOKEN
  });
}

// Format path for Dropbox API
function formatDropboxPath(path) {
  if (!path || path === '/') {
    return '';
  }

  // Remove leading/trailing slashes and spaces
  let formattedPath = path.trim();
  
  // Remove any trailing slashes
  formattedPath = formattedPath.replace(/\/*$/, '');
  
  // Ensure path starts with exactly one slash
  if (!formattedPath.startsWith('/')) {
    formattedPath = '/' + formattedPath;
  }
  
  return formattedPath;
}

// Get metadata for a file
async function getMetadata(path) {
  try {
    const dbx = await createDropboxClient();
    const formattedPath = formatDropboxPath(path);
    console.log('🔍 Getting metadata for path:', formattedPath);
    
    const response = await dbx.filesGetMetadata({
      path: formattedPath,
      include_media_info: process.env.INCLUDE_MEDIA === 'true'
    });
    return response.result;
  } catch (error) {
    console.error('❌ Error getting metadata:', error);
    return null;
  }
}

// Get temporary link for a file
async function getTemporaryLink(path) {
  try {
    const dbx = await createDropboxClient();
    const formattedPath = formatDropboxPath(path);
    console.log('🔍 Getting temporary link for path:', formattedPath);
    
    const response = await dbx.filesGetTemporaryLink({
      path: formattedPath
    });
    return response.result.link;
  } catch (error) {
    console.error('❌ Error getting temporary link:', error);
    return null;
  }
}

// Main function to list folder changes
export async function listFolderChanges() {
  try {
    // Create a new client for this operation
    const dbx = await createDropboxClient();

    if (!cursor) {
      console.log('📥 Getting latest cursor state...');
      const rawPath = process.env.DROPBOX_FOLDER_PATH || '';
      const path = formatDropboxPath(rawPath);
      console.log('🔍 Using path:', path);

      // First verify that the path exists and is a folder
      const metadata = await dbx.filesGetMetadata({
        path,
        include_media_info: process.env.INCLUDE_MEDIA === 'true',
      });

      console.log('🗂 Path metadata:', metadata.result);
      
      if (metadata.result['.tag'] !== 'folder') {
        throw new Error(`Path ${path} is not a folder`);
      }

      // Get initial folder state and cursor
      const response = await dbx.filesListFolder({
        path,
        recursive: true,
        include_deleted: false,
        include_media_info: process.env.INCLUDE_MEDIA === 'true',
        include_has_explicit_shared_members: false,
        include_mounted_folders: true
      });
      
      cursor = response.result.cursor;
      console.log('✅ Got initial cursor:', cursor);
      console.log(`✅ Initial fetch complete. Entries: ${response.result.entries.length}`);

      const newEntries = [];
      for (const entry of response.result.entries) {
        if (entry['.tag'] !== 'file') continue;

        const modified = new Date(entry.server_modified);
        if (modified <= lastModifiedTime) {
          console.log(`⏭ Skipping old file: ${entry.name}`);
          continue;
        }

        // Enrich with additional metadata if configured
        if (process.env.INCLUDE_MEDIA === 'true' || process.env.INCLUDE_TEMP_LINK === 'true') {
          const metadata = await getMetadata(entry.path_display);
          const tempLink = await getTemporaryLink(entry.path_display);
          entry.enriched_metadata = metadata;
          entry.temporary_link = tempLink;
        }

        console.log(`🚀 New file based on mod time: ${entry.name}`);
        newEntries.push(entry);
        lastModifiedTime = modified;
      }
      return newEntries;
    }

    console.log('🔄 Polling Dropbox for new changes...');
    const response = await dbx.filesListFolderContinue({ cursor });
    cursor = response.result.cursor;
    console.log(`✅ New entries fetched: ${response.result.entries.length}`);
    const newEntries = [];
    for (const entry of response.result.entries) {
      if (entry['.tag'] !== 'file') continue;

      const modified = new Date(entry.server_modified);
      if (modified <= lastModifiedTime) {
        console.log(`⏭ Skipping old file: ${entry.name}`);
        continue;
      }

      // Enrich with additional metadata if configured
      if (process.env.INCLUDE_MEDIA === 'true' || process.env.INCLUDE_TEMP_LINK === 'true') {
        const metadata = await getMetadata(entry.path_display);
        const tempLink = await getTemporaryLink(entry.path_display);
        entry.enriched_metadata = metadata;
        entry.temporary_link = tempLink;
      }

      console.log(`🚀 New file based on mod time: ${entry.name}`);
      newEntries.push(entry);
      lastModifiedTime = modified;
    }

    console.log(`✅ New entries processed: ${newEntries.length}`);
    return newEntries;
  } catch (error) {
    console.error('❌ Dropbox API error:', error);
    return [];
  }
}
