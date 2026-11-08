import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ locals, redirect, url }) => {
  if (locals.user) {
    await locals.supabase.auth.signOut();
  }

  const loginPath = url.searchParams.get('module') === 'en' ? '/login-en' : '/login-de';
  return redirect(loginPath, 302);
};