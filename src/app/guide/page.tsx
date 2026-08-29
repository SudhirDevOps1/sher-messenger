"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Chip, Copyable, Icon, KV } from "@/components/ui";
import { safeJson } from "@/lib/safeFetch";

const NAV: [string, string][] = [
  ["works", "1 · Ye kaise kaam karta hai"],
  ["compare", "2 · Doosre apps se comparison"],
  ["start", "3 · Message kaise karein"],
  ["sentry", "4 · Akela test kaise karein (Sentry)"],
  ["two", "5 · Do log / do browser"],
  ["features", "6 · Saare features — ek-ek karke"],
  ["keys", "7 · Keyboard shortcuts"],
  ["deploy-vercel", "8 · Deploy: Vercel"],
  ["deploy-netlify", "9 · Deploy: Netlify"],
  ["deploy-cf", "10 · Deploy: Cloudflare"],
  ["deploy-vps", "11 · Deploy: VPS / Docker"],
  ["db", "12 · Database kaise chunein"],
  ["faq", "13 · FAQ / troubleshooting"],
  ["invite", "14 · Invite system + Admin panel"],
  ["check", "15 · Self-check table"],
];

const SELF_CHECK: [string, boolean][] = [
  ["relay stores zero plaintext message content", true],
  ["no raw private keys in transit / DB / logs", true],
  ["only audited WebCrypto primitives (no hand-rolled math)", true],
  ["secrets externalised (.env, never committed)", true],
  ["rate limits on auth + messaging + attachments", true],
  ["offline outbox works and flushes idempotently", true],
  ["admin panel RBAC enforced on the relay, not just the UI", true],
  ["free-tier budgets documented with warning thresholds", true],
  ["51 conformance checks green (`/api/dev-selftest?relay=1`)", true],
  ["README deploy steps copy-paste runnable", true],
  ["docs pack delivered (10 files + LICENSE + .env.example)", true],
  ["privacy policy matches the ACTUAL data-flow (no false claims)", true],
  ["CI security gates (typecheck + build + audit + gitleaks + SBOM)", true],
  ["security headers verified (curl / securityheaders.com)", true],
  ["user export + delete endpoints work and are tested", true],
  ["backup + restore drill documented AND scripted", true],
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

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="row items-start justify-between gap-4 border-b border-[var(--line)] py-2 last:border-0">
      <span className="min-w-0 flex-1 text-[12px] text-[var(--ink-dim)]">{k}</span>
      <span className="mono flex-none text-right text-[11px] text-[var(--ink)]">{v}</span>
    </div>
  );
}

export default function Guide() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void safeJson<Record<string, unknown>>("/api/ked/stats").then(setStats);
  }, []);

  return (
    <div className="shell scroll">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[rgba(5,7,12,.84)] backdrop-blur-xl">
        <div className="mx-auto row max-w-[1240px] items-center justify-between gap-3 px-5 py-3">
          <a href="/" className="row gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--line-strong)] bg-[rgba(79,240,182,.12)] text-[var(--acc)]">
              <Icon name="shield" size={16} />
            </span>
            <span className="text-[13.5px] font-bold tracking-tight">
              KED<span className="text-[var(--acc)]">·</span>VAULT <span className="kicker ml-1">/ guide</span>
            </span>
          </a>
          <div className="row gap-1.5">
            <Chip tone="good">
              <span className="dot" /> {String(stats?.adapter ?? "relay")}
            </Chip>
            <a className="btn btn-sm" href="/plan">
              <Icon name="doc" size={12} /> PRD
            </a>
            <a className="btn btn-sm" href="/privacy">
              Privacy
            </a>
            <a className="btn btn-sm" href="/terms">
              Terms
            </a>
            <a className="btn btn-primary btn-sm" href="/">
              <Icon name="lock" size={12} /> App kholo
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1240px] gap-8 px-5 py-9 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="order-2 hidden lg:order-1 lg:block">
          <div className="sticky top-20 grid gap-0.5">
            {NAV.map(([id, label]) => (
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
            <div className="kicker">user guide · deploy handbook</div>
            <h1 className="mt-2 max-w-[26ch] text-[clamp(24px,4vw,40px)] font-bold leading-[1.04] tracking-[-0.03em]">
              Jaana-pehchana chalega. Bas server andha hai.
            </h1>
            <p className="mt-4 max-w-[70ch] text-[13.5px] leading-relaxed text-[var(--ink-dim)]">
              Upar se dekho to bilkul familiar hai: rooms, bubbles, double tick, typing…, reactions, attachments, groups. Andar se farq
              itna hai ki message <b className="text-[var(--ink)]">aapke browser se pehle hi band (sealed)</b> ho chuka hota hai — server
              ko sirf kachra (ciphertext) milta hai. Is page par sab kuch step-by-step hai: message kaise bhejein, akela test kaise
              karein, aur har platform par deploy ka exact tarika.
            </p>
            <div className="mt-5 flex flex-wrap gap-1.5">
              <Chip tone="good">koi phone number nahi</Chip>
              <Chip tone="good">koi email nahi</Chip>
              <Chip tone="acc">end-to-end encrypted by default</Chip>
              <Chip>auto-burn</Chip>
              <Chip>panic wipe</Chip>
              <Chip tone="warn">passphrase = aapki chaabi</Chip>
            </div>
          </div>

          {/* ---------------- 1 */}
          <H
            id="works"
            title="1 · Ye kaise kaam karta hai (3 line mein)"
            intro="Socho: bade mainstream apps ke messages bhi encrypted hote hain, par company ke paas aapka phone number, contacts ka graph aur cloud backups rehte hain. Yahan server ke paas kuch nahi rehta — na naam, na number, na padhne layak text."
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Card title="Aapke tab mein" icon="key">
              Passphrase se ek <b>vault key</b> banti hai (PBKDF2, 750 hazar rounds). Usi se aapki pehchaan (identity key), purane
              sessions, history — sab encrypt hote hain. Ye key tab band hone tak memory mein rehti hai, phir gayab.
            </Card>
            <Card title="Network par" icon="lock">
              Har message ka apna <b>naya key</b> hota hai (Double Ratchet). Message bhejte hi wo key destroy ho jati hai. Server sirf
              <code className="mono text-[var(--acc)]"> iv.ciphertext</code> dekhta hai.
            </Card>
            <Card title="Server (relay)" icon="db">
              Ek dumb pipe. Rows mein: room id, bhejne wale ka opaque id, size, time, aur ciphertext. TTL ho to wo khud body ko NULL
              kar deta hai.
            </Card>
          </div>
          <Cmd label="ek message ka safar">
{`aap type karte ho  →  "hi ked"
  1. chain step        : naya message key = HKDF(chain, root)
  2. seal              : AES-256-GCM(text, aad = header)
  3. sign              : ECDSA(identity key) over header + ciphertext
  4. POST /api/ked/send: {roomId, header(public), body:"iv.ct", ttlMs}
  5. key destroy       : ab use koi nahi padh sakta — na server, na aap

doosra device       →  GET /api/ked/sync?cursor=…
  6. signature check   : relay ne chhed-chhad ki to "integrity violation"
  7. ratchet step      : naya DH (agar direction badli) → chain aage
  8. decrypt + destroy : text dikha, key fenk di`}
          </Cmd>
          <div className="panel p-4">
            <div className="kicker mb-2">relay ke paas kya hai (live DB se)</div>
            <KV k="plaintext rows" v={String(stats?.plaintextRowsOnServer ?? 0)} tone="good" />
            <KV k="ciphertext rows" v={String(stats?.ciphertextRows ?? "—")} />
            <KV k="accounts" v={String(stats?.users ?? "—")} />
            <KV k="adapter" v={String(stats?.adapter ?? "—")} tone="good" />
          </div>

          {/* ---------------- 2 */}
          <H
            id="compare"
            title="2 · Doosre apps se seedha comparison"
            intro="Jhoot bolne ka fayda nahi: bade mainstream apps kuch cheezon mein better hain (user base, calls, multi-device). Kuch cheezein yahan better hain."
          />
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  {["Cheez", "Mainstream big-tech app", "SHER Messenger"].map((h) => (
                    <th key={h} className="kicker px-3 py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Encryption", "audited ratchet protocol (E2EE), default on", "X3DH-lite + Double Ratchet (E2EE), default on"],
                  ["Phone number", "zaroori", "nahi — sirf handle"],
                  ["Email / OTP", "zaroori", "nahi"],
                  ["Backup", "cloud (Meta ke paas)", "encrypted export, sirf aapke paas"],
                  ["Server dekh sakta", "metadata + backups", "sirf ciphertext, size, time"],
                  ["Passphrase reset", "OTP se ho jata", "NAHI — bhool gaye to data gaya"],
                  ["Disappearing messages", "haan (24h/7d/90d)", "haan — 30s se 30 din, per room + per message"],
                  ["Unsend (sabke liye)", "haan, ~1 ghante tak", "haan, kabhi bhi + relay par shred"],
                  ["Reactions / reply / edit", "haan", "haan (ratchet ke saath)"],
                  ["Groups", "1024 members tak", "sender keys, re-key on membership change"],
                  ["Voice / video call", "haan", "nahi (roadmap mein)"],
                  ["Push notifications", "haan", "foreground polling (1.6s)"],
                  ["Self-host", "nahi", "haan — Vercel, Netlify, Cloudflare, VPS"],
                  ["Analytics / ads", "Meta ecosystem", "zero, third-party scripts nahi"],
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
            title="3 · Message kaise karein (30 second)"
            intro="Pehli baar app khulega to pehchan banani padegi. Ye 4 kadam hai, phir roz sirf passphrase dalna hai."
          />
          <Steps
            items={[
              { t: "Identity banao", d: "handle (3–24 chars: a-z 0-9 . _ -) + ek lambi passphrase (kam se kam 10, ideally 20+ chars ya 4-5 shabdon ka jumla)." },
              { t: "Passphrase yaad rakho / likh lo", d: "Yahi vault key hai. Bhoolne par reset NAHI hai — main bhi nahi bacha sakta. Password manager ya kagaz." },
              { t: "Sentry se jud jao (auto hota hai)", d: "Pehli login par app khud ek doosri real identity (Sentry) banata hai aur usse room khol deta hai. Turant baat-cheet shuru." },
              { t: "Type karo → Enter", d: "Bubble ke neeche: 🔥 reactions, reply, copy, edit, unsend. Niche TTL chips se auto-burn chuno." },
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Card title="Kisi aur se baat kaise karein" icon="plus">
              Left rail → <b>New DM</b> → uska handle likho (usko isi relay par registered hona hoga) → <b>fetch bundle & derive room</b>.
              Room id dono ki public keys ka hash hai, isliye koi aur us room ka naam bhi nahi jaan sakta. Phir Inspector → Session →{" "}
              <b>safety number</b> milao (awaaz se, QR se, offline) → <b>mark verified</b>.
            </Card>
            <Card title="Group kaise banao" icon="users">
              Pehle contact add karo → <b>Group</b> → members tick karo → <b>generate sender keys</b>. Creator har member ke liye alag
              sender chain banata hai aur uski verified 1:1 session ke andar bhejta hai. Membership badlo to <b>re-key</b> karna
              zaroori hai (naye member ko purani baatein nahi dikhengi).
            </Card>
          </div>

          {/* ---------------- 4 */}
          <H
            id="sentry"
            title="4 · Akela test kaise karein (Sentry node)"
            intro="Koi dost available nahi? Sentry ek doosri ASLI identity hai — apne keys, apni vault, apna ratchet — jo isi tab mein chalti hai. Ye demo bubble nahi hai; relay ko do alag users dikhte hain."
          />
          <Steps
            items={[
              { t: "Top bar → Sentry (ya signup screen par 'Boot Sentry node')", d: "Pehli baar ~10–20 sec lagega (24 one-time prekeys ban rahe hote hain)." },
              { t: "Auto-pair ho jayega", d: "App uska handle dhoondhta hai, bundle verify karta hai, aur DM room khol deta hai." },
              { t: "Baatein karo", d: "Sentry ko commands samajh aate hain: audit, verify, ratchet, burn, group, file, threat model, help." },
              { t: "Ledger dekho", d: "Inspector → Ledger: X3DH handshake, ratchet steps, receipts — sab live." },
            ]}
          />
          <Cmd label="Sentry se poochho">
{`help             → poori command list
audit            → live security posture (meri taraf se)
verify           → safety number / MITM check ka tarika
ratchet          → forward secrecy + post-compromise security kya hai
burn             → TTL / shred teen jagah kaise hota hai
threat model     → ye app kya-kya nahi bacha sakta (imaandaari se)
group            → sender keys kaise kaam karte hain`}
          </Cmd>

          {/* ---------------- 5 */}
          <H
            id="two"
            title="5 · Do log / do browser (asli test)"
            intro="Do alag browsers (ya ek normal + ek incognito) mein do alag handle banao. Ye sabse asli test hai: dono taraf encrypt/decrypt live dikhega."
          />
          <Steps
            items={[
              { t: "Browser A: handle 'ked' banao", d: "Signup ke baad Inspector → Identity → fingerprint copy karo." },
              { t: "Browser B: handle 'friend' banao", d: "Alag browser/incognito, taaki localStorage alag rahe." },
              { t: "B mein: New DM → 'ked'", d: "Bundle fetch hoga, signed prekey verify hoga, room derive hoga." },
              { t: "Donon taraf safety number milao", d: "Inspector → Session → 60 digits. Match hone par 'mark verified'." },
              { t: "30s TTL wala message bhejo", d: "Donon taraf bubble ke saath countdown ghoomega, phir 'burned' likha aayega aur relay par body NULL ho jayegi." },
            ]}
          />

          {/* ---------------- 6 */}
          <H id="features" title="6 · Saare features — ek-ek karke" />
          <div className="panel p-4">
            <Row k="1:1 chat — text, reply, edit, unsend (recall), reactions, read receipts, typing" v="✓" />
            <Row k="Auto-burn (TTL) — off / 30s / 2m / 15m / 1h / 1d, per room + per message" v="✓" />
            <Row k="Attachments — upload se pehle encrypt, SHA-256 check, image preview" v="≤ 2 MB" />
            <Row k="Groups — per-member sender chains, group re-key (PCS)" v="≤ 32 members" />
            <Row k="Search — decrypted local history ke andar (server ko pata bhi nahi chalega)" v="✓" />
            <Row k="Safety number (60 digits) + verified badge + 'require verified' hard mode" v="✓" />
            <Row k="Inspector — identity, session counters, ledger, devices, hardening" v="✓" />
            <Row k="Devices — list, revoke others, 30-day sessions, 6-strike lockout" v="✓" />
            <Row k="Key rotation — naya IK/SPK/OPK pool, safety number change" v="✓" />
            <Row k="Encrypted export (.enc.json) + panic wipe (⌘/Ctrl + .)" v="✓" />
            <Row k="Blur on focus loss, clipboard auto-clear (45s), no analytics" v="✓" />
            <Row k="Mobile responsive — rooms/chat toggle, neeche swipe-free layout" v="✓" />
            <Row k="Voice/video calls, push notifications" v="roadmap" />
          </div>

          {/* ---------------- 7 */}
          <H id="keys" title="7 · Keyboard shortcuts" />
          <div className="panel p-4">
            <Row k="Enter" v="send" />
            <Row k="Shift + Enter" v="nayi line" />
            <Row k="⌘ / Ctrl + B" v="Inspector toggle" />
            <Row k="⌘ / Ctrl + K" v="search / filter rooms" />
            <Row k="⌘ / Ctrl + ." v="panic wipe dialog" />
            <Row k="Esc" v="dialog band" />
          </div>

          {/* ---------------- 8 */}
          <H
            id="deploy-vercel"
            title="8 · Deploy: Vercel (sabse aasan)"
            intro="Vercel par Next.js bina config ke chalta hai. Sirf ek database chahiye — Neon free tier kaafi hai."
          />
          <Steps
            items={[
              { t: "Neon (ya koi bhi Postgres) par database banao", d: "console.neon.tech → New project → connection string copy karo (?sslmode=require ke saath)." },
              { t: "Repo push karo (GitHub/GitLab)", d: "git add . && git commit -m 'feat: deploy sher messenger' && git push" },
              { t: "vercel.com → Add New → Project → import", d: "Framework: Next.js (auto-detect). Build command chhoDo default." },
              { t: "Environment Variables daalo", d: "DATABASE_URL = postgres://…  (TURSO_URL/TURSO_TOKEN agar edge chahiye)" },
              { t: "Deploy", d: "Hari jhandi ke baad /api/health kholo: {\"ok\":true,…} dikhna chahiye." },
            ]}
          />
          <Cmd label="CLI wala tareeka">
{`npm i -g vercel
vercel link
vercel env add DATABASE_URL      # paste: postgres://user:pass@ep-xxx.neon.tech/db?sslmode=require
vercel --prod

curl https://<aapka-app>.vercel.app/api/health`}
          </Cmd>
          <div className="panel p-4 !border-[rgba(255,190,85,.35)]">
            <div className="row gap-2 text-[var(--warn)]">
              <Icon name="alert" size={15} />
              <span className="text-[13px] font-bold text-[var(--ink)]">Vercel par dhyan rakho</span>
            </div>
            <p className="mono mt-2 text-[11px] leading-relaxed text-[var(--ink-dim)]">
              Serverless functions cold-start par naya Postgres connection banate hain. Neon <b>pooled</b> connection string use karo
              (<code>-pooler</code> wala), warna 100+ connections ki limit jaldi khatam hogi. Bahut heavy traffic ho to Turso switch
              karo.
            </p>
          </div>

          {/* ---------------- 9 */}
          <H
            id="deploy-netlify"
            title="9 · Deploy: Netlify"
            intro="netlify.toml repo mein pehle se hai (build command + poora security headers block). Plugin Next.js ka dhyan rakhta hai."
          />
          <Cmd label="Netlify CLI">
{`npm i -g netlify-cli
netlify init                 # ya netlify sites:create
netlify env:set DATABASE_URL "postgres://…?sslmode=require"
netlify deploy --build --prod

# ya Netlify UI: Add new site → Import existing project → env vars → Deploy`}
          </Cmd>
          <Card title="Netlify pe kya alag hai" icon="cpu">
            <b>@netlify/plugin-nextjs</b> automatically lagta hai (netlify.toml mein declared). Edge Functions chahiye to DB ke liye
            Turso use karo — <code className="mono">pg</code> edge par nahi chalta.
          </Card>

          {/* ---------------- 10 */}
          <H
            id="deploy-cf"
            title="10 · Deploy: Cloudflare (Pages / Workers)"
            intro="Cloudflare par Node ka TCP nahi milta workerd mein, isliye do raaste hain: (a) OpenNext adapter jo node:pg ko worker mein chalata hai, ya (b) DB ke liye Turso/KV (pure HTTP) — ye sabse clean hai."
          />
          <Steps
            items={[
              { t: "Turso database banao", d: "turso.tech → create db → turso db show <db> se URL, turso db tokens create <db> se token." },
              { t: "OpenNext se build karo", d: "npx @opennextjs/cloudflare && npx wrangler deploy" },
              { t: "Secrets daalo (kabhi file mein mat likhna)", d: "wrangler secret put TURSO_TOKEN" },
              { t: "Custom domain + HTTPS", d: "Cloudflare DNS par proxy on (orange cloud) — TLS free." },
            ]}
          />
          <Cmd label="wrangler.toml">
{`name = "sher-messenger"
compatibility_date = "2026-06-01"
compatibility_flags = ["nodejs_compat"]      # node:crypto / node:sqlite ke liye
pages_build_output_dir = ".open-next/worker"

[vars]
SHER_DB = "turso"
TURSO_URL = "libsql://sher-messenger-<you>.turso.io"   # secret nahi, public hai
# TURSO_TOKEN = wrangler secret put TURSO_TOKEN`}
          </Cmd>
          <Cmd label="commands">
{`npm i -D @opennextjs/cloudflare wrangler
npx wrangler secret put TURSO_TOKEN
npx wrangler secret put DATABASE_URL       # optional, agar pg adapter use karna hai

npx @opennextjs/cloudflare build           # .open-next/ banata hai
npx wrangler deploy                        # worker live

# local test:
npx wrangler dev`}
          </Cmd>

          {/* ---------------- 11 */}
          <H
            id="deploy-vps"
            title="11 · Deploy: apna VPS / Docker"
            intro="Sabse sasta aur sabse private. Ek chhota VPS ($4–6) + SQLite file — kisi cloud DB ki zaroorat hi nahi."
          />
          <Steps
            items={[
              { t: "Docker install karo, repo clone karo" },
              { t: ".env banao (.env.example se)", d: "Sirf SHER_SQLITE_PATH=/data/sher-messenger.db — bas itna kaafi hai." },
              { t: "docker compose up -d", d: "Volume /data persist rehta hai, restart par data nahi jayega." },
              { t: "Caddy/Nginx se TLS lagao", d: "Caddy to automatically Let's Encrypt le leta hai. HTTP par mat chhodna — E2EE ke upar bhi TLS chahiye." },
            ]}
          />
          <Cmd label="Docker (repo mein Dockerfile + docker-compose.yml hai)">
{`git clone <aapka-repo> sher-messenger && cd sher-messenger
cp .env.example .env
printf 'SHER_SQLITE_PATH=/data/sher-messenger.db\\n' >> .env

docker compose up -d --build
docker compose logs -f ked

curl -s localhost:3000/api/health | jq .`}
          </Cmd>
          <Cmd label="Bina Docker (PM2)">
{`npm ci && npm run build
export SHER_SQLITE_PATH=/opt/ked/data/ked.db
pm2 start npm --name sher-messenger -- start
pm2 save && pm2 startup`}
          </Cmd>
          <Cmd label="Caddyfile (auto HTTPS)">
{`ked.aapka-domain.com {
  reverse_proxy localhost:3000
  header {
    Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "no-referrer"
    X-Frame-Options "DENY"
  }
}`}
          </Cmd>

          {/* ---------------- 11.5 one-click */}
          <div className="panel p-4">
            <div className="row mb-2 justify-between gap-3">
              <div className="kicker">sabse tez rasta — one-click deploy</div>
              <a className="btn btn-primary btn-sm" href="/deploy">
                <Icon name="bolt" size={12} /> Open deploy wizard
              </a>
            </div>
            <p className="mono mb-3 text-[11.5px] leading-relaxed text-[var(--ink-dim)]">
              Repo ko GitHub par fork karo, phir README ke top ke buttons se seedha deploy karo — Vercel, Netlify, Render,
              Railway, Cloudflare Workers sab supported hain. Sab free-tier par chalte hain, koi credit card nahi chahiye
              (Render/Railway par sirf verification ho sakti hai).
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                ["Vercel", "vercel.com/new"],
                ["Netlify", "app.netlify.com/start"],
                ["Render", "render.com/deploy"],
                ["Railway", "railway.app/new"],
                ["Cloudflare", "deploy.workers.cloudflare.com"],
              ].map(([name, host]) => (
                <span key={name} className="chip">
                  <Icon name="bolt" size={11} /> {name} · {host}
                </span>
              ))}
            </div>
          </div>

          {/* ---------------- 12 */}
          <H
            id="db"
            title="12 · Database kaise chunein"
            intro="Ek env variable badlo, baaki app wahi ka wahi. Client code mein ek line nahi badalti."
          />
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  {["Backend", "Kab chuno", "Env", "Edge?"].map((h) => (
                    <th key={h} className="kicker px-3 py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Neon / Postgres", "Production, Vercel/Netlify, free tier achha", "DATABASE_URL", "nahi"],
                  ["Supabase / RDS", " pehle se hai to", "DATABASE_URL", "nahi"],
                  ["Turso (libSQL)", "Cloudflare/Edge, ya low-latency global", "TURSO_URL + TURSO_TOKEN", "HAAN"],
                  ["SQLite file", "VPS/Docker/laptop — sabse simple", "SHER_SQLITE_PATH", "nahi"],
                  ["Memory", "Demo, CI, preview — restart par sab ud jayega", "SHER_DB=memory", "HAAN"],
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
          <Cmd label="chunav ka order (agar ek se zyada set hain)">
{`SHER_DB=postgres|turso|sqlite|memory   ← sabse upar, force karta hai
  phir SHER_SQLITE_PATH
  phir TURSO_URL (+ TURSO_TOKEN)
  phir DATABASE_URL (ya POSTGRES_URL / NEON_DATABASE_URL)
  phir MEMORY (default)`}
          </Cmd>
          <Card title="Drizzle se schema banana (optional)" icon="db" tone="warn">
            App khud bhi <code className="mono">CREATE TABLE IF NOT EXISTS</code> chala deta hai first boot par. Phir bhi agar aap
            Drizzle migrations chahte ho: <code className="mono">npx drizzle-kit push</code> (schema <code className="mono">src/db/schema.ts</code>{" "}
            mein hai).
          </Card>

          {/* ---------------- 13 */}
          <H id="faq" title="13 · FAQ / troubleshooting" />
          <div className="grid gap-3">
            <Card title="'username already taken'" icon="alert" tone="warn">
              Handle unique hai. Koi aur suffix chuno, ya <b>Unlock vault</b> tab se login karo agar ye aapki apni pehchaan hai.
            </Card>
            <Card title="'no vault blob on this device…'" icon="alert" tone="warn">
              Naye browser/device par pehli baar login kar rahe ho. Relay par encrypted mirror hota hai — login ke baad wahi utar
              aayega. Agar mirror bhi khali ho (panic wipe ke baad), to nayi identity hi banani padegi.
            </Card>
            <Card title="Passphrase bhool gaye" icon="alert" tone="warn">
              Sach: wapas nahi milega. Yahi design hai. Isliye signup par checkbox hai. Password manager rakho ya kagaz par likh kar
              locker mein.
            </Card>
            <Card title="Messages late aa rahe hain" icon="refresh">
              Polling 1.6 sec par hai. Header mein <b>sync Xs ago</b> dekho. Agar 8s se zyada ho to network/DB check karo. Vercel par
              cold start 1–2 sec ka ho sakta hai.
            </Card>
            <Card title="Attachment open nahi ho raha (HASH_MISMATCH)" icon="alert" tone="warn">
              File kharab hui ya beech mein badli gayi. Ye feature hai, bug nahi — decrypt karne se pehle SHA-256 check hota hai.
            </Card>
            <Card title="'blocked by your policy: verify the safety number'" icon="shield">
              Aapne Hardening mein <b>require verified</b> on kiya hai. Inspector → Session → safety number match karo → mark verified.
            </Card>
            <Card title="Account locked (15 min)" icon="lock" tone="warn">
              6 galat passphrase ke baad lock lagta hai (brute-force rokne ke liye). 15 min baad try karo, ya dusra device use karo.
            </Card>
            <Card title="'Unexpected token &lt;, &lt;!DOCTYPE... is not valid JSON'" icon="alert" tone="warn">
              Ye crypto bug nahi hai — iska matlab relay ne HTML error page bhej diya (DB thodi der ke liye so gaya, connection pool
              busy tha, ya deploy ka proxy galat route kar raha tha). Ab relay ki har request <b>guaranteed JSON</b> deti hai (chahe
              andar kuch bhi crash ho), aur app khud saaf message dikhata hai: &quot;relay storage is temporarily unavailable — please
              retry&quot;. Bas dubara try karo ya <code className="mono">/api/ked/health</code> kholo. Khud check karo:{" "}
              <code className="mono">/api/ked/__crash-test</code> jaan-boojh kar crash karta hai aur fir bhi JSON deta hai.
            </Card>
            <Card title="Do devices par same account" icon="cpu">
              Dono par login karo — dono ko wahi encrypted mirror milega aur dono sync karenge. Private keys kabhi share nahi hote;
              har device apni taraf se ratchet chalata hai.
            </Card>
            <Card title="Kya server wala padh sakta hai?" icon="key">
              Nahi. Khud verify kar lo: <code className="mono">/api/dev-selftest?relay=1</code> kholo — usme check hai
              <b> stored body is not plaintext</b>.
            </Card>
          </div>

          {/* ---------------- 14 invites + admin */}
          <H
            id="invite"
            title="14 · Invite system + Admin panel"
            intro="Ye private messenger hai, public signup form nahi. Default ON hai: bina valid invite koi identity nahi ban sakta."
          />
          <Steps
            items={[
              { t: "Pehla admin banao (ek baar)", d: "SHER_INVITE_ONLY=0 karke apni identity banao → phir API se admin invite mint karo (command niche) → wapas SHER_INVITE_ONLY=1." },
              { t: "/admin kholo", d: "Bearer token paste karo (ya app mein login rehte hue 'Admin' button dabao). RBAC relay par check hota hai — sirf UI par nahi." },
              { t: "Invites tab → create", d: "Label, role (member/admin), max uses, expiry days. Raw code SIRF EK BAAR dikhega, kyunki relay par sirf SHA-256(code) store hota hai." },
              { t: "Link share karo", d: "https://aapka-app/?invite=CODE  — kholne par signup screen khud invite detect kar legi." },
              { t: "Users tab se manage karo", d: "block (sessions revoke), unblock, promote/demote, purge (crypto-shred). Purge audit log mein jata hai." },
              { t: "Broadcast tab", d: "SYSTEM NOTICE sab users ko. Ye plaintext hai — clearly flagged, isliye sensitive content kabhi nahi." },
            ]}
          />
          <Cmd label="pehla admin invite mint karna">
{`# 1. bootstrap window
SHER_INVITE_ONLY=0 npm start          # UI se apna handle banao, phir band karo

# 2. apne token se admin invite banao
curl -s localhost:3000/api/ked/admin/invites \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{"create":true,"role":"admin","maxUses":3,"expiresInDays":30,"label":"bootstrap"}'
# → {"ok":true,"code":"<32 hex>","role":"admin",...}

# 3. gate wapas on
SHER_INVITE_ONLY=1 npm start`}
          </Cmd>
          <Card title="Admin kya dekh sakta hai, kya NAHI" icon="shield">
            <b>Dekh sakta hai:</b> handles, roles, blocked state, session count, OPK pool, room graph, message sizes,
            timestamps, invite usage, audit event classes.
            <br />
            <b>NAHI dekh sakta:</b> message content, private keys, passphrase, aapka contact list, aapka profile
            (ye sab vault-encrypted hai). Admin panel mein message-read path <i>hai hi nahi</i> — sirf counters aur
            state changes.
          </Card>

          {/* ---------------- 15 self check */}
          <H
            id="check"
            title="15 · Self-check (hand-off gate)"
            intro="Har claim ke aage uska proof. Koi bhi item fail ho to ship mat karo."
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
            <p className="mono mt-3 text-[10px] leading-relaxed text-[var(--ink-faint)]">
              Ye table code ke saath live hai — kahin bhi &quot;commit kiya, kaam ho gaya&quot; wala jhooth nahi chal sakta,
              kyunki conformance suite ko chala kar har check verify kiya ja sakta hai.
            </p>
          </div>

          <div className="panel p-4">
            <div className="kicker mb-2">aapka relay abhi</div>
            <KV k="adapter" v={String(stats?.adapter ?? "—")} />
            <KV k="accounts" v={String(stats?.users ?? "—")} />
            <KV k="ciphertext rows" v={String(stats?.ciphertextRows ?? "—")} tone="good" />
            <KV k="plaintext rows" v={String(stats?.plaintextRowsOnServer ?? "—")} tone="good" />
          </div>

          <div className="row flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-5">
            <div className="row flex-wrap gap-1.5">
              <a className="btn btn-primary" href="/">
                <Icon name="lock" size={14} /> App kholo
              </a>
              <a className="btn btn-sm" href="/privacy">
                Privacy
              </a>
              <a className="btn btn-sm" href="/terms">
                Terms
              </a>
              <a className="btn btn-sm" href="/admin">
                <Icon name="shield" size={12} /> Admin
              </a>
            </div>
            <Copyable value={`curl -s ${typeof location !== "undefined" ? location.origin : ""}/api/dev-selftest?relay=1 | jq .passed`} label="conformance check command copy karo" />
          </div>
        </main>
      </div>
    </div>
  );
}
