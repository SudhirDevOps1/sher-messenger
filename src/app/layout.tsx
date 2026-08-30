import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";



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
  const meraSrc = process.env.NEXT_PUBLIC_MERA_ANALYTICS_SRC || "";
  const meraId = process.env.NEXT_PUBLIC_MERA_ANALYTICS_ID || "";
  const prismId = process.env.NEXT_PUBLIC_PRISM_ANALYTICS_ID || "";
  const prismUrl = process.env.NEXT_PUBLIC_PRISM_ANALYTICS_URL || "";
  const formAction = process.env.NEXT_PUBLIC_CONTACT_FORM_ACTION || "";

  // Dynamic Content Security Policy based strictly on configured environment variables
  const scriptHosts = [meraSrc ? new URL(meraSrc, "https://localhost").origin : "", prismUrl ? new URL(prismUrl, "https://localhost").origin : ""].filter(Boolean).join(" ");
  const connectHosts = [meraSrc ? new URL(meraSrc, "https://localhost").origin : "", prismUrl ? new URL(prismUrl, "https://localhost").origin : "", formAction ? new URL(formAction, "https://localhost").origin : ""].filter(Boolean).join(" ");
  const formHosts = formAction ? new URL(formAction, "https://localhost").origin : "";

  const dynamicCSP = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${scriptHosts}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' wss: https: http: ${connectHosts}`.trim(),
    "media-src 'self' blob: data:",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${formHosts}`.trim(),
  ].join("; ");

  return (
    <html lang="en" data-sher="messenger">
      <head>
        <meta httpEquiv="Content-Security-Policy" content={dynamicCSP} />

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

        {/* Optional MeraAnalytics (Only loads if configured in ENV) */}
        {meraSrc && meraId ? <script defer src={meraSrc} data-website-id={meraId} /> : null}

        {/* Optional PrismAnalytics Tracking (Only loads if configured in ENV) */}
        {prismId && prismUrl ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){
var id='${prismId}', url='${prismUrl}';var sid=sessionStorage.getItem('pa_sid')||crypto.randomUUID();sessionStorage.setItem('pa_sid',sid);function t(e,d){var q=new URLSearchParams(location.search);navigator.sendBeacon(url,JSON.stringify({site_id:id,pathname:location.pathname,referrer:document.referrer,screen_size:screen.width+'x'+screen.height,session_id:sid,event_name:e||'pageview',event_data:d,utm_source:q.get('utm_source'),utm_medium:q.get('utm_medium'),utm_campaign:q.get('utm_campaign')}));}window.prism=t;t();var p=location.pathname;setInterval(function(){if(p!=location.pathname){p=location.pathname;t();}},500);
})();`,
            }}
          />
        ) : null}
      </head>
      <body className="antialiased">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
