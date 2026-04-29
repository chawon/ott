import type { MetadataRoute } from "next";
import { headers } from "next/headers";

type WebShareTarget = {
  action: string;
  method: "GET";
  params: {
    title: string;
    text: string;
    url: string;
  };
};

type OttlineManifest = MetadataRoute.Manifest & {
  share_target: WebShareTarget;
};

export default async function manifest(): Promise<OttlineManifest> {
  const headerList = await headers();
  const acceptLanguage = headerList.get("accept-language") || "";
  const isEn = acceptLanguage.toLowerCase().startsWith("en");

  return {
    id: "/",
    name: "ottline",
    short_name: "ottline",
    description: isEn
      ? "Stream. Read. Remember. Your personal content timeline"
      : "보고, 읽고, 남기다. 나만의 타임라인",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F0F6FF",
    theme_color: "#1E4D8C",
    lang: isEn ? "en" : "ko",
    categories: isEn
      ? ["entertainment", "books", "lifestyle", "productivity"]
      : ["entertainment", "books", "lifestyle", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    screenshots: [
      {
        src: "/pwa/screenshot-desktop-wide.png",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide",
        label: isEn
          ? "Home timeline and quick log entry (Desktop)"
          : "홈 타임라인과 퀵로그 입력 화면 (데스크톱)",
      },
      {
        src: "/pwa/screenshot-mobile-narrow.png",
        sizes: "720x1280",
        type: "image/png",
        form_factor: "narrow",
        label: isEn
          ? "Home timeline and quick log entry (Mobile)"
          : "홈 타임라인과 퀵로그 입력 화면 (모바일)",
      },
    ],
    share_target: {
      action: "/?quick=1&quick_focus=1",
      method: "GET",
      params: {
        title: "shared_subject",
        text: "shared_text",
        url: "shared_url",
      },
    },
  };
}
