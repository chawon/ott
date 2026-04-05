import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'ottline',
  brand: {
    displayName: 'ottline',
    primaryColor: '#1E4D8C',
    icon: './public/icon-192.png',
  },
  web: {
    host: 'localhost',
    port: 3000,
    commands: {
      dev: 'next dev',
      build: 'npm run build:next-ait',
    },
  },
  permissions: [],
  outdir: 'dist',
});
