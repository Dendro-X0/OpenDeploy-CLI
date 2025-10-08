import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { PrismThemeLoader } from "@/components/docs/prism-theme-loader";
import MobileSafeMode from "@/components/dev/mobile-safe-mode";
import OverflowDebugger from "@/components/dev/overflow-debugger";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpenDeploy CLI • Docs",
  description:
    "Fast, web‑focused deploys. Generate provider configs (vercel.json, netlify.toml, turbo.json), sync/diff env, and ship to Vercel/Netlify with readable logs and CI‑friendly JSON/NDJSON.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <html lang="en" suppressHydrationWarning>
        <head />
        <body>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <MobileSafeMode />
            <OverflowDebugger />
            <PrismThemeLoader />
            {children}
          </ThemeProvider>
        </body>
      </html>
    </>
  );
}
