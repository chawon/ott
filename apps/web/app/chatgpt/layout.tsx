import { headers } from "next/headers";
import { resolveChatGptLocale } from "@/lib/chatgpt/copy";
import "../globals.css";

export default async function ChatGptLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const locale = resolveChatGptLocale(requestHeaders.get("accept-language"));

  return (
    <html lang={locale}>
      <body className="bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
