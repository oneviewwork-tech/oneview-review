import type { Metadata } from "next";
import { Geist_Mono, Fredoka, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Matches the Meta-blue sibling app (ONEVIEW's Zoho Ops intelligence tool),
// so the family reads as one design system rather than each app picking
// its own face.
const plusJakartaSans = Plus_Jakarta_Sans({
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
    // Light theme only: there is no dark-mode switch.
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${geistMono.variable} ${fredoka.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}