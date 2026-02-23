import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import PwaInstallBanner from "@/components/PwaInstallBanner";
import SyncWorker from "@/components/SyncWorker";
import SwipeNav from "@/components/SwipeNav";
import { RetroProvider } from "@/context/RetroContext";
import { ThemeProvider } from "@/context/ThemeContext";

export const metadata: Metadata = {
    title: {
        default: "On the Timeline | 로그인 없이 영상·책 기록",
        template: "%s | On the Timeline",
    },
    description: "가입 없이 영상·책 기록을 10초 만에 남기고 타임라인으로 모아보세요. 영상과 책을 가장 빠르게 기록하는 방법.",
    manifest: "/manifest.webmanifest",
    icons: {
        icon: "/icon.png",
        apple: "/apple-touch-icon.png",
    },
    appleWebApp: {
        capable: true,
        title: "On the Timeline",
        statusBarStyle: "black-translucent",
    },
    openGraph: {
        title: "On the Timeline",
        description: "로그인 없이 바로 남기는 영상·책 기록",
        url: "https://ott.preview.pe.kr", // 실제 운영 URL로 변경 필요
        siteName: "On the Timeline",
        locale: "ko_KR",
        type: "website",
    },
};

export const viewport: Viewport = {
    themeColor: "#111827",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    const themeInitScript = `
(() => {
  try {
    const root = document.documentElement;
    const retro = localStorage.getItem("retro-mode") === "true";
    if (retro) {
      root.classList.add("retro");
      root.classList.remove("dark");
      return;
    }
    root.classList.remove("retro");
    const mode = localStorage.getItem("theme-mode") || "system";
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = mode === "dark" || (mode === "system" && prefersDark);
    root.classList.toggle("dark", isDark);
  } catch (_) {}
})();
`;
    return (
        <html lang="ko" suppressHydrationWarning>
        <head>
            <meta name="naver-site-verification" content="a7a2d3521b1bcb813f5e7535f4e46ffb564c113a" />
            <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        </head>
        <body className="min-h-screen bg-background text-foreground font-sans antialiased transition-colors duration-300">
        <RetroProvider>
            <ThemeProvider>
                <AppHeader />
                <SwipeNav />
                <PwaInstallBanner />
                <SyncWorker />
                <main className="mx-auto max-w-5xl px-4 py-8">
                    {children}
                </main>
                <AppFooter />
            </ThemeProvider>
        </RetroProvider>
        </body>
        </html>
    );
}
