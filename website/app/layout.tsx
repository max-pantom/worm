import type { Metadata } from "next";
import { Agentation } from "agentation";
import "./globals.css";
import { ThemeProvider } from "./ThemeProvider";
import { WormkeyOverlay } from "wormkey";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Wormkey — Open a wormhole to your localhost",
  description:
    "Share your dev server instantly. A developer tool that exposes a local server to a secure public URL.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.cdnfonts.com/css/open-runde"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
          {process.env.NODE_ENV === "development" && <Agentation />}
          <WormkeyOverlay slug="swift-dawn-84" />
          <Script defer src="https://t.wormkey.run/.wormkey/overlay.js?slug=swift-dawn-84"></Script>
        </ThemeProvider>
      </body>
    </html>
  );
}
