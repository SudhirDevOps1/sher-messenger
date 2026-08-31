"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Chip, Icon, KV } from "@/components/ui";
import { safeJson } from "@/lib/safeFetch";

const NAV = [
  ["thesis", "1 · Thesis"],
  ["prd", "2 · PRD"],
  ["features", "3 · Feature spec"],
  ["protocol", "4 · Crypto & protocol"],
  ["wire", "5 · Wire format"],
  ["threat", "6 · Threat model"],
  ["metadata", "7 · Metadata budget"],
  ["deploy", "8 · Deploy matrix"],
  ["db", "9 · Storage matrix"],
  ["api", "10 · API"],
  ["limits", "11 · Limits & budgets"],
  ["roadmap", "12 · Roadmap"],
  ["checklist", "13 · Launch checklist"],
];

function Section({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="kicker">{kicker}</div>
      <h2 className="mt-1 text-[clamp(20px,2.6vw,28px)] font-bold leading-tight tracking-[-0.02em]">{title}</h2>
      <div className="mt-4 grid gap-4">{children}</div>
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: (ReactNode | string)[][] }) {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-left">
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
                <td key={j} className={`px-3 py-2 align-top text-[12px] leading-relaxed ${j === 0 ? "font-semibold text-[var(--ink)]" : "text-[var(--ink-dim)]"}`}>
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

function Code({ title, children }: { title: string; children: string }) {
  return (
    <div className="panel overflow-hidden">
      <div className="row justify-between border-b border-[var(--line)] px-3 py-2">
        <span className="kicker">{title}</span>
        <span className="row gap-1 text-[var(--ink-faint)]">
          <Icon name="terminal" size={12} />
        </span>
      </div>
      <pre className="scroll overflow-auto p-3 text-[11px] leading-[1.7] text-[var(--ink-dim)]">
        <code className="mono">{children}</code>
      </pre>
    </div>
  );
}

const Bullet = ({ children }: { children: ReactNode }) => (
  <li className="mono row items-start gap-2 text-[11.5px] leading-relaxed text-[var(--ink-dim)]">
    <span className="mt-[6px] h-1 w-1 flex-none rounded-full bg-[var(--acc)]" />
    <span>{children}</span>
  </li>
);

export default function Plan() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [probe, setProbe] = useState<string>("—");

  useEffect(() => {
    void safeJson<Record<string, unknown>>("/api/ked/stats").then((s) => setStats(s ?? { error: "relay unreachable" }));
    const t0 = performance.now();
    void safeJson("/api/ked/health").then((h) => setProbe(h ? `${Math.round(performance.now() - t0)} ms` : "n/a"));
  }, []);

  return (
    <div className="shell scroll">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[rgba(5,7,12,.88)] backdrop-blur-xl">
        <div className="mx-auto row max-w-[1240px] items-center justify-between gap-2 px-3 py-2.5 sm:px-5 sm:py-3">
          <a href="/" className="row gap-2 shrink-0">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--line-strong)] bg-[rgba(79,240,182,.12)] text-[var(--acc)]">
              <Icon name="shield" size={16} />
            </span>
            <span className="text-[13px] sm:text-[13.5px] font-bold tracking-tight">
              SHER<span className="text-[var(--acc)]">·</span>VAULT <span className="kicker ml-1 hidden sm:inline">/ live plan + PRD</span>
            </span>
          </a>
          <div className="row gap-1.5 overflow-x-auto no-scrollbar flex-nowrap shrink-0 py-0.5">
            <Chip tone="good">
              <span className="dot" /> {String(stats?.adapter ?? "…")}
            </Chip>
            <Chip><span className="hidden sm:inline">rtt </span>{probe}</Chip>
            <a className="btn btn-sm shrink-0" href="/guide">
              <Icon name="spark" size={12} /> Guide
            </a>
            <a className="btn btn-primary btn-sm shrink-0 font-semibold" href="/">
              <Icon name="chevron" size={12} /> Open app
            </a>
          </div>
        </div>
      </header>

      {/* Mobile Horizontal Section Navigator */}
      <div className="lg:hidden flex gap-1.5 overflow-x-auto no-scrollbar py-2 px-3 sm:px-5 border-b border-[var(--line)] bg-[var(--bg)]/90 sticky top-[53px] z-20 backdrop-blur">
        {NAV.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="chip shrink-0 text-[11px] whitespace-nowrap !bg-white/5 hover:!bg-white/10"
          >
            {label}
          </a>
        ))}
      </div>

      <div className="mx-auto grid max-w-[1240px] gap-6 sm:gap-8 px-3 sm:px-5 py-6 sm:py-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="order-2 hidden lg:order-1 lg:block">
          <div className="sticky top-20 grid gap-0.5">
            {NAV.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="mono rounded-lg px-2.5 py-1.5 text-[11px] text-[var(--ink-faint)] transition hover:bg-white/5 hover:text-[var(--ink)]"
              >
                {label}
              </a>
            ))}
          </div>
        </nav>

        <main className="order-1 min-w-0 max-w-[86ch] lg:order-2">
          {/* ---------------- hero */}
          <div className="panel relative mb-10 overflow-hidden p-6">
            <span className="glowline" />
            <div className="kicker">product requirement document · v1.0 · owner: ked</div>
            <h1 className="mt-2 max-w-[24ch] text-[clamp(26px,4.4vw,44px)] font-bold leading-[1.02] tracking-[-0.03em]">
              A messenger whose server is architecturally incapable of reading it.
            </h1>
            <p className="mt-4 max-w-[70ch] text-[13.5px] leading-relaxed text-[var(--ink-dim)]">
              SHER Messenger is a personal, self-hostable chat app. Encryption is performed in the browser with WebCrypto only — no
              third-party crypto SDK dependency, no server-side key escrow, no backup service, no analytics. The relay stores ciphertext, opaque
              identifiers and timing, and it can be swapped (Neon, Turso, any Postgres, a file-backed SQLite, or pure memory) without
              touching a line of client crypto. Deploy it on Vercel, Netlify, Cloudflare Pages/Workers, or a $5 VPS.
            </p>
            <div className="mt-5 flex flex-wrap gap-1.5">
              <Chip tone="good">E2EE by default, always</Chip>
              <Chip tone="good">no phone / no email</Chip>
              <Chip tone="acc">X3DH-lite + Double Ratchet</Chip>
              <Chip tone="acc">AES-256-GCM · HKDF · PBKDF2 750k</Chip>
              <Chip>auto-burn TTL</Chip>
              <Chip>sealed attachments</Chip>
              <Chip>sender-key groups</Chip>
              <Chip tone="warn">panic wipe</Chip>
            </div>
            {stats ? (
              <div className="mt-6 grid gap-x-8 gap-y-0 border-t border-[var(--line)] pt-4 sm:grid-cols-2">
                <KV k="live adapter" v={String(stats.adapter ?? "—")} />
                <KV k="accounts" v={String(stats.users ?? 0)} />
                <KV k="ciphertext rows" v={String(stats.ciphertextRows ?? 0)} tone="good" />
                <KV k="plaintext rows on server" v={String(stats.plaintextRowsOnServer ?? 0)} tone="good" />
                <KV k="stored ciphertext" v={`${Math.round(Number(stats.storedCiphertextBytes ?? 0) / 1024)} KiB`} />
                <KV k="third-party requests from app" v="fonts only (optional)" tone="good" />
              </div>
            ) : null}
          </div>

          <div className="grid gap-12">
            <Section id="thesis" kicker="section 1" title="Thesis, problem and non-goals">
              <p className="text-[13.5px] leading-relaxed text-[var(--ink-dim)]">
                Independent 2026 reviews of mainstream encrypted messengers converge on a common shape: audited ratchet protocols win on
                forward secrecy, metadata-minimal designs win on anonymity, ephemeral-message products win on auto-shred workflows, and
                federated/self-hosted products win on data ownership — but almost none of them are something a single person can stand up
                on infrastructure they own, in an evening, with zero budget. That gap is what this project is: a <b className="text-[var(--ink)]">personal</b>{" "}
                app with production-grade ratcheting, no identity documents, and a storage layer that works with whatever free-tier
                database happens to be available.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="panel p-4">
                  <div className="kicker mb-2">goals</div>
                  <ul className="grid gap-2">
                    <Bullet>Zero-knowledge relay: server never holds plaintext, private keys, or the passphrase.</Bullet>
                    <Bullet>Per-message forward secrecy + post-compromise security, verifiable in the UI.</Bullet>
                    <Bullet>Runs unchanged on Vercel, Netlify, Cloudflare, Docker, and a bare Postgres.</Bullet>
                    <Bullet>Auto-burn, unsend-for-everyone, sealed attachments, sender-key groups.</Bullet>
                    <Bullet>Auditable: ledger of every key event, both client-side and relay-side.</Bullet>
                  </ul>
                </div>
                <div className="panel p-4">
                  <div className="kicker mb-2">non-goals (v1)</div>
                  <ul className="grid gap-2">
                    <Bullet>No VoIP, no stories, no public channels — attack surface without privacy benefit.</Bullet>
                    <Bullet>No cloud sync of decrypted history; multi-device mirrors ciphertext only.</Bullet>
                    <Bullet>No push infrastructure; foreground polling + Notification API where permitted.</Bullet>
                    <Bullet>No recovery. Losing the passphrase loses the vault. Stated, not hidden.</Bullet>
                  </ul>
                </div>
              </div>
              <Table
                head={["Persona", "Need", "What this build gives"]}
                rows={[
                  ["Journalist / activist", "no identity tied to who I talk to", "handle-only accounts, room ids as hash of public keys, 15-min lockout, panic wipe"],
                  ["Paranoid techie (me)", "prove the server is blind", "Inspector shows ratchet counters + relay ledger; bodies are base64 ciphertext in every backend"],
                  ["Small team / family", "usable day to day", "reactions, edits, replies, search over local plaintext, TTL defaults, groups"],
                  ["Self-hoster", "cheap infra", "one container or a static host + HTTP-only DB (Turso/KV); no Redis, no workers, no queue"],
                ]}
              />
            </Section>

            <Section id="prd" kicker="section 2" title="PRD — behaviour that must hold">
              <Table
                head={["ID", "Requirement", "Acceptance test"]}
                rows={[
                  ["R1", "Registration generates IK, signed SPK and a 24-key OPK pool in the browser; only public material is uploaded", "network tab shows 0 private-key bytes; vault key derived from PBKDF2(passphrase, random salt)"],
                  ["R2", "Relay persists only: opaque ids, ciphertext body, public header, timestamps, sizes", "SELECT body FROM ked_messages → base64 blob; grep for any plaintext token returns nothing"],
                  ["R3", "Every message uses a fresh ratchet message key; the key is destroyed after use", "send 3 messages, reload, inspect counters: send.n advances by 3, no key material in storage"],
                  ["R4", "Direction change forces a new ECDH step (PCS)", "Inspector → dh ratchet steps increments on every reply"],
                  ["R5", "TTL is enforced on the client AND shredded at the relay", "30s message disappears locally; row body becomes NULL, destroyed_at set"],
                  ["R6", "Unsend-for-everyone reaches all members and zeroes the relay row", "recall → peer sees 'burned'; relay body NULL; re-reading impossible even with a DB dump"],
                  ["R7", "Attachments are encrypted pre-upload with a one-time key; key travels inside the sealed message", "blob in DB has no filename/mime; decrypt verifies SHA-256 or refuses"],
                  ["R8", "Safety number is derived from IK+SPK of both sides and can be compared out-of-band", "both tabs show identical 60 digits; substituting a bundle raises KEY_SUBSTITUTION"],
                  ["R9", "Rate limiting + lockout: 10 logins/10 min, 6 failures → 15 min lock; 90 sends/min", "curl loop returns 429 then 423"],
                  ["R10", "Panic wipe destroys local vault, revokes sessions, asks relay to zero own rows", "after WIPE: no rooms, login requires passphrase, vault_blob empty"],
                  ["R11", "Backend swap must not change any client code path", "boot with SHER_DB=memory, then DATABASE_URL=neon…, then TURSO_URL — same UI, same data shape"],
                  ["R12", "Works offline-first for reading: local encrypted store, no re-fetch of history", "DevTools → offline: history still renders; sending queues errors, never leaks plaintext"],
                ]}
              />
              <Code title="definition of done (v1)">
{`• all 12 requirements pass against a Postgres (Neon) and a Turso backend
• Lighthouse: no third-party scripts; CSP + nosniff + no-referrer headers present
• tsc --noEmit clean, next build clean, /api/health green
• a hostile DB dump of a live conversation contains zero readable words`}
              </Code>
            </Section>

            <Section id="features" kicker="section 3" title="Feature specification">
              <Table
                head={["Surface", "Shipped in this build", "Planned"]}
                rows={[
                  ["Identity", "handle + passphrase → PBKDF2 vault key; identity bundle; fingerprint; rotation with safety-number change banner", "SRP-6a PAKE (no server-side verifier), Argon2id WASM, WebAuthn device bound keys"],
                  ["1:1 chat", "X3DH-lite, Double Ratchet, edit, unsend, reactions, replies, read receipts, typing, TTL burn, search, day separators", "Out-of-order skipped-key expansion, message pagination, offline queue"],
                  ["Groups", "creator-distributed sender keys per member, re-key on membership change, per-group TTL", "MLS (RFC 9420) TreeKEM for large groups, member roles, hidden members"],
                  ["Files", "AES-GCM one-time key, 2 MB cap, image preview via blob:, SHA-256 verification on open", "chunked uploads, IPFS/WebTorrent P2P relay for large media, streaming decrypt"],
                  ["Safety UI", "Inspector (identity/session/ledger/devices/hardening), posture score, seal-details per message, blur-on-blur, clipboard wipe", "QR safety-number scan, key-change banner modal, screenshot counter"],
                  ["Data", "encrypted local vault in localStorage; mirrored encrypted blob on relay for device portability; encrypted export", "IndexedDB + OPFS store, delta sync of vault, per-device history split"],
                  ["Ops", "/api/ked/stats visibility, per-route token buckets, relay audit ledger, health probe", "Prometheus endpoint, OpenTelemetry-free log scrubbing, backup rotation"],
                ]}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="panel p-4">
                  <div className="kicker mb-2">UX principles</div>
                  <ul className="grid gap-2">
                    <Bullet>Show the crypto state where it matters — counters, fingerprints and burn timers are first-class UI, not footnotes.</Bullet>
                    <Bullet>Fail loudly: a bad signature reads "integrity violation" in the ledger, never a silent drop.</Bullet>
                    <Bullet>Density over delight: monospace for anything a user might compare digit-by-digit.</Bullet>
                  </ul>
                </div>
                <div className="panel p-4">
                  <div className="kicker mb-2">Explicit rejections</div>
                  <ul className="grid gap-2">
                    <Bullet>No "encrypt in the server" mode — that is a checkbox, not a threat model.</Bullet>
                    <Bullet>No Firebase/Auth0/OneSignal dependency.</Bullet>
                    <Bullet>No social graph, no recommendations, no read-time telemetry.</Bullet>
                  </ul>
                </div>
              </div>
            </Section>

            <Section id="protocol" kicker="section 4" title="Cryptographic design">
              <Table
                head={["Layer", "Choice", "Why (and the trade-off)"]}
                rows={[
                  ["Agreement", "X3DH-lite: DH(IK_a,SPK_b), DH(EK_a,IK_b), DH(EK_a,SPk_b), DH(EK_a,OPK_b) → HKDF → 96 bytes", "Offline-capable session setup with 1-RTT messages. 4 DHs keep mutual authentication and ephemeral forward secrecy; we skip X3DH's SigKey-only nuance since our IK doubles as the signer."],
                  ["Curves", "ECDH + ECDSA on P-256 via WebCrypto", "X25519 is now in WebCrypto but support is still uneven across Safari/Firefox/older Node; P-256 is universally available, still 128-bit security. Swap is one constant change."],
                  ["Ratchet", "Full Double Ratchet: DH step per direction change + symmetric HKDF chain per message, ≤64 skipped keys buffered", "Gives FS (destroyed chain keys) and PCS (fresh DH each reply). Out-of-order window is bounded on purpose: more skip = more exposure."],
                  ["AEAD", "AES-256-GCM, 96-bit random IV, header as AAD, 128-bit tag", "Hardware AES-NI everywhere; AAD binding stops the relay from re-writing routing fields or re-signing content."],
                  ["KDF", "HKDF-SHA-256 with domain-separated info strings (KED-X3DH-v1 / KED-DR-recv-v1 / KED-SK:<room>)", "Standard ratchet-protocol practice: independent roots per purpose, no key reuse across contexts."],
                  ["Passphrase", "Vault key = PBKDF2-SHA-256(pass, random 16B salt, 750k). Server verifier = PBKDF2(pass, \"ked-auth-v1:<handle>\", 210k)", "Two different salts+costs ⇒ the relay can authenticate but cannot reach the vault key. Argon2id in WASM and a real PAKE are the upgrade path."],
                  ["Groups", "Sender Keys: creator makes one chain seed per member, ships each inside that member's verified pairwise session; re-key on membership change", "O(1) encryption per sender instead of N DHs per message; membership changes force fresh chains so removed members cannot read forward."],
                  ["Attachments", "random one-time 256-bit key per file, AES-GCM, SHA-256 of plaintext, key+digest inside the sealed message body", "Relay gets a nameless, typeless blob. A tampered blob fails the digest check and is refused before rendering."],
                  ["Auth", "64-hex bearer token, SHA-256 hashed at rest, 30-day expiry, per-device revocation, 6-strike lockout", "No cookies ⇒ no CSRF surface; token in sessionStorage-scoped resume key ⇒ tab close destroys the derived key."],
                ]}
              />
              <Code title="key hierarchy">
{`passphrase
  ├── vault key        = PBKDF2(pass, salt_vault, 750k)   → AES-GCM  encrypts:
  │      identity bundle (IK, SPK, OPK pool), ratchet sessions,
  │      group sender chains, decrypted history cache, settings, ledger
  └── auth verifier    = PBKDF2(pass, "ked-auth-v1:"+handle, 210k) → relay-side check only

identity (per account, rotated on demand)
  IK  = P-256 signing + DH key            → published
  SPK = P-256 signed prekey (IK signs SPK) → published; rotating it changes safety numbers
  OPK[0..23] = one-time prekeys, consumed once each by the relay

per conversation
  SK  = HKDF(dh1‖dh2‖dh3‖dh4, salt=IK_a‖IK_b, "KED-X3DH-v1") → root key + chain key
  DH ratchet pair, replaced on every direction change
  message key = HKDF(chain, root, "KED-DR-msgkey-v1") → used once, then dropped`}
              </Code>
            </Section>

            <Section id="wire" kicker="section 5" title="Wire format and one message end-to-end">
              <Code title="relay row (what a DB dump shows)">
{`{
  "id": "m_9f3c0a…",                 // opaque
  "room_id": "4f2a…8c11",            // SHA-256(IK_a ‖ IK_b)[0:40]
  "sender_id": "u_1a7d…",            // authenticated id, needed for the 403 check only
  "kind": "msg",                     // msg|file|reaction|edit|recall|receipt|typing|control
  "header": {                        // public, and bound as AEAD additional data
     "v":1, "t":"prekey", "n":0,
     "s":"BM6x…",  // sender IK (raw SEC1 point, base64)
     "p":"BKz2…",  // sender signed prekey
     "r":"BQ9t…",  // sender current ratchet pub
     "e":"BFR7…",  // initiator ephemeral (prekey msgs only)
     "o":3,        // consumed OPK index
     "sig":"MEUCIQ…"  // ECDSA(IK) over SHA-256(header ‖ body)
  },
  "body": "v1.aB3d…==.Zk9…==",       // "v1" . iv . AES-256-GCM(ct+tag), all base64
  "size": 412,
  "created_at": "2026-06-21T09:14:02.115Z",
  "expires_at": "2026-06-21T09:14:32.115Z",   // TTL shred sweep nulls body
  "destroyed_at": null
}`}
              </Code>
              <Code title="send path (client only)">
{`text ─▶ JSON payload {t:'msg', text, at, replyTo, attachment{key,sha,name,mime}}
     ─▶ chain step          mk, next = HKDF2(sendChain, root, 'KED-DR-msgkey-v1')
     ─▶ seal                ct = AES-256-GCM(mk, payload, aad=header)
     ─▶ sign                sig = ECDSA_IK(SHA-256(header ‖ ct))
     ─▶ POST /api/ked/send  {roomId, kind, header, body:"iv.ct", ttlMs}
     ─▶ destroy mk, advance chain, persist session inside the encrypted vault
receive ─▶ verify sig with header.s (IK) → DH ratchet if header.r is new
        → advance recv chain (buffer ≤64 skipped keys) → open → mk destroyed`}
              </Code>
              <p className="mono text-[11.5px] leading-relaxed text-[var(--ink-dim)]">
                The signature is what makes an honest-but-curious relay observable: it cannot edit a body, re-order rooms or forge a
                sender without the identity key, and any attempt surfaces as an <b>integrity.violation</b> entry in your ledger rather
                than a silently altered message.
              </p>
            </Section>

            <Section id="threat" kicker="section 6" title="Threat model — honest about the edges">
              <Table
                head={["Adversary", "Covered how", "Residual risk"]}
                rows={[
                  ["Malicious/compelled relay", "ciphertext-only storage, AAD-bound headers, ECDSA-signed bodies, no vault key derivable from the verifier", "knows who talks to whom, message sizes, timing, room↔member graph"],
                  ["Network observer / path MTU sniffing", "TLS + per-message keys irrelevant to them; no metadata in headers or URLs", "IP of the client; deploy behind Tor/onion or a relay-in-front topology if you care"],
                  ["Someone with your DB dump", "no private keys, no plaintext, message keys destroyed on both ends", "can replay entire rows to a peer (they will fail signature/counter checks), can count traffic"],
                  ["Stolen laptop, locked session", "vault is AES-GCM blob; passphrase required; sessionStorage key dies with the tab", "weak passphrase ⇒ offline brute force; 750k PBKDF2 is the bill you pay per guess"],
                  ["Shoulder surf / screen share", "blur on focus loss, burn timers, clipboard auto-clear", "a photo taken before the blur"],
                  ["XSS / hostile extension", "CSP (no eval, no inline beyond Next's, no third-party origins), no remote scripts, no iframe embeds", "an injected script running in your own origin can read plaintext before encryption — the only real fix is a native/attested client"],
                  ["Evil MITM at key exchange", "signed-prekey verification + 60-digit safety number + optional 'require verified' gate", "you skipping the out-of-band check (TOFU)"],
                  ["Coercion", "panic wipe: local vault destroyed, sessions revoked, own rows zeroed; no server-side key to surrender", "deniability is limited: the account exists on this relay"],
                ]}
              />
            </Section>

            <Section id="metadata" kicker="section 7" title="What the relay is able to learn">
              <div className="panel p-4">
                <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                  <KV k="learns" v="opaque user id, handle, pubkey bundle, room id, membership, seq, kind, sizes, timestamps, IP of the fetch" tone="warn" />
                  <KV k="never learns" v="plaintext, filenames, MIME, group names, your passphrase, any private key, your read state" tone="good" />
                  <KV k="poll pattern" v="1 request / 1.6 s while the tab is open, cursor-based ⇒ O(new messages)" />
                  <KV k="logs" v="audit rows are event classes only (auth.ok, msg.shredded …) with no content" tone="good" />
                </div>
              </div>
              <p className="mono text-[11.5px] leading-relaxed text-[var(--ink-dim)]">
                v1 keeps the sender id in the clear because the relay needs it for the 403 membership check — the same trade-off
                many metadata-minimal designs accept, and the one a few anonymity-first designs remove entirely. Closing it means sealed-sender + a PoW or blind-receipt
                anonymous channel, or a relay-per-pair topology. That is R13 on the roadmap, not a v1 claim.
              </p>
            </Section>

            <Section id="deploy" kicker="section 8" title="Deployment matrix">
              <Table
                head={["Host", "How", "Runtime", "Notes"]}
                rows={[
                  ["Vercel", "zero config: `vercel --prod`", "Node 20/22 (default) or Edge + Turso/KV", "use Neon for persistence; set TURSO_URL if you want edge"],
                  ["Netlify", "netlify.toml committed (build=next build, framework nextjs, headers block)", "Node runtime for pg; Edge functions only with turso/memory", "public/_headers is also shipped for static edge cases"],
                  ["Cloudflare Pages", "OpenNext adapter (`@opennextjs/cloudflare`) so node:pg works on the worker", "workerd + nodejs_compat", "point SHER_DB=turso or D1 via a small adapter; static shell on Pages"],
                  ["Cloudflare Workers", "deploy the relay router as a Worker: same handler signatures, fetch-based Turso/KV", "workerd", "flip `export const runtime` to edge and drop the pg branch"],
                  ["Docker / VPS", `docker run -e DATABASE_URL=postgres://… -e SHER_SQLITE_PATH=/data/ked.db`, "Node", "bind-mount /data; SQLite single-file is enough for one person"],
                  ["Static-only demo", `SHER_DB=memory`, "any Node host", "volatile ciphertext, perfect for evaluating the protocol"],
                ]}
              />
              <Code title="env — pick one backend, nothing else changes">
{`# Postgres family (Neon, Supabase, Neon-pooled, RDS, local)
DATABASE_URL=postgresql://user:pass@ep-x.neon.tech/db?sslmode=require

# Turso / libSQL over HTTP (works on edge runtimes)
TURSO_URL=libsql://sher-messenger-yourname.turso.io
TURSO_TOKEN=eyJhbGciOi…

# file-backed SQLite (node:sqlite, no native deps)
SHER_SQLITE_PATH=/data/sher-messenger.db

# volatile relay (default when nothing is configured)
SHER_DB=memory

# optional
SHER_RELAY_URL=            # if the relay lives on another origin
NEXT_PUBLIC_APP_NAME="SHER Messenger"`}
              </Code>
              <Code title="cloudflare pages + opennext (wrangler.toml)">
{`name = "sher-messenger"
pages_build_output_dir = ".vercel/output/static"
compatibility_flags = ["nodejs_compat"]
compatibility_date = "2026-06-01"

[[vars.plain_text]]        # secrets belong in "wrangler secret put"
TURSO_URL = "libsql://sher-messenger-yourname.turso.io"`}
              </Code>
              <Code title="netlify.toml (already in the repo)">
{`[build]
  command = "next build"
  publish = ".next"
[build.environment]
  NEXT_TELEMETRY_DISABLED = "1"
  NPM_FLAGS = "--no-audit --no-fund"
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = '''default-src 'self'; script-src 'self' 'unsafe-inline'; \
      style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; \
      connect-src 'self' wss: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; upgrade-insecure-requests'''
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "no-referrer"
    Permissions-Policy = "camera=(), microphone=(), geolocation=(), interest-cohort=()"
    Cross-Origin-Opener-Policy = "same-origin"
    X-Frame-Options = "DENY"`}
              </Code>
            </Section>

            <Section id="db" kicker="section 9" title="Storage adapters">
              <Table
                head={["Backend", "Env", "Runtime fit", "DDL path"]}
                rows={[
                  ["Neon / any Postgres", "DATABASE_URL (or POSTGRES_URL / NEON_DATABASE_URL)", "Node containers, Vercel, Netlify functions", "auto-CREATE TABLE IF NOT EXISTS on first boot + drizzle schema in src/db/schema.ts for `drizzle-kit push`"],
                  ["Supabase / RDS / Neon pooled", "same, any `postgresql://…` string", "Node", "identical; sslmode=require is detected"],
                  ["Turso (libSQL)", "TURSO_URL + TURSO_TOKEN", "Node and Edge (pure HTTP, no sockets)", "SQLite DDL, positional args via /transaction"],
                  ["libSQL self-hosted", "LIBSQL_URL + LIBSQL_TOKEN", "Node, edge, Fly.io machines", "same adapter"],
                  ["node:sqlite file", "SHER_SQLITE_PATH", "Docker, VPS, local dev", "same SQLite DDL, zero native deps"],
                  ["Memory", "SHER_DB=memory (or no config)", "CI, previews, edge demos", "no DDL; volatile by design"],
                ]}
              />
              <p className="mono text-[11.5px] leading-relaxed text-[var(--ink-dim)]">
                One interface (<span className="text-[var(--acc)]">Store</span>) with 30 methods: users, bundles, OPK consumption, auth
                sessions, rooms, membership, ciphertext stream, shred sweep, attachments, audit, token buckets. Every backend
                implements the same 12 tables, so you can migrate by dumping and restoring with no application change. Cloudflare D1
                and Upstash Redis slot in as two more implementations of the same interface — the schema is deliberately boring SQL.
              </p>
            </Section>

            <Section id="api" kicker="section 10" title="Relay API">
              <Table
                head={["Endpoint", "Auth", "Purpose", "Limits"]}
                rows={[
                  ["POST /api/ked/register", "—", "publish bundle + encrypted vault blob", "6 / 10 min"],
                  ["POST /api/ked/login", "—", "verify PBKDF2 verifier, mint bearer session, return vault blob", "10 / 10 min · 6 fails ⇒ 15 min lock"],
                  ["GET /api/ked/me", "Bearer", "resume: profile + vault blob", "—"],
                  ["POST /api/ked/bundle", "Bearer", "fetch (and consume) a peer's OPK", "40 / 10 min"],
                  ["POST /api/ked/rooms", "Bearer", "ensure room + join members (group wrapped keys are opaque)", "—"],
                  ["POST /api/ked/send", "Bearer", "append ciphertext; membership enforced; TTL recorded", "90 / min"],
                  ["GET /api/ked/sync?cursor=", "Bearer", "cursor stream for all my rooms + shred sweep", "240 / min"],
                  ["POST /api/ked/shred", "Bearer", "zero body + destroyed_at for ids I may touch", "120 / min"],
                  ["POST/GET /api/ked/attachment", "Bearer", "opaque blob store, room-scoped reads only", "20 / 5 min · 3 MB b64"],
                  ["GET /api/ked/devices · POST revoke-device", "Bearer", "session inventory + revocation", "—"],
                  ["GET /api/ked/ledger", "Bearer", "content-free relay-side event list", "—"],
                  ["GET /api/ked/stats · /health", "—", "adapter + counters + policy banner", "—"],
                  ["POST /api/ked/panic", "Bearer", "revoke all sessions + destroy the vault blob", "confirmation word required"],
                ]}
              />
            </Section>

            <Section id="limits" kicker="section 11" title="Limits, budgets and measured costs">
              <Table
                head={["Budget", "Target", "This build"]}
                rows={[
                  ["Unlock cost", "brute force must be expensive", "PBKDF2 750k ≈ 0.35–1.1 s on laptop-class hardware"],
                  ["Per-message crypto", "< 5 ms, no round trips", "1 ECDH + 2 HKDF + 1 AES-GCM: sub-millisecond"],
                  ["Idle bandwidth", "< 1 MB/h", "1.6 s cursor poll, empty body ≈ 300 B ⇒ ~650 KB/h worst case, tune to 5 s"],
                  ["Message size", "text ≤ 12 000 chars", "enforced client and relay (4 MB request ceiling, 3 MB base64 ciphertext cap)"],
                  ["Attachment", "≤ 2 MB per file", "2 MB plaintext ⇒ ~2.7 MB base64, inside the 3 MB cap"],
                  ["History", "bounded local store", "300 rows per room + 120 ledger rows, encrypted at rest in localStorage"],
                  ["First paint", "no blocking network", "no analytics, no font-blocking render (display=swap), single stylesheet"],
                ]}
              />
            </Section>

            <Section id="roadmap" kicker="section 12" title="Roadmap">
              <Table
                head={["Priority", "Work", "Why it matters"]}
                rows={[
                  ["P0 · next", "Argon2id (WASM) for the vault KDF + SRP-6a/OPAQUE-style PAKE", "removes the last offline-brute-force artefact the relay holds"],
                  ["P0 · next", "Sealed sender with blind-receipt or PoW routing; strip sender_id from rows", "the biggest remaining metadata leak"],
                  ["P1", "MLS (RFC 9420) TreeKEM for groups &gt; 8 members", "Sender Keys don't scale to big committees"],
                  ["P1", "WebRTC calls over the same ratchet (DTLS-SRTP key commitment) + relay-over-call", "voice with the same guarantees"],
                  ["P1", "Push via swappable provider (Web Push / Cloudflare Workers for Platforms) with ciphertext-only payloads", "usability without a socket"],
                  ["P2", "Dedicated D1 + KV adapters, R2 for attachments, multipart streaming", "one-click Cloudflare deploy with no egress bills"],
                  ["P2", "Third-party protocol audit + published threat-model addendum; reproducible builds", "trust, but verify"],
                  ["P2", "Tor/onion relay guide + client proxy config UI", "network-layer anonymity"],
                ]}
              />
            </Section>

            <Section id="checklist" kicker="section 13" title="Launch checklist">
              <div className="panel p-4">
                <ul className="grid gap-2">
                  <Bullet>HTTPS everywhere, HSTS preload at the edge, no mixed content, `cross-origin-isolation` if you add WASM.</Bullet>
                  <Bullet>Secrets only in host vaults (Vercel env / `wrangler secret put` / Netlify env). Never committed.</Bullet>
                  <Bullet>DB user without superuser rights; row-level security optional; nightly encrypted dump to offline media.</Bullet>
                  <Bullet>Log pipeline must drop request bodies — the relay logs nothing by default, keep it that way.</Bullet>
                  <Bullet>Backups: the app cannot recover a lost passphrase; document it on the signup screen (done) and in README.</Bullet>
                  <Bullet>Re-verify safety numbers after any key rotation, and treat the integrity.violation ledger line as a page alarm.</Bullet>
                  <Bullet>Before self-hosting for others: read the metadata caveat in §7 and decide if sealed-sender is required.</Bullet>
                </ul>
              </div>
              <div className="panel p-4">
                <div className="kicker mb-2">verify the claims yourself</div>
                <p className="mono text-[11.5px] leading-relaxed text-[var(--ink-dim)]">
                  <code className="text-[var(--acc)]">/api/dev-selftest</code> runs the exact modules the browser runs and returns a
                  pass/fail list: prekey signature verification, ratchet forward secrecy and out-of-order buffering, tamper
                  detection, sender-key groups, attachment digests, KDF salt handling, and every envelope format. Add{" "}
                  <code className="text-[var(--acc)]">?relay=1</code> to include a live register → send → sync → shred round trip that
                  asserts the stored body is never plaintext and that a relay-mirrored vault unlocks on a device with empty storage.
                </p>
                <div className="row mt-2.5 gap-2">
                  <a className="btn btn-sm" href="/api/dev-selftest" target="_blank" rel="noreferrer">
                    <Icon name="terminal" size={13} /> run crypto checks
                  </a>
                  <a className="btn btn-sm" href="/api/dev-selftest?relay=1" target="_blank" rel="noreferrer">
                    <Icon name="bolt" size={13} /> include relay round trip
                  </a>
                  <a className="btn btn-sm" href="/api/health" target="_blank" rel="noreferrer">
                    <Icon name="cpu" size={13} /> health
                  </a>
                </div>
              </div>
              <Code title="self-host in 60 seconds">
{`git clone <your-forge>/sher-messenger && cd sher-messenger
cp .env.example .env          # leave everything empty for a volatile relay
npm i && npm run build && npm start
# or with a real DB:
export DATABASE_URL="postgresql://…neon.tech/db?sslmode=require"
npx drizzle-kit push          # optional: creates the drizzle-managed tables
npm run build && npm start`}
              </Code>
              <div className="row justify-between gap-3 pt-2">
                <a className="btn btn-primary" href="/">
                  <Icon name="lock" size={14} /> Open the vault
                </a>
                <span className="mono text-[10.5px] text-[var(--ink-faint)]">
                  every claim on this page is exercised by the UI you can open right now
                </span>
              </div>
            </Section>
          </div>
        </main>
      </div>
    </div>
  );
}
