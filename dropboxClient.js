import axios from 'axios';
let cursor = null;
let lastModifiedTime = new Date(process.env.LAST_MODIFIED_TIME || 0);

async function getMetadata(path, headers) {
  if (process.env.INCLUDE_MEDIA === 'true') {
    try {
      const res = await axios.post(
        'https://api.dropboxapi.com/2/files/get_metadata',
        {
          path: path,
          include_media_info: true
        },
        { headers }
      );
      return res.data;
    } catch (error) {
      console.error('❌ Error fetching metadata:', error.message);
      return null;
    }
  }
  return null;
}

async function getTemporaryLink(path, headers) {
  if (process.env.INCLUDE_TEMP_LINK === 'true') {
    try {
      const res = await axios.post(
        'https://api.dropboxapi.com/2/files/get_temporary_link',
        { path: path },
        { headers }
      );
      return res.data.link;
    } catch (error) {
      console.error('❌ Error getting temporary link:', error.message);
      return null;
    }
  }
  return null;
}

export async function listFolderChanges() {
  const headers = {
    Authorization: `Bearer ${process.env.DROPBOX_TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    if (!cursor) {
      console.log('📥 Getting latest cursor state...');
      const res = await axios.post(
        'https://api.dropboxapi.com/2/files/list_folder/get_latest_cursor',
        {
          path: process.env.DROPBOX_FOLDER_PATH,
          recursive: false,
          include_deleted: false
        },
        { headers }
      );
      cursor = res.data.cursor;
      console.log('✅ Latest cursor obtained');
      return [];
    }

    console.log('🔄 Polling Dropbox for new changes...');
    const res = await axios.post(
      'https://api.dropboxapi.com/2/files/list_folder/continue',
      { cursor },
      { headers }
    );
    cursor = res.data.cursor;

    const newEntries = [];
    for (const entry of res.data.entries) {
      if (entry['.tag'] !== 'file') continue;

      const modified = new Date(entry.server_modified);
      if (modified <= lastModifiedTime) {
        console.log(`⏭ Skipping old file: ${entry.name}`);
        continue;
      }

      // Enrich with additional metadata if configured
      if (process.env.INCLUDE_MEDIA === 'true' || process.env.INCLUDE_TEMP_LINK === 'true') {
        const metadata = await getMetadata(entry.path_display, headers);
        const tempLink = await getTemporaryLink(entry.path_display, headers);
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
    console.error('❌ Dropbox API error:', error.response?.data || error.message);
    return [];
  }
}
