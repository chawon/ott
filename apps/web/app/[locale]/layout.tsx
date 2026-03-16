import type { Metadata, Viewport } from "next";
import "../globals.css";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import PwaInstallBanner from "@/components/PwaInstallBanner";
import SyncWorker from "@/components/SyncWorker";
import SwipeNav from "@/components/SwipeNav";
import MigrationBanner from "@/components/MigrationBanner";
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
      title: "ottline",
      statusBarStyle: "black-translucent",
    },
    openGraph: {
      title: "ottline",
      description: t("description"),
      url: "https://ottline.app",
      siteName: "ottline",
      locale: locale === "ko" ? "ko_KR" : "en_US",
      type: "website",
      images: [{ url: "https://ottline.app/og-image.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "ottline",
      description: t("description"),
      images: ["https://ottline.app/og-image.png"],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#1E4D8C",
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
    const mode = localStorage.getItem("theme-mode") || "system";
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = mode === "dark" || (mode === "system" && prefersDark);
    root.classList.toggle("dark", isDark);
  } catch (_) {}
})();
`;
  const serviceWorkerInitScript = `
(() => {
  if (!("serviceWorker" in navigator)) return;
  if (!window.isSecureContext) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Ignore registration errors to avoid blocking runtime flows.
    });
  }, { once: true });
})();
`;
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta
          name="naver-site-verification"
          content="d48c8e320c660f8e8f1291f6cad71bc39e268d10"
        />
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-61XBJHSN8G" />
        <script dangerouslySetInnerHTML={{ __html: `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-61XBJHSN8G');` }} />
        {/* Microsoft Clarity */}
        <script dangerouslySetInnerHTML={{ __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","vwj7yzqkow");` }} />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {process.env.NODE_ENV === "production" ? (
          <script dangerouslySetInnerHTML={{ __html: serviceWorkerInitScript }} />
        ) : null}
      </head>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased transition-colors duration-300">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <MigrationBanner />
            <AppHeader />
            <SwipeNav />
            <PwaInstallBanner />
            <SyncWorker />
            <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
            <AppFooter />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
