import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API lives in ../server. In development (VITE_API_URL=local) the web app bundles it and runs it in the
// browser; `@server/*` points there. PGlite ships its own WebAssembly, so Vite mustn't pre-bundle it.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@server': decodeURIComponent(new URL('../server/src', import.meta.url).pathname) } },
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  server: { port: 5173, fs: { allow: ['..'] } },
});
