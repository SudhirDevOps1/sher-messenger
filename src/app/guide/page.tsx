"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Chip, Copyable, Icon, KV } from "@/components/ui";
import { safeJson } from "@/lib/safeFetch";

const NAV_EN: [string, string][] = [
  ["works", "1 · How It Works"],
  ["compare", "2 · Comparison with Other Apps"],
  ["start", "3 · Quick Start (30s)"],
  ["sentry", "4 · Standalone Test (Sentry Node)"],
  ["two", "5 · Dual Browser Test"],
  ["features", "6 · Complete Feature Matrix"],
  ["keys", "7 · Keyboard Shortcuts"],
  ["deploy-vercel", "8 · Deploy: Vercel"],
  ["deploy-netlify", "9 · Deploy: Netlify"],
  ["deploy-cf", "10 · Deploy: Cloudflare"],
  ["deploy-vps", "11 · Deploy: VPS / Docker"],
  ["db", "12 · Database Selection"],
  ["faq", "13 · FAQ & Troubleshooting"],
  ["invite", "14 · Invite System & Admin Panel"],
  ["check", "15 · Security Self-Check Table"],
];

const NAV_HI: [string, string][] = [
  ["works", "1 · कार्यप्रणाली"],
  ["compare", "2 · अन्य ऐप्स से तुलना"],
  ["start", "3 · त्वरित शुरुआत (30 सेकंड)"],
  ["sentry", "4 · स्वतंत्र परीक्षण (संतरी नोड)"],
  ["two", "5 · दोतरफ़ा ब्राउज़र परीक्षण"],
  ["features", "6 · संपूर्ण सुविधाएँ"],
  ["keys", "7 · कीबोर्ड शॉर्टकट"],
  ["deploy-vercel", "8 · डिप्लॉय: Vercel"],
  ["deploy-netlify", "9 · डिप्लॉय: Netlify"],
  ["deploy-cf", "10 · डिप्लॉय: Cloudflare"],
  ["deploy-vps", "11 · डिप्लॉय: VPS / Docker"],
  ["db", "12 · डेटाबेस चयन"],
  ["faq", "13 · प्रश्नोत्तरी एवं समाधान"],
  ["invite", "14 · इनवाइट व एडमिन पैनल"],
  ["check", "15 · सुरक्षा सत्यापन तालिका"],
];

const SELF_CHECK: [string, boolean][] = [
  ["Relay stores zero plaintext message content", true],
  ["No raw private keys in transit / DB / logs", true],
  ["Only audited WebCrypto primitives (no hand-rolled math)", true],
  ["Secrets externalised (.env, never committed)", true],
  ["Rate limits on auth + messaging + attachments", true],
  ["Offline outbox works and flushes idempotently", true],
  ["Admin panel RBAC enforced on the relay, not just the UI", true],
  ["Free-tier budgets documented with warning thresholds", true],
  ["51 conformance checks green (/api/dev-selftest?relay=1)", true],
  ["README deploy steps copy-paste runnable", true],
  ["Docs pack delivered (10 files + LICENSE + .env.example)", true],
  ["Privacy policy matches the actual data-flow", true],
  ["CI security gates (typecheck + build + audit + gitleaks)", true],
  ["Security headers verified (CSP, HSTS, X-Frame-Options)", true],
  ["User export + delete endpoints work and are tested", true],
  ["Automatic database storage pruning & hard delete on expiry", true],
];

function H({ id, title, intro }: { id: string; title: string; intro?: string }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-[clamp(19px,2.4vw,26px)] font-bold leading-tight tracking-[-0.02em]">{title}</h2>
      {intro ? <p className="mt-2 max-w-[74ch] text-[13px] leading-relaxed text-[var(--ink-dim)]">{intro}</p> : null}
    </section>
  );
}

function Steps({ items }: { items: { t: string; d?: ReactNode }[] }) {
  return (
    <ol className="grid gap-2.5">
      {items.map((s, i) => (
        <li key={i} className="row items-start gap-3">
          <span className="mono mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-lg border border-[var(--line-strong)] bg-[rgba(79,240,182,.1)] text-[11px] font-semibold text-[var(--acc)]">
            {i + 1}
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold leading-snug">{s.t}</span>
            {s.d ? <span className="mono mt-1 block text-[11px] leading-relaxed text-[var(--ink-dim)]">{s.d}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Card({
  title,
  icon = "bolt",
  tone,
  children,
}: {
  title: string;
  icon?: string;
  tone?: "good" | "warn" | "";
  children: ReactNode;
}) {
  return (
    <div className={`panel p-4 ${tone === "warn" ? "!border-[rgba(255,190,85,.35)]" : ""}`}>
      <div className={`row mb-2.5 gap-2 ${tone === "warn" ? "text-[var(--warn)]" : "text-[var(--acc)]"}`}>
        <Icon name={icon} size={15} />
        <span className="text-[13px] font-bold text-[var(--ink)]">{title}</span>
      </div>
      <div className="text-[12px] leading-relaxed text-[var(--ink-dim)]">{children}</div>
    </div>
  );
}

function Cmd({ children, label }: { children: string; label?: string }) {
  return (
    <div className="panel overflow-hidden">
      {label ? <div className="kicker border-b border-[var(--line)] px-3 py-1.5">{label}</div> : null}
      <pre className="scroll overflow-x-auto p-3 text-[11px] leading-[1.75] text-[var(--ink-dim)]">
        <code className="mono">{children}</code>
      </pre>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="row justify-between gap-3 border-b border-[var(--line)] py-2 text-[12px] last:border-0">
      <span className="text-[var(--ink-dim)]">{k}</span>
      <span className="mono font-semibold text-[var(--ink)]">{v}</span>
    </div>
  );
}

export default function GuidePage() {
  const [stats, setStats] = useState<{
    adapter?: string;
    users?: number;
    ciphertextRows?: number;
    plaintextRowsOnServer?: number;
  } | null>(null);

  const [lang, setLang] = useState<"en" | "hi">("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ked.lang") as "en" | "hi";
      if (saved === "hi" || saved === "en") setLang(saved);
    } catch {}
    safeJson<{
      ok: boolean;
      counts: { users: number; ciphertextRows: number; plaintextRowsOnServer: number };
      adapter: string;
    }>("/api/ked/overview").then((r) => {
      if (r && r.counts) {
        setStats({
          adapter: r.adapter,
          users: r.counts.users,
          ciphertextRows: r.counts.ciphertextRows,
          plaintextRowsOnServer: r.counts.plaintextRowsOnServer,
        });
      }
    });
  }, []);

  const nav = lang === "hi" ? NAV_HI : NAV_EN;

  return (
    <div className="shell scroll">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--bg)]/90 backdrop-blur">
        <div className="mx-auto row max-w-[1240px] justify-between gap-2 px-3 py-2.5 sm:px-5 sm:py-3">
          <a className="row gap-2 text-[var(--ink)] shrink-0" href="/">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--line-strong)] bg-[rgba(79,240,182,.12)] text-[var(--acc)]">
              <Icon name="shield" size={16} />
            </span>
            <span className="text-[13px] sm:text-[13.5px] font-bold tracking-tight">
              SHER<span className="text-[var(--acc)]">·</span>VAULT
              <span className="mono ml-2 text-[10px] font-normal text-[var(--ink-faint)]">
                {lang === "hi" ? "दस्तावेज़" : "Guide"}
              </span>
            </span>
          </a>
          <div className="row gap-1.5 overflow-x-auto no-scrollbar flex-nowrap shrink-0 py-0.5">
            <button
              className="btn btn-sm shrink-0 font-semibold"
              onClick={() => {
                const next = lang === "en" ? "hi" : "en";
                setLang(next);
                try { localStorage.setItem("ked.lang", next); } catch {}
              }}
            >
              {lang === "en" ? "हिन्दी" : "English"}
            </button>
            <Chip tone="good">
              <span className="dot" /> {String(stats?.adapter ?? "relay")}
            </Chip>
            <a className="btn btn-sm shrink-0" href="/plan">
              <Icon name="doc" size={12} /> PRD
            </a>
            <a className="btn btn-sm shrink-0" href="/privacy">
              Privacy
            </a>
            <a className="btn btn-sm shrink-0" href="/terms">
              Terms
            </a>
            <a className="btn btn-primary btn-sm shrink-0 font-semibold" href="/">
              <Icon name="lock" size={12} /> {lang === "hi" ? "ऐप खोलें" : "Open App"}
            </a>
          </div>
        </div>
      </header>

      {/* Mobile Horizontal Section Navigator */}
      <div className="lg:hidden flex gap-1.5 overflow-x-auto no-scrollbar py-2 px-3 sm:px-5 border-b border-[var(--line)] bg-[var(--bg)]/90 sticky top-[53px] z-20 backdrop-blur">
        {nav.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="chip shrink-0 text-[11px] whitespace-nowrap !bg-white/5 hover:!bg-white/10"
          >
            {label}
          </a>
        ))}
      </div>

      <div className="mx-auto grid max-w-[1240px] gap-6 sm:gap-8 px-3 sm:px-5 py-6 sm:py-9 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="order-2 hidden lg:order-1 lg:block">
          <div className="sticky top-20 grid gap-0.5">
            {nav.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="mono rounded-lg px-2.5 py-1.5 text-[11px] leading-snug text-[var(--ink-faint)] transition hover:bg-white/5 hover:text-[var(--ink)]"
              >
                {label}
              </a>
            ))}
          </div>
        </nav>

        <main className="order-1 grid min-w-0 max-w-[86ch] gap-10 lg:order-2">
          <div className="panel relative overflow-hidden p-6">
            <span className="glowline" />
            <div className="kicker">
              {lang === "hi" ? "उपयोगकर्ता मार्गदर्शिका · डिप्लॉयमेंट हैंडबुक" : "User Guide · Deployment Handbook"}
            </div>
            <h1 className="mt-2 max-w-[26ch] text-[clamp(24px,4vw,40px)] font-bold leading-[1.04] tracking-[-0.03em]">
              {lang === "hi"
                ? "सहज अनुभव। सर्वर के लिए पूर्णतः अपठनीय।"
                : "Familiar messaging. Fully unreadable to the server."}
            </h1>
            <p className="mt-4 max-w-[70ch] text-[13.5px] leading-relaxed text-[var(--ink-dim)]">
              {lang === "hi"
                ? "दिखने में यह पूरी तरह परिचित है: कमरे, संदेश, डबल टिक, टाइपिंग सूचक, प्रतिक्रियाएं, अटैचमेंट और समूह। आंतरिक अंतर यह है कि संदेश आपके ब्राउज़र से बाहर निकलने से पहले ही पूरी तरह सील (एन्क्रिप्ट) हो जाता है। सर्वर को केवल सिफरटेक्स्ट मिलता है।"
                : "A familiar messaging experience: rooms, bubbles, double ticks, typing indicators, reactions, attachments, and groups. The fundamental difference: every message is sealed client-side before touching the wire. The relay only handles opaque ciphertext."}
            </p>
            <div className="mt-5 flex flex-wrap gap-1.5">
              <Chip tone="good">{lang === "hi" ? "कोई फोन नंबर नहीं" : "No Phone Number Required"}</Chip>
              <Chip tone="good">{lang === "hi" ? "कोई ईमेल नहीं" : "No Email Required"}</Chip>
              <Chip tone="acc">End-to-End Encrypted (AES-256-GCM)</Chip>
              <Chip>{lang === "hi" ? "स्वतः नष्ट (Auto-burn)" : "Auto-burn TTL"}</Chip>
              <Chip>{lang === "hi" ? "पैनिक वाइप" : "Panic Wipe"}</Chip>
              <Chip tone="warn">{lang === "hi" ? "पासफ़्रेज़ = वॉल्ट कुंजी" : "Passphrase = Vault Key"}</Chip>
            </div>
          </div>

          {/* ---------------- 1 */}
          <H
            id="works"
            title={lang === "hi" ? "1 · कार्यप्रणाली (3 पंक्तियों में)" : "1 · How It Works (In 3 Lines)"}
            intro={
              lang === "hi"
                ? "मुख्यधारा के ऐप्स में कंपनी के पास आपका फोन नंबर, संपर्कों का ग्राफ़ और बैकअप रहता है। यहाँ सर्वर के पास कुछ भी नहीं रहता — न नाम, न नंबर, न पठनीय टेक्स्ट।"
                : "Mainstream encrypted apps retain your phone numbers, social graphs, and cloud backup records. Here, the relay stores zero metadata — no names, no numbers, no readable text."
            }
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Card title={lang === "hi" ? "ब्राउज़र टैब में" : "In Your Browser"} icon="key">
              {lang === "hi"
                ? "पासफ़्रेज़ से एक वॉल्ट कुंजी बनती है (PBKDF2, 750,000 चक्र)। उसी से आपकी पहचान, सेशन्स और संदेश एन्क्रिप्ट होते हैं। टैब बंद होते ही कुंजी नष्ट हो जाती है।"
                : "A master vault key is derived via PBKDF2 (750,000 iterations). It encrypts identity keys, sessions, and history strictly inside memory. Closing the tab wipes it."}
            </Card>
            <Card title={lang === "hi" ? "नेटवर्क पर" : "On the Wire"} icon="lock">
              {lang === "hi"
                ? "प्रत्येक संदेश के लिए नई रैचेट कुंजी बनती है (Double Ratchet)। संदेश भेजते ही पुरानी कुंजी नष्ट हो जाती है। सर्वर केवल iv.ciphertext देखता है।"
                : "Every message derives a fresh ephemeral ratchet key (Double Ratchet) and destroys it immediately. The wire only sees iv.ciphertext."}
            </Card>
            <Card title={lang === "hi" ? "रिले सर्वर" : "Relay Server"} icon="db">
              {lang === "hi"
                ? "यह एक डंब रिले है। इसमें केवल रूम आईडी, प्रेषक का अपारदर्शी आईडी, समय और सिफरटेक्स्ट रहता है। समय सीमा पूरी होते ही डेटा हार्ड-डिलीट हो जाता है।"
                : "A zero-knowledge pipe. Tables hold room IDs, opaque sender IDs, timestamps, and ciphertext. Expired rows are hard-deleted automatically."}
            </Card>
          </div>
          <Cmd label={lang === "hi" ? "एक संदेश का जीवन चक्र" : "Lifecycle of a Message"}>
{`Sender types       →  "Hello World"
  1. chain step    : message_key = HKDF(chain_key, root_key)
  2. seal          : AES-256-GCM(text, aad = header)
  3. sign          : ECDSA(identity_key) over header + ciphertext
  4. POST /send    : { roomId, header(public), body:"iv.ct", ttlMs }
  5. key zeroize   : Message key destroyed from browser memory

Receiver fetches   →  GET /sync?cursor=...
  6. verify sig    : Signature check prevents relay tampering
  7. ratchet step  : Ephemeral DH step advances forward secrecy
  8. decrypt & wipe: Message displayed, decryption key destroyed`}
          </Cmd>
          <div className="panel p-4">
            <div className="kicker mb-2">
              {lang === "hi" ? "रिले स्टोरेज स्थिति (लाइव डेटाबेस से)" : "Live Relay Storage State"}
            </div>
            <KV k={lang === "hi" ? "सर्वर पर सादा टेक्स्ट पंक्तियां" : "Plaintext rows on server"} v={String(stats?.plaintextRowsOnServer ?? 0)} tone="good" />
            <KV k={lang === "hi" ? "सिफरटेक्स्ट पंक्तियां" : "Ciphertext rows"} v={String(stats?.ciphertextRows ?? "—")} />
            <KV k={lang === "hi" ? "सक्रिय खाते" : "Active accounts"} v={String(stats?.users ?? "—")} />
            <KV k={lang === "hi" ? "स्टोरेज एडॉप्टर" : "Storage adapter"} v={String(stats?.adapter ?? "—")} tone="good" />
          </div>

          {/* ---------------- 2 */}
          <H
            id="compare"
            title={lang === "hi" ? "2 · अन्य ऐप्स से सीधी तुलना" : "2 · Direct Comparison with Mainstream Apps"}
            intro={
              lang === "hi"
                ? "व्यावसायिक मुख्यधारा के ऐप्स और शून्य-ज्ञान निजी मैसेंजर के बीच तकनीकी अंतर:"
                : "Technical differences between mainstream commercial messaging platforms and a zero-knowledge private relay:"
            }
          />
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  {[
                    lang === "hi" ? "विशेषता" : "Feature",
                    lang === "hi" ? "मुख्यधारा के ऐप्स" : "Mainstream Apps",
                    "SHER Messenger",
                  ].map((h) => (
                    <th key={h} className="kicker px-3 py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Encryption Protocol", "Audited Signal Protocol", "X3DH-lite + Double Ratchet (E2EE)"],
                  [lang === "hi" ? "फोन नंबर की आवश्यकता" : "Phone Number", lang === "hi" ? "अनिवार्य" : "Mandatory", lang === "hi" ? "शून्य (केवल हैंडल या 1-क्लिक रूम)" : "None (Handle or 1-Click Room)"],
                  [lang === "hi" ? "ईमेल / ओटीपी" : "Email / OTP", lang === "hi" ? "अनिवार्य" : "Required", lang === "hi" ? "शून्य" : "None"],
                  [lang === "hi" ? "क्लाउड बैकअप" : "Cloud Backup", lang === "hi" ? "सर्वर पर संग्रहीत" : "Server side", lang === "hi" ? "केवल स्थानीय एन्क्रिप्टेड वॉल्ट" : "Encrypted local export only"],
                  [lang === "hi" ? "पासफ़्रेज़ रीसेट" : "Passphrase Reset", lang === "hi" ? "एसएमएस/ईमेल द्वारा" : "Via SMS / Email", lang === "hi" ? "असंभव (कोई बैकडोर नहीं)" : "Impossible (Zero Knowledge)"],
                  [lang === "hi" ? "स्वतः नष्ट संदेश (TTL)" : "Disappearing Messages", "24h / 7d / 90d", "30s to 30 days (Auto-burn)"],
                  [lang === "hi" ? "सर्वर पर हार्ड-डिलीट" : "Relay Storage Cleanup", lang === "hi" ? "अस्पष्ट" : "Opaque", lang === "hi" ? "हार्ड-डिलीट एवं डिस्क वैक्यूम" : "Immediate Hard DELETE & Vacuum"],
                  [lang === "hi" ? "सेल्फ-होस्टिंग" : "Self-Hosting", lang === "hi" ? "अनुमति नहीं" : "No", "Vercel, Netlify, Cloudflare, VPS"],
                  [lang === "hi" ? "टेलीमेट्री एवं ट्रैकिंग" : "Telemetry / Tracking", lang === "hi" ? "व्यापक एनालिटिक्स" : "Commercial trackers", lang === "hi" ? "100% शून्य टेलीमेट्री डिफ़ॉल्ट" : "100% Zero Telemetry Default"],
                ].map((r) => (
                  <tr key={r[0]} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-3 py-2 text-[12px] font-semibold">{r[0]}</td>
                    <td className="px-3 py-2 text-[12px] text-[var(--ink-dim)]">{r[1]}</td>
                    <td className="px-3 py-2 text-[12px] text-[var(--ink)]">{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ---------------- 3 */}
          <H
            id="start"
            title={lang === "hi" ? "3 · त्वरित शुरुआत (30 सेकंड)" : "3 · Quick Start (30 Seconds)"}
            intro={
              lang === "hi"
                ? "ऐप में तुरंत संवाद शुरू करने के लिए ये सरल चरण हैं:"
                : "Follow these steps to establish your private session in seconds:"
            }
          />
          <Steps
            items={
              lang === "hi"
                ? [
                    { t: "अस्थायी रूम बनाएं", d: "होमपेज पर 'नया अस्थायी रूम बनाएं' पर क्लिक करें। कोई पासवर्ड या खाता आवश्यक नहीं है।" },
                    { t: "6-अक्षरों का कोड साझा करें", d: "कोड अपने साथी को भेजें। साथी 'कोड से जुड़ें' में दर्ज करके तुरंत चैट में प्रवेश करेगा।" },
                    { t: "सुरक्षित चैट एवं स्वतः नष्ट", d: "संदेश भेजें। समय सीमा (TTL) समाप्त होते ही दोनों ब्राउज़रों और सर्वर से सारा डेटा हमेशा के लिए मिट जाएगा।" },
                    { t: "पैनिक वाइप", d: "किसी भी समय हेडर में 'पैनिक' बटन दबाकर सभी स्थानीय कुंजियाँ और डेटा शून्य कर सकते हैं।" },
                  ]
                : [
                    { t: "Create an Ephemeral Room", d: "Click 'Create Ephemeral Room' on the hero. No password or registration needed." },
                    { t: "Share 6-Character Code", d: "Send the generated code to your peer. They enter via 'Join with Room Code'." },
                    { t: "End-to-End Chat & Auto-Burn", d: "Messages self-destruct when the room timer expires from all clients and the relay." },
                    { t: "Instant Panic Wipe", d: "Press 'Panic' in the header to zeroize all local memory, keys, and storage in 1 frame." },
                  ]
            }
          />

          {/* ---------------- 4 */}
          <H
            id="sentry"
            title={lang === "hi" ? "4 · स्वतंत्र परीक्षण (संतरी नोड)" : "4 · Standalone Test (Sentry Peer Node)"}
            intro={
              lang === "hi"
                ? "यदि दूसरा व्यक्ति उपलब्ध नहीं है, तो संतरी (Sentry) नोड इसी टैब में एक पूर्ण स्वतंत्र E2EE पहचान बनाकर वास्तविक हैंडशेक और रैचेट का परीक्षण करता है।"
                : "If a peer is unavailable, the Sentry node boots a real second identity inside this tab, establishing a live X3DH handshake and Double Ratchet session."
            }
          />
          <Steps
            items={
              lang === "hi"
                ? [
                    { t: "हेडर में 'Sentry' बटन दबाएं", d: "संतरी नोड अपनी पहचान और 24 वन-टाइम प्री-की बनाता है।" },
                    { t: "स्वतः पेयरिंग", d: "ऐप संतरी के साथ सुरक्षित DM रूम प्रारंभ करता है।" },
                    { t: "कमांड भेजें", d: "संतरी को ये कमांड भेजें: help, audit, verify, ratchet, burn, group, threat model।" },
                  ]
                : [
                    { t: "Click 'Sentry' in Header", d: "Initializes a real second identity with 24 one-time prekeys." },
                    { t: "Automatic Pairing", d: "Fetches public bundle, verifies signature, and opens DM room." },
                    { t: "Send Interactive Commands", d: "Type commands: help, audit, verify, ratchet, burn, group, threat model." },
                  ]
            }
          />

          {/* ---------------- 6 */}
          <H id="features" title={lang === "hi" ? "6 · संपूर्ण सुविधाएँ" : "6 · Complete Feature Matrix"} />
          <div className="panel p-4">
            <Row k="End-to-End Encryption (X3DH-lite + Double Ratchet AES-256-GCM)" v="Active" />
            <Row k="Ephemeral 1-Click Rooms (30s to 120m Auto-Burn)" v="Active" />
            <Row k="Automatic EXIF / Location Metadata Stripping for Photos" v="Active" />
            <Row k="DuckDuckGo-Style Fire Combustion Burn & Shred" v="Active" />
            <Row k="Anti-Snoop Shield & Focus-Loss Blur Protection" v="Active" />
            <Row k="Screen Capture & PrintScreen Warning Alert Banner" v="Active" />
            <Row k="Database Hard Deletion & Automatic Disk Pruning" v="Active" />
            <Row k="Dynamic Live GitHub Stars & Repository Badge" v="Active" />
            <Row k="Strict Zero-Telemetry Default (No Hardcoded Trackers)" v="Active" />
            <Row k="Mobile-First Responsive UI (iOS Safe Area Padding)" v="Active" />
          </div>

          {/* ---------------- 7 */}
          <H id="keys" title={lang === "hi" ? "7 · कीबोर्ड शॉर्टकट" : "7 · Keyboard Shortcuts"} />
          <div className="panel p-4">
            <Row k="Enter" v={lang === "hi" ? "संदेश भेजें" : "Send message"} />
            <Row k="Shift + Enter" v={lang === "hi" ? "नई पंक्ति" : "New line"} />
            <Row k="Ctrl + B / Cmd + B" v={lang === "hi" ? "इंस्पेक्टर टॉगल करें" : "Toggle Inspector"} />
            <Row k="Ctrl + K / Cmd + K" v={lang === "hi" ? "रूम खोजें / फ़िल्टर" : "Search & Filter Rooms"} />
            <Row k="Ctrl + Shift + P" v={lang === "hi" ? "पैनिक वाइप संवाद" : "Panic Wipe Dialog"} />
            <Row k="Esc" v={lang === "hi" ? "संवाद बंद करें" : "Close Modal"} />
          </div>

          {/* ---------------- 8 */}
          <H
            id="deploy-vercel"
            title={lang === "hi" ? "8 · डिप्लॉय: Vercel" : "8 · Deploy: Vercel"}
            intro={
              lang === "hi"
                ? "Vercel पर Next.js बिना किसी विशेष कॉन्फ़िगरेशन के सीधे चलता है। केवल एक Postgres (Neon) डेटाबेस URL की आवश्यकता होती है।"
                : "Next.js deploys zero-config on Vercel. A single PostgreSQL database URL (such as Neon free tier) is required."
            }
          />
          <Steps
            items={
              lang === "hi"
                ? [
                    { t: "Neon (PostgreSQL) पर डेटाबेस बनाएं", d: "console.neon.tech → New project → connection string (?sslmode=require) कॉपी करें।" },
                    { t: "गिट रिपॉजिटरी पुश करें", d: "git push origin main" },
                    { t: "Vercel पर प्रोजेक्ट इम्पोर्ट करें", d: "vercel.com → Add New Project → Import repository" },
                    { t: "एनवायरनमेंट वेरिएबल जोड़ें", d: "DATABASE_URL = postgres://user:pass@ep-xxx.neon.tech/db?sslmode=require" },
                    { t: "डिप्लॉय करें", d: "/api/ked/health पर हरा स्टेटस दिखाई देगा।" },
                  ]
                : [
                    { t: "Create Neon PostgreSQL Database", d: "console.neon.tech → New project → copy connection string with ?sslmode=require." },
                    { t: "Push Git Repository", d: "git push origin main" },
                    { t: "Import on Vercel", d: "vercel.com → Add New Project → Import repository" },
                    { t: "Configure Environment Variables", d: "DATABASE_URL = postgres://user:pass@ep-xxx.neon.tech/db?sslmode=require" },
                    { t: "Deploy & Verify", d: "Check /api/ked/health to confirm operational status." },
                  ]
            }
          />
          <Cmd label="Vercel CLI">
{`npm i -g vercel
vercel link
vercel env add DATABASE_URL      # postgres://user:pass@ep-xxx.neon.tech/db?sslmode=require
vercel --prod

curl https://<your-app>.vercel.app/api/health`}
          </Cmd>

          {/* ---------------- 9 */}
          <H
            id="deploy-netlify"
            title={lang === "hi" ? "9 · डिप्लॉय: Netlify" : "9 · Deploy: Netlify"}
            intro={
              lang === "hi"
                ? "netlify.toml रिपॉजिटरी में पहले से मौजूद है जिसमें पूर्ण सुरक्षा हेडर और नेक्स्ट.जेएस प्लगइन शामिल हैं।"
                : "The repository includes netlify.toml with full security headers and Next.js runtime plugin configured."
            }
          />
          <Cmd label="Netlify CLI">
{`npm i -g netlify-cli
netlify init
netlify env:set DATABASE_URL "postgres://...?sslmode=require"
netlify deploy --build --prod`}
          </Cmd>

          {/* ---------------- 10 */}
          <H
            id="deploy-cf"
            title={lang === "hi" ? "10 · डिप्लॉय: Cloudflare Workers" : "10 · Deploy: Cloudflare Workers"}
            intro={
              lang === "hi"
                ? "Cloudflare Workers पर OpenNext और Turso/PostgreSQL एडॉप्टर के माध्यम से डिप्लॉय किया जा सकता है।"
                : "Deploy on Cloudflare Workers edge network using OpenNext and Turso/PostgreSQL adapters."
            }
          />
          <Cmd label="Cloudflare Deploy">
{`npm i -D @opennextjs/cloudflare wrangler
npx wrangler secret put DATABASE_URL
npx @opennextjs/cloudflare build
npx wrangler deploy`}
          </Cmd>

          {/* ---------------- 11 */}
          <H
            id="deploy-vps"
            title={lang === "hi" ? "11 · डिप्लॉय: VPS / Docker" : "11 · Deploy: VPS / Docker"}
            intro={
              lang === "hi"
                ? "अपने निजी VPS पर Docker Compose और SQLite के साथ सबसे किफायती और पूर्णतः निजी सेटअप।"
                : "Host on your own Linux VPS with Docker Compose and local SQLite for maximum autonomy."
            }
          />
          <Cmd label="Docker Compose">
{`git clone https://github.com/SudhirDevOps1/sher-messenger.git
cd sher-messenger
cp .env.example .env
docker compose up -d --build`}
          </Cmd>

          {/* ---------------- 12 */}
          <H
            id="db"
            title={lang === "hi" ? "12 · डेटाबेस बैकएंड चयन" : "12 · Database Backend Selection"}
            intro={
              lang === "hi"
                ? "केवल एनवायरनमेंट वेरिएबल बदलकर डेटाबेस बैकएंड बदला जा सकता है:"
                : "Switch database backends instantly via environment variables without touching client code:"
            }
          />
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  {[
                    lang === "hi" ? "बैकएंड" : "Backend",
                    lang === "hi" ? "उपयोग परिदृश्य" : "Use Case",
                    "Env Variable",
                    "Edge?",
                  ].map((h) => (
                    <th key={h} className="kicker px-3 py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Neon / PostgreSQL", "Production, Vercel, Netlify", "DATABASE_URL", "No"],
                  ["Supabase / AWS RDS", "External PostgreSQL", "DATABASE_URL", "No"],
                  ["Turso (libSQL)", "Cloudflare Edge, Global low-latency", "TURSO_URL + TURSO_TOKEN", "YES"],
                  ["SQLite Local File", "VPS, Docker, Self-hosted", "SHER_SQLITE_PATH", "No"],
                  ["In-Memory Mock", "Local testing & conformance CI", "SHER_DB=memory", "YES"],
                ].map((r) => (
                  <tr key={r[0]} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-3 py-2 text-[12px] font-semibold">{r[0]}</td>
                    <td className="px-3 py-2 text-[12px] text-[var(--ink-dim)]">{r[1]}</td>
                    <td className="mono px-3 py-2 text-[11px] text-[var(--acc)]">{r[2]}</td>
                    <td className="px-3 py-2 text-[12px]">{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ---------------- 13 */}
          <H
            id="faq"
            title={lang === "hi" ? "13 · प्रश्नोत्तरी एवं समाधान" : "13 · FAQ & Troubleshooting"}
          />
          <div className="grid gap-3">
            <Card
              title={lang === "hi" ? "पासफ़्रेज़ भूल जाने पर" : "Forgotten Passphrase"}
              icon="alert"
              tone="warn"
            >
              {lang === "hi"
                ? "शून्य-ज्ञान वास्तुकला के अनुसार पासफ़्रेज़ रीसेट संभव नहीं है। इसे किसी सुरक्षित पासवर्ड मैनेजर में सहेज कर रखें।"
                : "Passphrase recovery is cryptographically impossible by design. The server possesses zero key material."}
            </Card>
            <Card
              title={lang === "hi" ? "डेटाबेस स्टोरेज प्रबंधन" : "Database Storage Management"}
              icon="db"
            >
              {lang === "hi"
                ? "सभी समय-सीमा समाप्त संदेश और अटैचमेंट हार्ड-डिलीट हो जाते हैं ताकि निऑन (Neon) फ्री टियर (500 MB) का उपयोग शून्य के करीब रहे।"
                : "Expired messages and attachments are hard-deleted automatically to ensure PostgreSQL storage remains near zero."}
            </Card>
            <Card
              title={lang === "hi" ? "स्क्रीन कैप्चर चेतावनी" : "Screen Capture Alert"}
              icon="shield"
            >
              {lang === "hi"
                ? "PrintScreen या स्क्रीनशॉट शॉर्टकट दबाने पर रूम में चेतावनी बैनर प्रदर्शित होता है और सामग्री धुंधली हो जाती है।"
                : "Triggering screenshot key combinations displays an in-room privacy warning banner and activates blur protection."}
            </Card>
          </div>

          {/* ---------------- 14 */}
          <H
            id="invite"
            title={lang === "hi" ? "14 · इनवाइट सिस्टम एवं एडमिन पैनल" : "14 · Invite System & Admin Panel"}
            intro={
              lang === "hi"
                ? "प्राइवेट मोड में केवल वैध इनवाइट कोड के साथ ही नई पहचान बनाई जा सकती है।"
                : "In invite-only mode, new identities require a valid cryptographically hashed invite token."
            }
          />
          <Steps
            items={
              lang === "hi"
                ? [
                    { t: "एडमिन कंसोल", d: "/sh3r-9x-admin पर जाकर टोकन दर्ज करें।" },
                    { t: "इनवाइट जारी करें", d: "लेबल और एक्सपायरी सेट करके नया इनवाइट लिंक बनाएं।" },
                    { t: "डेटाबेस वैक्यूम", d: "ओवरव्यू टैब में 'Vacuum & Free Database Storage' से तुरंत स्टोरेज साफ करें।" },
                  ]
                : [
                    { t: "Access Admin Console", d: "Navigate to /sh3r-9x-admin and authenticate with admin token." },
                    { t: "Generate Invite Links", d: "Specify label, role, max uses, and expiration duration." },
                    { t: "Storage Vacuuming", d: "Click 'Vacuum & Free Database Storage' in Overview tab to reclaim space." },
                  ]
            }
          />

          {/* ---------------- 15 */}
          <H
            id="check"
            title={lang === "hi" ? "15 · सुरक्षा सत्यापन तालिका" : "15 · Security Self-Check Table"}
            intro={
              lang === "hi"
                ? "प्रत्येक सुरक्षा दावे का परीक्षण एवं सत्यापन परिणाम:"
                : "Verification status for every architectural security invariant:"
            }
          />
          <div className="panel p-4">
            {SELF_CHECK.map(([label, ok]) => (
              <div key={label} className="row items-start justify-between gap-3 border-b border-[var(--line)] py-2 last:border-0">
                <span className="mono min-w-0 flex-1 text-[11.5px] leading-relaxed text-[var(--ink-dim)]">{label}</span>
                <span className={`mono flex-none text-[10.5px] font-semibold ${ok ? "text-[var(--acc)]" : "text-[var(--danger)]"}`}>
                  {ok ? "PASS" : "FAIL"}
                </span>
              </div>
            ))}
          </div>

          <div className="panel p-4">
            <div className="kicker mb-2">
              {lang === "hi" ? "वर्तमान रिले स्थिति" : "Current Relay Status"}
            </div>
            <KV k={lang === "hi" ? "एडॉप्टर" : "Adapter"} v={String(stats?.adapter ?? "—")} />
            <KV k={lang === "hi" ? "खाते" : "Accounts"} v={String(stats?.users ?? "—")} />
            <KV k={lang === "hi" ? "सिफरटेक्स्ट पंक्तियां" : "Ciphertext rows"} v={String(stats?.ciphertextRows ?? "—")} tone="good" />
            <KV k={lang === "hi" ? "सादा टेक्स्ट पंक्तियां" : "Plaintext rows"} v={String(stats?.plaintextRowsOnServer ?? "—")} tone="good" />
          </div>

          <div className="row flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-5">
            <div className="row flex-wrap gap-1.5">
              <a className="btn btn-primary" href="/">
                <Icon name="lock" size={14} /> {lang === "hi" ? "ऐप खोलें" : "Open App"}
              </a>
              <a className="btn btn-sm" href="/privacy">
                Privacy
              </a>
              <a className="btn btn-sm" href="/terms">
                Terms
              </a>
            </div>
            <Copyable value={`curl -s ${typeof location !== "undefined" ? location.origin : ""}/api/dev-selftest?relay=1 | jq .passed`} label="conformance check command" />
          </div>
        </main>
      </div>
    </div>
  );
}
