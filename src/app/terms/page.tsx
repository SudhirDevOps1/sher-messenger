import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Terms of Use — SHER Messenger", robots: { index: false, follow: false } };

function Sec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
      <div className="mt-2 grid gap-2">{children}</div>
    </section>
  );
}

const LI = ({ children }: { children: ReactNode }) => (
  <li className="mono row items-start gap-2 text-[12px] leading-relaxed text-[var(--ink-dim)]">
    <span className="mt-[7px] h-1 w-1 flex-none rounded-full bg-[var(--acc)]" />
    <span>{children}</span>
  </li>
);

export default function Terms() {
  return (
    <div className="shell scroll">
      <div className="mx-auto grid min-h-[100dvh] max-w-[860px] content-start gap-6 px-5 py-10">
        <header className="row flex-wrap items-center justify-between gap-3">
          <div>
            <div className="kicker">legal · last updated 2026-08-29</div>
            <h1 className="mt-1 text-[clamp(22px,4vw,34px)] font-bold tracking-[-0.03em]">Terms of Use</h1>
          </div>
          <div className="row gap-1.5">
            <Link className="btn btn-sm" href="/privacy">
              Privacy
            </Link>
            <Link className="btn btn-primary btn-sm" href="/">
              App
            </Link>
          </div>
        </header>

        <div className="panel !border-[rgba(255,190,85,.35)] p-4">
          <p className="mono text-[12px] leading-relaxed text-[var(--ink-dim)]">
            <b className="text-[var(--ink)]">Short version:</b> personal use, invite-only, no illegal content, provided as-is with no
            warranty. You are responsible for your passphrase — nobody can recover it, including the operator.
          </p>
        </div>

        <Sec title="1 · Scope">
          <ul className="grid gap-1.5">
            <LI>Personal, private messaging for the operator and invited people only.</LI>
            <LI>Not a public communication service. Accounts are created through admin-issued invite links.</LI>
            <LI>Commercial, governmental, or mass-distribution use requires a separate written agreement with the operator.</LI>
          </ul>
        </Sec>

        <Sec title="2 · Your account">
          <ul className="grid gap-1.5">
            <LI>Identity = a handle plus a cryptographic keypair generated on your device. No phone number, no email.</LI>
            <LI>Your passphrase derives the vault key. If you lose it, your history is unrecoverable — this is stated at signup and is a feature, not a defect.</LI>
            <LI>You are responsible for activity performed with your handle and devices. Use the device-revocation panel if a device is lost.</LI>
          </ul>
        </Sec>

        <Sec title="3 · Acceptable use — you must NOT">
          <ul className="grid gap-1.5">
            <LI>send, store, or share unlawful content, including CSAM, credible threats, or material that infringes another person&apos;s rights;</LI>
            <LI>use the relay to coordinate attacks, distribute malware, or harass people;</LI>
            <LI>attempt to break the cryptography, enumerate invites, spam registration, or probe other users (rate limits and lockouts exist for this reason);</LI>
            <LI>impersonate another person or misrepresent your identity in a way that causes harm;</LI>
            <LI>resell hosting of this relay to third parties without agreement.</LI>
          </ul>
          <p className="mono mt-1 text-[11px] leading-relaxed text-[var(--ink-faint)]">
            Note on capability: the operator cannot read your messages. Enforcement of this section therefore relies on the invite chain,
            rate limits, abuse reports, and — where legally compelled — the operator&apos;s ability to suspend or purge an identity and
            its rooms.
          </p>
        </Sec>

        <Sec title="4 · Encryption is not a shield">
          <ul className="gap-1.5">
            <LI>E2EE protects message <b>content</b> in transit and at rest on this relay. It does not make you anonymous.</LI>
            <LI>Metadata (who has an account, when a message was sent, how large it was) is necessarily visible to the relay.</LI>
            <LI>Nothing here protects a compromised device, a screenshot, or a person who chooses to copy and forward a message.</LI>
          </ul>
        </Sec>

        <Sec title="5 · Availability & no warranty">
          <ul className="gap-1.5">
            <LI>The service is provided &quot;as is&quot; and &quot;as available&quot;, without warranty of any kind, express or implied.</LI>
            <LI>It may be unavailable at any time — free-tier limits, deploys, maintenance, or an operator decision.</LI>
            <LI>Messages queued while offline are stored locally in your browser and flushed when the relay responds; if your browser clears that storage before a flush, they are gone.</LI>
            <LI>Always keep your own encrypted export. The operator runs no backup of your plaintext, because none exists.</LI>
          </ul>
        </Sec>

        <Sec title="6 · Suspension & termination">
          <ul className="gap-1.5">
            <LI>The operator may suspend or purge an identity for breach of this Terms, or to comply with law, or to protect the relay.</LI>
            <LI>Purge is crypto-shredding: message bodies are nulled on the relay, sessions revoked, public keys dropped. It is irreversible.</LI>
            <LI>You may leave at any time via Panic wipe or full account deletion — no explanation required.</LI>
          </ul>
        </Sec>

        <Sec title="7 · Liability">
          <p className="text-[13px] leading-relaxed text-[var(--ink-dim)]">
            To the maximum extent permitted by law, the operator is not liable for lost messages, lost keys, lost data, missed
            communications, or any indirect or consequential damages arising from use of this software.
          </p>
        </Sec>

        <Sec title="8 · Changes">
          <p className="text-[13px] leading-relaxed text-[var(--ink-dim)]">
            Material changes are announced via the in-app SYSTEM NOTICE banner. Continued use after that notice means acceptance.
          </p>
        </Sec>

        <footer className="row flex-wrap justify-between gap-3 border-t border-[var(--line)] pt-5">
          <span className="mono text-[10.5px] text-[var(--ink-faint)]">AGPL-3.0 · invite-only · personal use</span>
          <Link className="btn btn-primary btn-sm" href="/">
            Open the vault
          </Link>
        </footer>
      </div>
    </div>
  );
}
