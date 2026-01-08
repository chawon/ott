import "./globals.css";
import AppHeader from "@/components/AppHeader";
import SyncWorker from "@/components/SyncWorker";
import { RetroProvider } from "@/context/RetroContext";

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ko">
        <body className="min-h-screen bg-background text-foreground font-sans antialiased transition-colors duration-300">
        <RetroProvider>
            <AppHeader />
            <SyncWorker />
            <main className="mx-auto max-w-5xl px-4 py-8">
                {children}
            </main>
        </RetroProvider>
        </body>
        </html>
    );
}
