import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string) => {
  // Vite performs static replacement for these literals
  if (key === 'SUPABASE_URL') {
    const val = (import.meta as any).env?.VITE_SUPABASE_URL || 
           (import.meta as any).env?.SUPABASE_URL || 
           (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : '') ||
           (typeof process !== 'undefined' ? process.env.SUPABASE_URL : '') ||
           '';
    
    if (val.includes('your-project') || val.includes('placeholder')) return '';
    return val;
  }
  if (key === 'SUPABASE_ANON_KEY') {
    const val = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 
           (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
           (import.meta as any).env?.SUPABASE_ANON_KEY || 
           (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_ANON_KEY : '') ||
           (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_PUBLISHABLE_KEY : '') ||
           (typeof process !== 'undefined' ? process.env.SUPABASE_ANON_KEY : '') ||
           '';
    
    if (val.includes('your-anon-key') || val.includes('placeholder')) return '';
    return val;
  }

  // General fallback
  try {
    const metaEnv = (import.meta as any).env;
    if (metaEnv && metaEnv[key]) return metaEnv[key];
    if (metaEnv && metaEnv[`VITE_${key}`]) return metaEnv[`VITE_${key}`];
    
    if (typeof process !== 'undefined' && process.env) {
      const env = process.env as any;
      if (env[key]) return env[key];
      if (env[`VITE_${key}`]) return env[`VITE_${key}`];
    }
  } catch (e) {}

  return '';
};

// Lazy initialization to prevent crash if keys are missing
export const getSupabase = () => {
  const supabaseUrl = getEnv('SUPABASE_URL');
  const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  
  if (!supabaseUrl.startsWith('http')) {
     console.warn('Supabase URL must start with http/https');
     return null;
  }

  try {
    return createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error('Supabase initialization failed:', error);
    return null;
  }
};

export const testSupabaseConnection = async () => {
  const client = getSupabase();
  if (!client) return false;
  try {
    // Simple query to check if the table exists and keys work
    const { error } = await client.from('products').select('*', { count: 'exact', head: true }).limit(1);
    return !error;
  } catch (err) {
    return false;
  }
};

export const supabase = getSupabase();
