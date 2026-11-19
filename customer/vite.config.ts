import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const here = path.dirname(fileURLToPath(import.meta.url));
const adminDist = path.resolve(here, '../admin/dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const adminPanel: Plugin = {
  name: 'badshah-admin-panel',
  configureServer(server) {
    server.middlewares.use('/admin', (req, res, next) => {
      const request = req as { url?: string };
      const urlPath = decodeURIComponent((request.url || '/').split('?')[0]);
      const relative = path.normalize(urlPath).replace(/^([/\\]|\.\.[/\\])+/, '');
      let filePath = path.join(adminDist, relative);

      if (!filePath.startsWith(adminDist)) return next();
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(adminDist, 'index.html');
      }
      if (!fs.existsSync(filePath)) return next();

      res.statusCode = 200;
      res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
      return fs.createReadStream(filePath).pipe(res);
    });
  },
};

export default defineConfig({
  plugins: [react(), adminPanel],
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
});
