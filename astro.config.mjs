import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// Served from https://<user>.github.io/orbit/
export default defineConfig({
  base: '/orbit/',
  server: { port: 4322 },
  integrations: [preact()],
});
