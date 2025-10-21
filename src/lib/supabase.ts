import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your environment variables.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Booking {
  id: string;
  name: string;
  whatsapp: string;
  email?: string;
  service_type: string;
  preferred_date: string;
  preferred_time: string;
  notes?: string;
  created_at: string;
}
