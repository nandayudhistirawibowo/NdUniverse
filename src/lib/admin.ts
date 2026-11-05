import { createClient } from '@supabase/supabase-js';

const ADMIN_NIMS = new Set(['admin', '000000']);

export function isAdminNim(nim: unknown): boolean {
  return typeof nim === 'string' && ADMIN_NIMS.has(nim.trim().toLowerCase());
}

export function createServiceRoleClient() {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service role configuration is missing.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
