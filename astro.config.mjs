// @ts-check
import { defineConfig } from 'astro/config';

import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

import vercel from '@astrojs/vercel';

const site = 'https://nduniverse.ndhistira.my.id';

// https://astro.build/config
export default defineConfig({
  site,
  output: 'server',
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover'
  },
  integrations: [
    preact(),
    sitemap({
      customSitemaps: [`${site}/sitemap-content.xml`],
      filter: (page) => {
        const pathname = new URL(page).pathname.replace(/\/+$/, '') || '/';
        const privatePrefixes = ['/admin', '/dashboard', '/dashboard-de', '/de/dashboard', '/en/dashboard'];
        const corePublicPaths = ['/', '/de', '/en', '/login-de', '/login-en'];
        return !corePublicPaths.includes(pathname)
          && !privatePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
      },
    }),
  ],
  adapter: vercel()
});