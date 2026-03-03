import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Agentation } from "agentation";
import "./globals.css";
import { ThemeProvider } from "./ThemeProvider";
// import { WormkeyOverlay } from "wormkey";
import Script from "next/script";

export const metadata: Metadata = {
  metadataBase: new URL("https://wormkey.run"),
  title: "Wormkey — Open a wormhole to your localhost",
  description:
    "Generate a public URL for your local app in seconds.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "Wormkey — Open a wormhole to your localhost",
    description:
      "Generate a public URL for your local app in seconds.",
    siteName: "Wormkey",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wormkey — Open a wormhole to your localhost",
    description:
      "Generate a public URL for your local app in seconds.",
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
          {/* <WormkeyOverlay slug="swift-dawn-84" />
          <Script defer src="https://t.wormkey.run/.wormkey/overlay.js?slug=swift-dawn-84"></Script> */}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
