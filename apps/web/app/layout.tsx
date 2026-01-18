import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import PwaInstallBanner from "@/components/PwaInstallBanner";
import SyncWorker from "@/components/SyncWorker";
import { RetroProvider } from "@/context/RetroContext";

export const metadata: Metadata = {
    title: {
        default: "On the Timeline | 로그인 없이 시청 기록",
        template: "%s | On the Timeline",
    },
    description: "가입 없이 OTT 시청 기록을 10초 만에 남기고 타임라인으로 모아보세요. 나만의 필모그래피를 가장 빠르게 기록하는 방법.",
    manifest: "/manifest.webmanifest",
    icons: {
        icon: "/icon.png",
        apple: "/apple-touch-icon.png",
    },
    appleWebApp: {
        capable: true,
        title: "OTT",
        statusBarStyle: "black-translucent",
    },
    openGraph: {
        title: "On the Timeline",
        description: "로그인 없이 바로 남기는 시청 기록",
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
    return (
        <html lang="ko">
        <body className="min-h-screen bg-background text-foreground font-sans antialiased transition-colors duration-300">
        <RetroProvider>
            <AppHeader />
            <PwaInstallBanner />
            <SyncWorker />
            <main className="mx-auto max-w-5xl px-4 py-8">
                {children}
            </main>
            <AppFooter />
        </RetroProvider>
        </body>
        </html>
    );
}