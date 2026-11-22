import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/ko.json";
import "../globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ottline 관리자",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F8F6F2",
  colorScheme: "light",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <NextIntlClientProvider locale="ko" messages={messages}>
          <header className="border-b border-border bg-card">
            <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
              <a
                href="/admin/analytics"
                className="font-semibold text-brand-navy"
              >
                ottline 관리
              </a>
              <nav
                aria-label="관리자 메뉴"
                className="flex flex-wrap items-center gap-4 text-sm"
              >
                <a
                  className="text-muted-foreground hover:text-foreground"
                  href="/admin/analytics"
                >
                  통계
                </a>
                <a
                  className="text-muted-foreground hover:text-foreground"
                  href="/admin/report"
                >
                  데일리 리포트
                </a>
                <a
                  className="text-muted-foreground hover:text-foreground"
                  href="/admin/feedback"
                >
                  문의함
                </a>
                <a
                  className="text-muted-foreground hover:text-foreground"
                  href="/admin/logout"
                >
                  로그아웃
                </a>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
