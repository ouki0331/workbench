import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist-cloudstudio');
const mime = {
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(
      new URL(req.url, 'http://localhost').pathname,
    );
    const target = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (target !== root && !target.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const body = await readFile(target);
    res.writeHead(200, {
      'Content-Type': mime[extname(target)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(Number(process.env.PORT || 3000), '0.0.0.0', () =>
  console.log('IELTS ready on port ' + (process.env.PORT || 3000)),
);
