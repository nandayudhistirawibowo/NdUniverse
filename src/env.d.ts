/// <reference types="astro/client" />

import type { SupabaseClient, User } from '@supabase/supabase-js';

interface StudentProfile {
  id: string;
  nim: string;
  nama_lengkap: string | null;
  nomor_wa: string | null;
  avatar_url: string | null;
}

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient;
      user: User | null;
      profile: StudentProfile | null;
    }
  }
}
