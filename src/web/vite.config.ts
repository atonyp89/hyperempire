import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The API lives in ../server. In development (VITE_API_URL=local) the web app bundles it and runs it in the
// browser; `@server/*` points there. PGlite ships its own WebAssembly, so Vite mustn't pre-bundle it.
export default defineConfig(({ command, mode }) => {
  // ADMIN_USER / ADMIN_PASSWORD (no VITE_ prefix, so they never reach import.meta.env) turn on the admin
  // dashboard of the in-browser server. Dev server only: a build gets null.
  const here = (p: string) => decodeURIComponent(new URL(p, import.meta.url).pathname);
  const env = loadEnv(mode, here('.'), '');
  const localAdmin = command === 'serve' && env.ADMIN_USER && env.ADMIN_PASSWORD ? { user: env.ADMIN_USER, password: env.ADMIN_PASSWORD } : null;
  return {
    plugins: [react()],
    define: { __LOCAL_ADMIN__: JSON.stringify(localAdmin) },
    resolve: { alias: { '@server': here('../server/src') } },
    optimizeDeps: { exclude: ['@electric-sql/pglite'] },
    server: { port: 5173, fs: { allow: ['..'] } },
    build: { rollupOptions: { input: { main: here('index.html'), admin: here('admin.html') } } },
  };
});
