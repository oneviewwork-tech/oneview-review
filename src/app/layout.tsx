import type { Metadata } from "next";
import { Geist, Geist_Mono, Fredoka } from "next/font/google";
import { ThemeScript } from "@/components/shared/theme-script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The wordmark face shared with ONEVIEW People, so the two products read as
// one family rather than two apps that happen to share a name.
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "ONEVIEW Review", template: "%s · ONEVIEW Review" },
  description: "Performance feedback collection and distribution for ONEVIEW.",
  // Internal tool holding employee performance data — never index it.
  robots: { index: false, follow: false, nocache: true },
  applicationName: "ONEVIEW Review",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: theme-script.tsx adds the `dark` class to
    // <html> before hydration, so the client's className legitimately
    // differs from the server's. Scoped to this element only.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fredoka.variable} h-full antialiased`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}