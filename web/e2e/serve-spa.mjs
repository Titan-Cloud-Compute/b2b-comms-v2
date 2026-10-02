/**
 * Dependency-free static HTTP server with index.html fallback.
 * Usage: node serve-spa.mjs <dir> <port>
 * Unknown paths (not actual files) return index.html so Angular routing works.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const dir = process.argv[2] || 'dist/frontend/browser';
const port = parseInt(process.argv[3] || '4200', 10);

const MIME = {
  '.html':        'text/html; charset=utf-8',
  '.js':          'application/javascript',
  '.mjs':         'application/javascript',
  '.css':         'text/css',
  '.json':        'application/json',
  '.png':         'image/png',
  '.svg':         'image/svg+xml',
  '.ico':         'image/x-icon',
  '.woff':        'font/woff',
  '.woff2':       'font/woff2',
  '.ttf':         'font/ttf',
  '.txt':         'text/plain',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer((req, res) => {
  const urlPath = new URL(req.url, 'http://localhost').pathname;

  // Decode URI and resolve against the served directory
  const decoded = decodeURIComponent(urlPath);
  const filePath = join(dir, decoded);

  // Serve the file if it exists and is a regular file
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    createReadStream(filePath).pipe(res);
    return;
  }

  // SPA fallback: return index.html for all unknown paths (Angular routes)
  const indexPath = join(dir, 'index.html');
  if (!existsSync(indexPath)) {
    res.writeHead(404);
    res.end('index.html not found — run ng build first');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  createReadStream(indexPath).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Serving ${dir} on http://127.0.0.1:${port}\n`);
});
