import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

const escapeXml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('Astro site URL is required to generate the content sitemap.');

  const [germanMaterials, englishMaterials, academicMaterials] = await Promise.all([
    getCollection('materi'),
    getCollection('englishEveryday'),
    getCollection('englishAcademic'),
  ]);
  const urls = [
    ...germanMaterials.map((item) => new URL(`/de/materi/${encodeURIComponent(item.id)}`, site)),
    ...englishMaterials.map((item) => {
      const slug = item.id.split('/').at(-1) ?? item.id;
      return new URL(`/en/materi/${encodeURIComponent(slug)}`, site);
    }),
    ...academicMaterials.map((item) => {
      const slug = item.id.split('/').at(-1) ?? item.id;
      return new URL(`/en/academic-english/${encodeURIComponent(slug)}`, site);
    }),
  ];
  const locations = [...new Set(urls.map((url) => url.toString()))]
    .map((url) => `<url><loc>${escapeXml(url)}</loc></url>`)
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locations}</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
