/**
 * ============================================================================
 * GALLERY MANAGER  (tools/gallery-manager/server.mjs)
 * ============================================================================
 *
 * Start with:   npm run manage
 * Stop with:    Ctrl + C in the terminal
 *
 * WHAT HAPPENS
 * 1. A small web server starts on this computer only (127.0.0.1).
 * 2. Requests to /api/... are handled by api/router.mjs (reading and writing
 *    the gallery folders, photos and testimonials).
 * 3. Everything else is the manager's user interface in app/, a React app.
 *    Vite (the same tool Astro uses) compiles the .tsx files on the fly, and
 *    the page reloads automatically when you edit the manager's code.
 * 4. Your browser opens the manager.
 *
 * The manager only changes files in this project. To publish, commit and push
 * with Git as usual (see docs/DEPLOYMENT.md).
 * ============================================================================
 */

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import react from '@vitejs/plugin-react';
import { handleApi } from './api/router.mjs';
import { stopPreview } from './api/preview.mjs';

const HOST = '127.0.0.1';
const FIRST_PORT = 4400;

/** A new secret for every start. The page receives it, other websites don't. */
const token = randomBytes(24).toString('hex');

/** Opens a URL in the default browser (Windows, macOS or Linux). */
function openBrowser(url) {
  const command =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(command[0], command[1], { stdio: 'ignore', detached: true, windowsVerbatimArguments: true }).unref();
}

/** Tries ports 4400, 4401 ... until one is free. */
function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE' && port < FIRST_PORT + 20) resolve(listen(server, port + 1));
      else reject(error);
    });
    server.listen(port, HOST, () => resolve(port));
  });
}

const httpServer = createServer();

// Vite serves and compiles the React app in app/
const vite = await createViteServer({
  configFile: false, // don't use any vite.config file, everything is set here
  root: path.join(import.meta.dirname, 'app'),
  cacheDir: path.join(import.meta.dirname, '..', '..', 'node_modules', '.vite-gallery-manager'),
  appType: 'spa',
  logLevel: 'warn',
  server: { middlewareMode: true, hmr: { server: httpServer } },
  plugins: [
    react(),
    {
      // Puts the secret token into index.html so the app can send it with every request
      name: 'manager-token',
      transformIndexHtml: (html) => html.replaceAll('%MANAGER_TOKEN%', token),
    },
  ],
});

let origins = [];
let hosts = [];
httpServer.on('request', (req, res) => {
  // Only answer requests addressed to this computer by name. This blocks a trick
  // called "DNS rebinding", where a foreign website pretends to be localhost.
  if (!hosts.includes(req.headers.host)) {
    res.writeHead(403).end('Forbidden host');
    return;
  }
  if (req.url?.startsWith('/api/')) handleApi(req, res, { token, origins });
  else vite.middlewares(req, res);
});

const port = await listen(httpServer, FIRST_PORT);
hosts = [`${HOST}:${port}`, `localhost:${port}`];
origins = hosts.map((host) => `http://${host}`);
const url = `http://${HOST}:${port}/`;

console.log(`\n  Gallery manager running at ${url}`);
console.log('  Press Ctrl + C to stop.\n');
if (!process.argv.includes('--no-open')) openBrowser(url);

// Clean shutdown on Ctrl + C
async function shutdown() {
  console.log('\n  Stopping the gallery manager ...');
  await stopPreview();
  await vite.close();
  httpServer.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
