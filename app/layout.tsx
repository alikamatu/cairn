import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.APP_URL ??
  "https://assistant.alikamatu.com";

const SITE_NAME = "Cairn";
const TAGLINE = "A calm place to plan, reflect, and progress.";
const DESCRIPTION =
  "Cairn is a calm productivity app for daily tasks, habit streaks, long-horizon goals, and journal reviews — with an AI assistant that knows your context.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — ${TAGLINE}`, template: `%s · ${SITE_NAME}` },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Cairn" }],
  generator: "Next.js",
  keywords: [
    "productivity app", "habit tracker", "goal tracker", "daily journal",
    "task manager", "AI assistant", "personal planner", "Pomodoro",
    "habits", "goals", "reviews", "Cairn",
  ],
  category: "productivity",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
  },
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black-translucent" },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${TAGLINE}`,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${TAGLINE}`,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true, follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)",  color: "#16181f" },
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
  ],
};

const themeBootstrap = `
(function(){try{var t=localStorage.getItem("cairn:theme")||localStorage.getItem("osama:theme");if(!t){t="obsidian";}document.documentElement.dataset.theme=t;if(localStorage.getItem("osama:theme")&&!localStorage.getItem("cairn:theme")){localStorage.setItem("cairn:theme",t);localStorage.removeItem("osama:theme");}}catch(e){document.documentElement.dataset.theme="obsidian";}})();
`;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  description: DESCRIPTION,
  url: SITE_URL,
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web, iOS, Android",
  offers: [
    { "@type": "Offer", price: "0",   priceCurrency: "GHS", name: "Free" },
    { "@type": "Offer", price: "70",  priceCurrency: "GHS", name: "Pro (monthly)" },
    { "@type": "Offer", price: "640", priceCurrency: "GHS", name: "Pro (yearly)" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="obsidian"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg text-fg">
        <Script
          id="theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeBootstrap }}
        />
        <Script
          id="json-ld"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
