import type { Viewport } from "next";
import Script from "next/script";
import "../globals.css";
import { NextIntlClientProvider } from "next-intl";
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import AndroidAppContextRecorder from "@/components/AndroidAppContextRecorder";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import ChunkErrorHandler from "@/components/ChunkErrorHandler";
import PwaInstallBanner from "@/components/PwaInstallBanner";
import SwipeNav from "@/components/SwipeNav";
import SyncWorker from "@/components/SyncWorker";
import { ThemeProvider } from "@/context/ThemeContext";
import { localizedAlternates, localizedUrl } from "@/lib/seo";

export function generateStaticParams() {
  return [{ locale: "ko" }, { locale: "en" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: {
      default: t("titleDefault"),
      template: t("titleTemplate"),
    },
    description: t("description"),
    alternates: localizedAlternates(locale),
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
      url: localizedUrl(locale),
      siteName: "ottline",
      locale: locale === "ko" ? "ko_KR" : "en_US",
      type: "website",
      images: [
        {
          url: "https://ottline.app/og-image-20260418.png",
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "ottline",
      description: t("description"),
      images: ["https://ottline.app/og-image-20260418.png"],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F6F2" },
    { media: "(prefers-color-scheme: dark)", color: "#15120F" },
  ],
  colorScheme: "light dark",
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();
  const metadataT = await getTranslations({ locale, namespace: "Metadata" });

  const themeInitScript = `
(() => {
  try {
    const themeBackground = { light: "#F8F6F2", dark: "#15120F" };
    const root = document.documentElement;
    const mode = localStorage.getItem("theme-mode") || "system";
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = mode === "dark" || (mode === "system" && prefersDark);
    const resolvedTheme = isDark ? "dark" : "light";
    const background = themeBackground[resolvedTheme];
    root.classList.toggle("dark", isDark);
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
    root.style.backgroundColor = background;
    const applyBodyBackground = () => {
      if (document.body) {
        document.body.style.backgroundColor = background;
      }
    };
    applyBodyBackground();
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", applyBodyBackground, { once: true });
    }
    let themeColors = document.querySelectorAll('meta[name="theme-color"]');
    if (themeColors.length === 0) {
      const themeColor = document.createElement("meta");
      themeColor.setAttribute("name", "theme-color");
      document.head.appendChild(themeColor);
      themeColors = document.querySelectorAll('meta[name="theme-color"]');
    }
    themeColors.forEach((themeColor) => themeColor.setAttribute("content", background));
  } catch (_) {}
})();
`;
  const serviceWorkerInitScript = `
(() => {
  if (!("serviceWorker" in navigator)) return;
  if (!window.isSecureContext) return;
  const registerServiceWorker = () => {
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
      // Ignore registration errors to avoid blocking runtime flows.
    });
  };
  if (document.readyState === "complete") {
    registerServiceWorker();
    return;
  }
  window.addEventListener("load", registerServiceWorker, { once: true });
})();
`;
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Static theme code must run before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <meta
          name="naver-site-verification"
          content="d48c8e320c660f8e8f1291f6cad71bc39e268d10"
        />
        <script
          id="organization-json-ld"
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is serialized from local translations and constants.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "ottline",
              url: "https://ottline.app",
              logo: {
                "@type": "ImageObject",
                url: "https://ottline.app/icon.png",
                width: 512,
                height: 512,
              },
              description: metadataT("description"),
              inLanguage: locale === "ko" ? "ko-KR" : "en-US",
              sameAs: ["https://www.wikidata.org/wiki/Q138822579"],
            }),
          }}
        />
        {/* Google tag (gtag.js) */}
        <Script
          id="gtag-src"
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-61XBJHSN8G"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-61XBJHSN8G');`}
        </Script>
        {/* Microsoft Clarity */}
        <Script id="clarity-init" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","vwj7yzqkow");`}
        </Script>
        {process.env.NODE_ENV === "production" &&
        process.env.APP_ENV !== "staging" ? (
          <Script id="service-worker-init" strategy="afterInteractive">
            {serviceWorkerInitScript}
          </Script>
        ) : null}
      </head>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            {process.env.APP_ENV === "staging" && (
              <div className="fixed top-0 left-0 right-0 z-50 bg-amber-400 text-amber-900 text-center text-xs font-bold py-1 tracking-widest">
                STAGING
              </div>
            )}
            <ChunkErrorHandler />
            <AndroidAppContextRecorder />
            <AppHeader />
            <SwipeNav />
            <PwaInstallBanner />
            <SyncWorker />
            <main className="mx-auto max-w-5xl px-4 py-8 pb-[var(--mobile-bottom-content-padding)] sm:py-10 sm:pb-10">
              {children}
            </main>
            <AppFooter />
            <BottomNav />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
