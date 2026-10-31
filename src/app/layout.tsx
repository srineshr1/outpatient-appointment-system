import type { Metadata, Viewport } from "next";
import { Google_Sans, Inter } from "next/font/google";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { NavProgress } from "@/components/shell/NavProgress";
import { Providers } from "@/components/providers/Providers";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { SiteChrome } from "@/components/shell/SiteChrome";
import { HeaderSkeleton } from "@/components/loading/HeaderSkeleton";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { now } from "@/lib/clock";
import { practice } from "@/lib/data";
import { getCurrentUser } from "@/lib/session";
import "./globals.css";

// Self-hosted at build time by next/font: no request reaches Google from the browser.
// Inter is the face on every platform.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Bold statement headings, such as the sign-in page.
const googleSans = Google_Sans({ subsets: ["latin"], weight: ["700"], variable: "--font-google-sans", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: `Book a GP appointment · ${practice.name}`,
    template: `%s · ${practice.name}`,
  },
  description: `Book a GP appointment at ${practice.name}, ${practice.address}. Choose a doctor, pick a time and get a calendar invite.`,
  applicationName: practice.name,
  openGraph: {
    type: "website",
    siteName: practice.name,
    locale: "en_GB",
    title: `Book a GP appointment · ${practice.name}`,
    description: "Choose a doctor, pick a time and get a calendar invite.",
  },
  formatDetection: { telephone: false },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#f5f5f7",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Availability depends on the current time, so render per request.
  await connection();
  const initialNow = now().getTime();

  return (
    <html lang="en-GB" className={`${inter.variable} ${googleSans.variable}`}>
      <body className="flex min-h-dvh flex-col bg-canvas text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-callout focus:font-medium focus:text-white"
        >
          Skip to main content
        </a>
        <NavProgress />
        <Providers initialNow={initialNow}>
          <SiteChrome>
            {/* The header needs the signed-in person. The page below doesn't wait for it to start showing. */}
            <Suspense fallback={<HeaderSkeleton />}>
              <HeaderWithUser />
            </Suspense>
          </SiteChrome>
          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
          <SiteChrome>
            <SiteFooter />
          </SiteChrome>
        </Providers>
      </body>
    </html>
  );
}

async function HeaderWithUser() {
  return <SiteHeader user={await getCurrentUser()} />;
}
