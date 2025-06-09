import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

export async function checkIfProcessed(fileId) {
  const { data } = await supabase.from('processed_files').select('id').eq('id', fileId)
  return data.length > 0
}

export async function markAsProcessed(file) {
  await supabase.from('processed_files').insert([{ id: file.id, name: file.name, path: file.path_display }])
}
