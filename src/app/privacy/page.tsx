import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Privacy Policy — SHER Messenger", robots: { index: false, follow: false } };

const DOCS: [string, string][] = [
  ["/plan", "PRD & protocol spec"],
  ["/guide", "User guide & deploy"],
  ["/terms", "Terms of use"],
];

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[var(--line)]">
            {head.map((h) => (
              <th key={h} className="kicker px-3 py-2 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[var(--line)] last:border-0">
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-2 align-top text-[12px] leading-relaxed ${j === 0 ? "font-semibold" : "text-[var(--ink-dim)]"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Sec({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-[19px] font-bold tracking-tight">{title}</h2>
      <div className="mt-3 grid gap-3">{children}</div>
    </section>
  );
}

export default function Privacy() {
  return (
    <div className="shell scroll">
      <div className="mx-auto grid min-h-[100dvh] max-w-[900px] content-start gap-6 px-5 py-10">
        <header className="row flex-wrap items-center justify-between gap-3">
          <div>
            <div className="kicker">legal · last updated 2026-08-29</div>
            <h1 className="mt-1 text-[clamp(22px,4vw,34px)] font-bold tracking-[-0.03em]">Privacy Policy</h1>
          </div>
          <div className="row gap-1.5">
            {DOCS.map(([href, label]) => (
              <Link key={href} className="btn btn-sm" href={href}>
                {label}
              </Link>
            ))}
            <Link className="btn btn-primary btn-sm" href="/">
              App
            </Link>
          </div>
        </header>

        <div className="panel !border-[rgba(79,240,182,.35)] p-4">
          <p className="text-[13px] leading-relaxed text-[var(--ink-dim)]">
            <b className="text-[var(--ink)]">One-line summary:</b> we cannot read your messages. Not because of a policy promise, but
            because the plaintext never reaches this server — it is encrypted in your browser before it is sent, and the decryption keys
            never leave your device.
          </p>
        </div>

        <Sec id="inventory" title="1 · Data inventory">
          <Table
            head={["Category", "Items", "Stored?", "Retention"]}
            rows={[
              ["NEVER COLLECTED", "message plaintext, private keys, passphrase, contact list as a social graph, IP-to-identity mapping by us, analytics events, ad/tracker pixels", "NO — never touches the server", "—"],
              ["CIPHERTEXT ONLY", "message bodies, attachment blobs, encrypted vault mirror, encrypted profile", "YES (AES-256-GCM)", "until user deletes, or TTL burn, or admin purge"],
              ["PUBLIC KEY MATERIAL", "identity key, signed prekey, one-time prekeys", "YES (public by definition)", "until rotated or account deleted"],
              ["METADATA", "opaque user id, handle, room id, sender id, byte size, createdAt, destroyedAt, role", "YES", "until account deleted"],
              ["AUTH", "SHA-256(bearer token), PBKDF2 verifier, device label, truncated IP hash", "YES", "30 days or until revoked"],
              ["AUDIT", "event class + opaque id (auth.ok, msg.shredded, invite.created …)", "YES", "rolling 30 days"],
              ["PLATFORM LOGS", "IP addresses, request timing, user-agent", "YES — by the hosting provider, not us", "provider-controlled (see §5)"],
            ]}
          />
        </Sec>

        <Sec id="lawful" title="2 · Why we process anything at all">
          <p className="text-[13px] leading-relaxed text-[var(--ink-dim)]">
            This is a personal, invite-only messenger. The only basis for processing is <b>legitimate operation of a service you were
            invited to</b>: we cannot route a ciphertext blob without a room id, and we cannot stop abuse without rate limits and a
            handle. There is no marketing use, no profiling, no data sale, no third-party sharing.
          </p>
        </Sec>

        <Sec id="rights" title="3 · Your rights (export & deletion)">
          <p className="text-[13px] leading-relaxed text-[var(--ink-dim)]">
            Both are built in, not a request form:
          </p>
          <Table
            head={["Right", "How", "What you get"]}
            rows={[
              ["Export", "Inspector → Hardening → Encrypted export, or <code>POST /api/ked/me/export</code>", "your encrypted vault blob + every ciphertext row addressed to you. Without your passphrase it is noise — and that is deliberate."],
              ["Delete", "Hardening → Panic wipe (self), or admin purge, or <code>POST /api/ked/me/delete</code>", "crypto-shredding: bodies set to NULL, sessions revoked, public keys dropped. Because no plaintext ever existed, there is nothing left to recover."],
              ["Objection / restriction", "not applicable — no profiling, no ads, no automated decisions"],
              ["Rectification", "profile (name/bio) is vault-encrypted and editable by you at any time"],
            ]}
          />
        </Sec>

        <Sec id="ads" title="4 · No ads, no trackers, no third parties">
          <p className="text-[13px] leading-relaxed text-[var(--ink-dim)]">
            Zero third-party analytics. Zero ad networks. Zero social pixels. Zero remote scripts and zero remote fonts. The
            production client makes <b>no outbound request other than to your own configured relay</b>. System fonts keep rendering
            independent of any CDN.
          </p>
        </Sec>

        <Sec id="platform" title="5 · What the hosting provider logs (honest)">
          <p className="text-[13px] leading-relaxed text-[var(--ink-dim)]">
            We cannot disable provider-level ingress logs. Depending on where this is deployed:
          </p>
          <Table
            head={["Host", "They log", "Their policy"]}
            rows={[
              ["Cloudflare", "IP, timestamp, URL, TLS fingerprint, ASN", "developers.cloudflare.com/foundation/privacy-and-terms/"],
              ["Vercel", "IP, timestamp, request path, region", "vercel.com/legal/privacy-policy"],
              ["Netlify", "IP, timestamp, request path", "netlify.com/privacy"],
              ["Own VPS", "whatever your reverse proxy is configured to log (Caddy/Nginx access logs)", "you control it — turn it off"],
            ]}
          />
          <p className="mono text-[11px] leading-relaxed text-[var(--ink-faint)]">
            These logs contain <b>no message content</b> — they cannot, because content is encrypted before it leaves your tab. But they
            do show that a request happened. If your threat model includes network-level correlation, front the relay with Tor or host it
            on infrastructure you control.
          </p>
        </Sec>

        <Sec id="children" title="6 · Eligibility">
          <p className="text-[13px] leading-relaxed text-[var(--ink-dim)]">
            Invite-only, personal use. Not directed at children, and not for unlawful content. See Terms.
          </p>
        </Sec>

        <Sec id="changes" title="7 · Changes to this policy">
          <p className="text-[13px] leading-relaxed text-[var(--ink-dim)]">
            Material changes are announced with an in-app <b>SYSTEM NOTICE</b> banner (which is the one thing on this relay that is
            deliberately not end-to-end encrypted, so it can reach you before you decrypt anything). The &quot;last updated&quot; date at
            the top always reflects the current version.
          </p>
        </Sec>

        <Sec id="contact" title="8 · Contact">
          <p className="mono text-[12px] leading-relaxed text-[var(--ink-dim)]">
            Operator: set <code>OPERATOR_EMAIL</code> in your deployment env and this section will name you. For security reports read
            the <b>SECURITY.md</b> file in the repository — please do not post vulnerabilities publicly.
          </p>
        </Sec>

        <footer className="row flex-wrap justify-between gap-3 border-t border-[var(--line)] pt-5">
          <span className="mono text-[10.5px] text-[var(--ink-faint)]">AGPL-3.0 · self-hosted · no telemetry</span>
          <Link className="btn btn-primary btn-sm" href="/">
            Open the vault
          </Link>
        </footer>
      </div>
    </div>
  );
}
