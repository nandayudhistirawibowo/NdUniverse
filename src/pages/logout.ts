import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ locals, redirect }) => {
  if (locals.user) {
    await locals.supabase.auth.signOut();
  }

  return redirect('/login', 302);
};