import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Renderer-side Supabase client. Uses the anon key — all access is gated by
// RLS policies in the database. Prisma runs in the main process (Node.js);
// this client is for renderer-to-Supabase REST/realtime/storage calls.
//
// Lazy singleton so module evaluation never throws during SSR (Next.js runs
// 'use client' components on the server too). The client is only created when
// first accessed, by which point NEXT_PUBLIC_* vars are always resolved.
let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Supabase env vars not configured')
    _supabase = createClient(url, key)
  }
  return _supabase
}

// Convenience proxy — keeps call-sites as `supabase.from(...)` unchanged.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
