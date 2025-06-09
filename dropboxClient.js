import axios from 'axios';
let cursor = null;

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
    console.log(`✅ New entries fetched: ${res.data.entries.length}`);
    return res.data.entries;
  } catch (error) {
    console.error('❌ Dropbox API error:', error.response?.data || error.message);
    return [];
  }
}
