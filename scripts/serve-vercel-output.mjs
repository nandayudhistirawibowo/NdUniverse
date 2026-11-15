import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputRoot = resolve(root, '.vercel/output');
const staticRoot = resolve(outputRoot, 'static');
const handlerPath = resolve(outputRoot, 'functions/_render.func/dist/server/entry.mjs');
const port = Number(process.env.PORT) || 4321;

if (!existsSync(handlerPath) || !existsSync(staticRoot)) {
  throw new Error('Vercel build output is missing. Run `npm run build` before starting the E2E server.');
}

const { default: astroHandler } = await import(pathToFileURL(handlerPath).href);
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.mp3', 'audio/mpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.xml', 'application/xml; charset=utf-8'],
]);

async function serveStaticAsset(url, response, method) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400).end('Malformed URL');
    return true;
  }

  let filePath = resolve(staticRoot, `.${pathname}`);
  if (filePath !== staticRoot && !filePath.startsWith(`${staticRoot}${sep}`)) {
    response.writeHead(400).end('Invalid path');
    return true;
  }

  try {
    if (statSync(filePath).isDirectory()) filePath = resolve(filePath, 'index.html');
    if (!statSync(filePath).isFile()) return false;
  } catch {
    return false;
  }

  response.setHeader('content-type', contentTypes.get(extname(filePath)) ?? 'application/octet-stream');
  if (method === 'HEAD') {
    response.writeHead(200).end();
  } else {
    response.writeHead(200);
    createReadStream(filePath).pipe(response);
  }
  return true;
}

createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url ?? '/', `http://${incoming.headers.host ?? '127.0.0.1'}`);
    if (await serveStaticAsset(url, outgoing, incoming.method)) return;

    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }

    const method = incoming.method ?? 'GET';
    const hasBody = method !== 'GET' && method !== 'HEAD';
    const request = new Request(url, {
      method,
      headers,
      ...(hasBody ? { body: Readable.toWeb(incoming), duplex: 'half' } : {}),
    });
    const rendered = await astroHandler.fetch(request);

    rendered.headers.forEach((value, name) => outgoing.setHeader(name, value));
    const setCookies = rendered.headers.getSetCookie();
    if (setCookies.length) outgoing.setHeader('set-cookie', setCookies);
    outgoing.writeHead(rendered.status);

    if (method === 'HEAD' || !rendered.body) {
      outgoing.end();
    } else {
      Readable.fromWeb(rendered.body).pipe(outgoing);
    }
  } catch (error) {
    console.error('Built Astro handler request failed.', error);
    if (!outgoing.headersSent) outgoing.writeHead(500);
    outgoing.end('Internal server error');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Built Astro output available at http://127.0.0.1:${port}`);
});
