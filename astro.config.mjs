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
    sitemap({ customSitemaps: [`${site}/sitemap-content.xml`] }),
  ],
  adapter: vercel()
});