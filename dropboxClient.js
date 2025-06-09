import { Dropbox } from 'dropbox';
import 'dotenv/config';

let cursor = null;
let lastModifiedTime = new Date(process.env.LAST_MODIFIED_TIME || 0);
let dbx = null;

// Initialize Dropbox client with OAuth2 credentials
function initializeDropboxClient() {
  if (!dbx) {
    dbx = new Dropbox({
      clientId: process.env.DROPBOX_APP_KEY,
      clientSecret: process.env.DROPBOX_APP_SECRET,
      accessToken: process.env.DROPBOX_ACCESS_TOKEN,
      refreshToken: process.env.DROPBOX_REFRESH_TOKEN
    });
  }
  return dbx;
}

// Refresh access token when it expires
async function refreshAccessToken() {
  try {
    console.log('🔄 Refreshing access token...');
    const response = await dbx.auth.refreshAccessToken();
    process.env.DROPBOX_ACCESS_TOKEN = response.result.access_token;
    process.env.DROPBOX_REFRESH_TOKEN = response.result.refresh_token;
    
    // Update the client with new tokens
    dbx = new Dropbox({
      clientId: process.env.DROPBOX_APP_KEY,
      clientSecret: process.env.DROPBOX_APP_SECRET,
      accessToken: process.env.DROPBOX_ACCESS_TOKEN,
      refreshToken: process.env.DROPBOX_REFRESH_TOKEN
    });
    
    console.log('✅ Access token refreshed successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to refresh access token:', error);
    return false;
  }
}

// Get metadata for a file
async function getMetadata(path) {
  try {
    const response = await dbx.filesGetMetadata({
      path: path,
      include_media_info: process.env.INCLUDE_MEDIA === 'true'
    });
    return response.result;
  } catch (error) {
    if (error.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return await getMetadata(path);
      }
    }
    console.error('❌ Error getting metadata:', error);
    return null;
  }
}

// Get temporary link for a file
async function getTemporaryLink(path) {
  try {
    const response = await dbx.filesGetTemporaryLink({
      path: path
    });
    return response.result.link;
  } catch (error) {
    if (error.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return await getTemporaryLink(path);
      }
    }
    console.error('❌ Error getting temporary link:', error);
    return null;
  }
}

// Main function to list folder changes
export async function listFolderChanges() {
  try {
    initializeDropboxClient();

    if (!cursor) {
      console.log('📥 Getting latest cursor state...');
      const response = await dbx.filesListFolder({
        path: process.env.DROPBOX_FOLDER_PATH || '',
        recursive: true,
        include_deleted: false,
        include_media_info: process.env.INCLUDE_MEDIA === 'true',
        include_has_explicit_shared_members: false,
        include_mounted_folders: true
      });
      
      cursor = response.result.cursor;
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
    if (error.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return await listFolderChanges();
      }
    }
    console.error('❌ Dropbox API error:', error);
    return [];
  }
}
