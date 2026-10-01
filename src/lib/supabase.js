import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// SECURITY: fail loudly rather than silently hitting placeholder URLs
if (!supabaseUrl || !supabaseKey) {
  if (import.meta.env.PROD) {
    throw new Error('Supabase credentials missing in production build. Aborting.');
  }
  console.error(
    '%c[Afterhours] Supabase credentials missing!',
    'color:#fff;background:#c00;padding:4px 8px;font-weight:bold;font-size:14px;',
    '\nCopy .env.example → .env.local and fill in your project URL and publishable key.'
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);
