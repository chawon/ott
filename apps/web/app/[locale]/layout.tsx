import type { Metadata, Viewport } from "next";
import "../globals.css";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import PwaInstallBanner from "@/components/PwaInstallBanner";
import SyncWorker from "@/components/SyncWorker";
import SwipeNav from "@/components/SwipeNav";
import { RetroProvider } from "@/context/RetroContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: {
      default: t("titleDefault"),
      template: t("titleTemplate"),
    },
    description: t("description"),
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
      description: t("description"),
      url: "https://ott.preview.pe.kr",
      siteName: "On the Timeline",
      locale: locale === "ko" ? "ko_KR" : "en_US",
      type: "website",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#111827",
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

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
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta
          name="naver-site-verification"
          content="a7a2d3521b1bcb813f5e7535f4e46ffb564c113a"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased transition-colors duration-300">
        <NextIntlClientProvider messages={messages}>
          <RetroProvider>
            <ThemeProvider>
              <AppHeader />
              <SwipeNav />
              <PwaInstallBanner />
              <SyncWorker />
              <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
              <AppFooter />
            </ThemeProvider>
          </RetroProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
