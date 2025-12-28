import "./globals.css";
import AppHeader from "@/components/AppHeader";
import SyncWorker from "@/components/SyncWorker";

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ko">
        <body className="min-h-screen bg-neutral-50 text-neutral-900">
        <AppHeader />
        <SyncWorker />
        <main className="mx-auto max-w-5xl px-4 py-6">
            {children}
        </main>
        </body>
        </html>
    );
}
