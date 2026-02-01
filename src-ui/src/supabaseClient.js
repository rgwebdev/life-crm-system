import { createClient } from '@supabase/supabase-js'

// Сюда вставь то, что скопировал с сайта:
const supabaseUrl = 'https://snozqubtvdvnalabslxs.supabase.co'
const supabaseKey = 'sb_publishable_T8sO0oNxN0puV9-ss9F3hw_yxsPy0n3'

export const supabase = createClient(supabaseUrl, supabaseKey)