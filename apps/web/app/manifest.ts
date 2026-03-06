import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const headerList = await headers();
  const acceptLanguage = headerList.get("accept-language") || "";
  const isEn = acceptLanguage.toLowerCase().startsWith("en");

  return {
    name: isEn ? "On the Timeline" : "On the Timeline | 로그인 없이 영상·책 기록",
    short_name: isEn ? "Timeline" : "발자취",
    description: isEn 
      ? "Watch and read log timeline without sign-up. Build your own footprints."
      : "가입 없이 남기는 영상과 책의 기록. 나의 타임라인을 만들어보세요.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#111827",
    lang: isEn ? "en" : "ko",
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
        label: isEn ? "Home timeline and quick log entry (Desktop)" : "홈 타임라인과 퀵로그 입력 화면 (데스크톱)",
      },
      {
        src: "/pwa/screenshot-mobile-narrow.png",
        sizes: "720x1280",
        type: "image/png",
        form_factor: "narrow",
        label: isEn ? "Home timeline and quick log entry (Mobile)" : "홈 타임라인과 퀵로그 입력 화면 (모바일)",
      },
    ],
  };
}
