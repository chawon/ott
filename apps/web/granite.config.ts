import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "ottline",
  brand: {
    displayName: "나만의 OTT 타임라인",
    primaryColor: "#1E4D8C",
    icon: "https://static.toss.im/appsintoss/32919/9113d17f-d3d0-49ba-81c7-ef74a629eb96.png",
  },
  webViewProps: {
    type: "partner",
  },
  web: {
    host: "localhost",
    port: 3000,
    commands: {
      dev: "next dev",
      build:
        "npm run build:next-ait",
    },
  },
  permissions: [],
  outdir: "dist",
});
