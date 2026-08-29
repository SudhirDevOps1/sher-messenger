import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' wss: https:",
  "media-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "require-trusted-types-for 'script'",
].join("; ");

export const metadata: Metadata = {
  title: "SHER Messenger — zero-knowledge end-to-end encrypted messenger",
  description:
    "A personal, self-hostable encrypted messenger: X3DH-lite + Double Ratchet in your browser, AES-256-GCM everywhere, sealed attachments, auto-burn TTLs, panic wipe. Runs on Vercel, Netlify or Cloudflare with Neon, Turso, Postgres or a volatile relay.",
  applicationName: "SHER Messenger",
  manifest: "/manifest.webmanifest",
  authors: [{ name: "SHER Messenger Contributors" }],
  metadataBase: new URL("http://localhost:3000"),
  openGraph: {
    title: "SHER Messenger — zero-knowledge encrypted messenger",
    description: "Real WebCrypto E2EE messaging with a dumb relay. Self-hostable, multi-DB, no analytics.",
    type: "website",
  },
  robots: { index: false, follow: false, nosnippet: true, noarchive: true },
  other: { "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY" },
};

export const viewport: Viewport = {
  themeColor: "#05070c",
  colorScheme: "dark",
  width: "device-width",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-sher="messenger">
      <head>
        <meta http-equiv="Content-Security-Policy" content={CSP} />

        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2305070c'/%3E%3Cpath d='M16 5l9 4v7.5c0 5.3-3.7 9.7-9 10.5-5.3-.8-9-5.2-9-10.5V9z' fill='none' stroke='%234ff0b6' stroke-width='2'/%3E%3Cpath d='M12 16l3 3 6-6' fill='none' stroke='%234ff0b6' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E"
        />
        <meta name="referrer" content="no-referrer" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="SHER Messenger" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
