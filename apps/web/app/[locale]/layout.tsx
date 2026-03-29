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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "ottline",
              url: "https://ottline.app",
              logo: {
                "@type": "ImageObject",
                url: "https://ottline.app/og-image.png",
                width: 1200,
                height: 630,
              },
              description:
                "가입 없이 영상·책 기록을 10초 만에 남기고 타임라인으로 모아보세요. 영상과 책을 가장 빠르게 기록하는 방법.",
              inLanguage: "ko-KR",
              sameAs: ["https://www.wikidata.org/wiki/Q138822579"],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "ottline",
              url: "https://ottline.app",
              description:
                "가입 없이 영상·책 기록을 10초 만에 남기고 타임라인으로 모아보세요.",
              inLanguage: "ko-KR",
              applicationCategory: "LifestyleApplication",
              applicationSubCategory: "Entertainment",
              operatingSystem: "Web, Android (PWA), iOS (PWA)",
              offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
              isAccessibleForFree: true,
              featureList: [
                "로그인 없는 영상·책 기록",
                "로컬 퍼스트 데이터 저장 (IndexedDB)",
                "타임라인 뷰",
                "페어링 코드로 기기 간 동기화",
                "CSV 내보내기",
                "PWA 설치 지원",
              ],
            }),
          }}
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
            {process.env.NEXT_PUBLIC_APP_ENV === "staging" && (
              <div className="fixed top-0 left-0 right-0 z-50 bg-amber-400 text-amber-900 text-center text-xs font-bold py-1 tracking-widest">
                STAGING
              </div>
            )}
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
