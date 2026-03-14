// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://perqed.com',
  base: '/',
  build: {
    assets: '_assets',
  },
});
