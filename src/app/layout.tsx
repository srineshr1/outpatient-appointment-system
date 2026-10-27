import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers/Providers";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { now } from "@/lib/clock";
import { practice } from "@/lib/data";
import { getCurrentUser } from "@/lib/session";
import "./globals.css";

// Self-hosted at build time by next/font: no request reaches Google from the browser.
// Apple devices render SF Pro from the system stack; Inter is the fallback elsewhere.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

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
  const user = await getCurrentUser();

  return (
    <html lang="en-GB" className={inter.variable}>
      <body className="flex min-h-dvh flex-col bg-canvas text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-callout focus:font-medium focus:text-white"
        >
          Skip to main content
        </a>
        <Providers initialNow={initialNow}>
          <SiteHeader user={user} />
          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
