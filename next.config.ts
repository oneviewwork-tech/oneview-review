import type { NextConfig } from "next";

// Security headers applied to every response. CSP is deliberately NOT set
// here — Next streams its App Router payload as inline <script> tags, so a
// static `script-src 'self'` would block hydration outright. It's built
// per-request with a nonce in proxy.ts instead.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  {
    // Only meaningful over HTTPS, which Vercel terminates for us.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Employee/feedback data must never be cached by a shared proxy or CDN.
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
