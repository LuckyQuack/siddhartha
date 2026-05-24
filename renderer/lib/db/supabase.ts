import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Renderer-side Supabase client. Uses the anon key — all access is gated by
// RLS policies in the database. Prisma runs in the main process (Node.js);
// this client is for renderer-to-Supabase REST/realtime/storage calls.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
