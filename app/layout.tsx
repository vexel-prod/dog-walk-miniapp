import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "LuckyWalker",
  description: "Telegram Mini App для шуточного оформления прогулки с собакой",
  icons: {
    icon: "/dog-walker.png",
    apple: "/dog-walker.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-theme="night">
      <body className="min-h-screen bg-neutral text-neutral-content">
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
