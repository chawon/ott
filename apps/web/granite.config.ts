import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'ottline',
  brand: {
    displayName: '나만의 OTT 타임라인',
    primaryColor: '#1E4D8C',
    icon: 'https://static.toss.im/appsintoss/32919/41a50a1e-2c97-44c7-a0b7-bab2abc0f85f.png',
  },
  webViewProps: {
    type: 'partner',
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
