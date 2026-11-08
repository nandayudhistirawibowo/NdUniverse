import { defineMiddleware } from 'astro:middleware';
import { createServerClient } from '@supabase/ssr';
import { isAdminNim } from '@core/auth/admin';

function parseCookieHeader(header: string) {
  return header.split(';').flatMap((part) => {
    const separator = part.indexOf('=');
    if (separator <= 0) return [];

    const name = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();

    try {
      return [{ name: decodeURIComponent(name), value: decodeURIComponent(rawValue) }];
    } catch {
      return [{ name, value: rawValue }];
    }
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) return next();

  const requestCookies = context.request.headers.get('cookie') ?? '';

  const supabase = createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(requestCookies);
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            context.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  context.locals.supabase = supabase;
  context.locals.user = user;
  context.locals.profile = null;

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nim, nama_lengkap, nomor_wa, avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    context.locals.profile = profile;
  }

  const isAdminLogin = context.url.pathname === '/admin/login';
  const isAdminRoute = context.url.pathname === '/admin' || context.url.pathname.startsWith('/admin/');

  if (isAdminLogin && user) {
    return context.redirect(isAdminNim(context.locals.profile?.nim)
      ? '/admin'
      : '/dashboard?error=admin-only');
  }

  if (isAdminRoute && !isAdminLogin) {
    if (!user) {
      const returnTo = `${context.url.pathname}${context.url.search}`;
      return context.redirect(`/admin/login?redirect=${encodeURIComponent(returnTo)}`);
    }

    if (!isAdminNim(context.locals.profile?.nim)) {
      return context.redirect('/dashboard?error=admin-only');
    }
  }

  const isCareerRoute = context.url.pathname === '/career' || context.url.pathname.startsWith('/career/');
  const isDashboardHelpRoute = context.url.pathname === '/bantuan';
  if ((context.url.pathname.startsWith('/dashboard') || isCareerRoute || isDashboardHelpRoute) && !user) {
    const returnTo = `${context.url.pathname}${context.url.search}`;
    return context.redirect(`/login?redirect=${encodeURIComponent(returnTo)}`);
  }

  return next();
});
