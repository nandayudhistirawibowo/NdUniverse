import { defineMiddleware } from 'astro:middleware';
import { createServerClient } from '@supabase/ssr';
import { isAdminNim } from '@core/auth/admin';

const ENGLISH_PROTECTED_ROUTES = [
  '/en/dashboard',
  '/en/materi',
  '/en/career',
  '/en/exam',
  '/en/grammar',
  '/en/pronunciation',
  '/en/leaderboard',
];

const GERMAN_PROTECTED_ROUTES = [
  '/dashboard',
  '/dashboard-de',
  '/de/dashboard',
  '/career',
  '/bantuan',
  '/de/materi',
  '/de/alltagsdeutsch',
  '/de/fachdeutsch',
  '/de/career',
  '/de/ujian',
  '/de/grammar',
  '/de/pengucapan',
  '/de/leaderboard',
];

function isRouteOrSubroute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

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

  const isEnglishProtectedRoute = ENGLISH_PROTECTED_ROUTES.some((route) => (
    isRouteOrSubroute(context.url.pathname, route)
  ));
  const isGermanProtectedRoute = GERMAN_PROTECTED_ROUTES.some((route) => (
    isRouteOrSubroute(context.url.pathname, route)
  ));
  if ((isEnglishProtectedRoute || isGermanProtectedRoute) && !user) {
    const returnTo = `${context.url.pathname}${context.url.search}`;
    const loginPath = isEnglishProtectedRoute ? '/login-en' : '/login-de';
    return context.redirect(`${loginPath}?redirect=${encodeURIComponent(returnTo)}`);
  }

  return next();
});
