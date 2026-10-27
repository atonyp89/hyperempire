/**
 * Admin login for the in-browser server, from ADMIN_USER / ADMIN_PASSWORD in .env.local. Set by vite.config.ts on
 * the dev server only; null in production builds, so the login is never shipped.
 */
declare const __LOCAL_ADMIN__: { user: string; password: string } | null;
