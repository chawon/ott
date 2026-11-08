import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const acceptLanguage = request.headers.get("accept-language") || "";
  const isEn = acceptLanguage.toLowerCase().startsWith("en");

  return NextResponse.json(
    {
      id: "/",
      name: "ottline",
      short_name: "ottline",
      description: isEn
        ? "Stream. Read. Remember. Your personal content timeline"
        : "보고, 읽고, 남기다. 나만의 타임라인",
      start_url: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#F8F6F2",
      theme_color: "#F8F6F2",
      lang: isEn ? "en" : "ko",
      categories: ["entertainment", "books", "lifestyle", "productivity"],
      icons: [
        {
          src: "/brand/v2/app-icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/brand/v2/app-icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable",
        },
        {
          src: "/brand/v2/app-icon-180.png",
          sizes: "180x180",
          type: "image/png",
        },
      ],
      screenshots: [
        {
          src: isEn ? "/pwa/v2-en-desktop.png" : "/pwa/v2-ko-desktop.png",
          sizes: "1280x720",
          type: "image/png",
          form_factor: "wide",
          label: isEn
            ? "Your timeline on Home (desktop)"
            : "홈의 내 타임라인 (PC)",
        },
        {
          src: isEn ? "/pwa/v2-en-mobile.png" : "/pwa/v2-ko-mobile.png",
          sizes: "720x1280",
          type: "image/png",
          form_factor: "narrow",
          label: isEn
            ? "Your timeline on Home (mobile)"
            : "홈의 내 타임라인 (모바일)",
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
    },
    {
      headers: {
        "content-type": "application/manifest+json; charset=utf-8",
      },
    },
  );
}
