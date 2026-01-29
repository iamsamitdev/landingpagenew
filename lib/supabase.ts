import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client สำหรับ Frontend (มีสิทธิ์จำกัด)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Client สำหรับ Server (มีสิทธิ์เต็ม - ใช้สำหรับ API routes และ scripts)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
