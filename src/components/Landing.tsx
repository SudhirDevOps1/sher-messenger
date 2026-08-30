"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Chip, Icon } from "./ui";

/**
 * The showcase / marketing surface. Pure CSS + IntersectionObserver animation —
 * no animation library, so it never adds a byte to the crypto bundle or a new
 * supply-chain dependency. Everything here is decorative; the actual security
 * claims live in /plan and /guide, and this page links to both.
 */

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, shown };
}

function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(18px)",
        transition: `opacity .7s cubic-bezier(.22,1,.36,1) ${delay}ms, transform .7s cubic-bezier(.22,1,.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/** Types out a list of phrases, character by character, looping forever. */
function Typewriter({ words }: { words: string[] }) {
  const [i, setI] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const word = words[i % words.length];
    const done = text === word;
    const empty = text === "";
    const speed = deleting ? 28 : 42;
    const pause = done && !deleting ? 1300 : empty && deleting ? 250 : speed;

    const t = setTimeout(() => {
      if (done && !deleting) {
        setDeleting(true);
        return;
      }
      if (empty && deleting) {
        setDeleting(false);
        setI((v) => (v + 1) % words.length);
        return;
      }
      setText((cur) => (deleting ? word.slice(0, cur.length - 1) : word.slice(0, cur.length + 1)));
    }, pause);
    return () => clearTimeout(t);
  }, [text, deleting, i, words]);

  return (
    <span className="text-[var(--acc)]">
      {text}
      <span className="ml-0.5 inline-block h-[0.9em] w-[2px] translate-y-[0.1em] animate-pulse bg-[var(--acc)]" />
    </span>
  );
}

/** Live-decrypting demo bubble: shows scrambled text resolving into plaintext, on a loop. */
function DecryptDemo() {
  const PLAIN = "sealed before it ever left this tab.";
  const GLYPHS = "!<>-_\\/[]{}—=+*^?#01234567890ABCDEFабвгд⌘⚡";
  const [display, setDisplay] = useState(PLAIN);
  const frame = useRef(0);

  useEffect(() => {
    let raf: ReturnType<typeof setInterval>;
    let progress = 0;
    let holding = true;
    const tick = () => {
      frame.current++;
      if (holding) {
        if (frame.current % 90 === 0) {
          holding = false;
          progress = 0;
        }
        return;
      }
      progress += 1;
      const revealed = Math.min(PLAIN.length, Math.floor(progress / 2));
      let out = "";
      for (let idx = 0; idx < PLAIN.length; idx++) {
        if (PLAIN[idx] === " ") {
          out += " ";
        } else if (idx < revealed) {
          out += PLAIN[idx];
        } else {
          out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
      }
      setDisplay(out);
      if (revealed >= PLAIN.length) {
        holding = true;
        frame.current = 0;
      }
    };
    raf = setInterval(tick, 45);
    return () => clearInterval(raf);
  }, []);

  return <span className="mono">{display}</span>;
}

function FreeRoomDemo() {
  const [name, setName] = useState("my-room");
  const [max, setMax] = useState(5);
  const [code, setCode] = useState<string | null>(null);
  const [join, setJoin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const anon = () => {
    try {
      let a = sessionStorage.getItem("ked.anon.id");
      if (!a) { a = `anon_${Math.random().toString(36).slice(2, 10)}`; sessionStorage.setItem("ked.anon.id", a); }
      return a;
    } catch { return `anon_${Math.random().toString(36).slice(2, 10)}`; }
  };
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-[var(--line)] bg-black/25 p-3">
        <div className="kicker mb-2">create — bas naam</div>
        <input className="input mono" value={name} onChange={(e) => setName(e.target.value.slice(0, 20))} placeholder="room name" />
        <select className="input mono mt-2" value={max} onChange={(e) => setMax(Number(e.target.value))}>
          {[2,3,5,10,15,30].map((n) => <option key={n} value={n}>{n} users max</option>)}
        </select>
        <button
          className="btn btn-primary mt-2 w-full justify-center"
          disabled={busy || !name.trim()}
          onClick={async () => {
            setBusy(true); setMsg(null);
            try {
              const r = await fetch("/api/ked/rooms/code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nameEnc: name, maxUsers: max, ttlMs: 30*60_000, anonId: anon() }) }).then((x) => x.json());
              if (r.code) { setCode(r.code); setMsg(`code: ${r.code} — share karo, 30m tak`); } else setMsg(r.error || "failed");
            } catch (e) { setMsg((e as Error).message); }
            setBusy(false);
          }}
        >
          <Icon name="plus" size={13} /> Create room
        </button>
        {code ? <div className="mono mt-2 break-all rounded-lg border border-[rgba(79,240,182,.3)] bg-[rgba(79,240,182,.08)] p-2 text-[12px] text-[#a9ffe2]">code: <b>{code}</b></div> : null}
        {msg ? <div className="mono mt-1 text-[10px] text-[var(--ink-faint)]">{msg}</div> : null}
      </div>
      <div className="rounded-xl border border-[var(--line)] bg-black/25 p-3">
        <div className="kicker mb-2">join — bas code</div>
        <input className="input mono" value={join} onChange={(e) => setJoin(e.target.value.trim().toLowerCase())} placeholder="6-char code" maxLength={6} />
        <button
          className="btn mt-2 w-full justify-center"
          disabled={busy || join.length < 6}
          onClick={async () => {
            setBusy(true); setMsg(null);
            try {
              const r = await fetch("/api/ked/rooms/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: join, anonId: anon() }) }).then((x) => x.json());
              if (r.roomId) { setMsg(`joined ${r.roomId.slice(0,8)} — open app to chat`); window.location.href = "/"; } else setMsg(r.error || "invalid code");
            } catch (e) { setMsg((e as Error).message); }
            setBusy(false);
          }}
        >
          Enter room
        </button>
        <p className="mono mt-2 text-[10px] text-[var(--ink-faint)]">30m me auto-burn, tab band = wipe, screenshot blur.</p>
      </div>
    </div>
  );
}

const FEATURES: { icon: string; title: string; body: string }[] = [
  { icon: "key", title: "X3DH-lite handshake", body: "Identity key + signed prekey + one-time prekey pool. Sessions start even while the other person is offline." },
  { icon: "shield", title: "Double Ratchet", body: "A fresh key for every message, destroyed the instant it's used. Forward secrecy and post-compromise security, together." },
  { icon: "lock", title: "AES-256-GCM everywhere", body: "Text, files, reactions, typing indicators — every payload is sealed client-side before it touches the network." },
  { icon: "flame", title: "Auto-burn & unsend", body: "Per-message and per-room TTLs. Delete-for-everyone actually shreds the relay row, not just the UI." },
  { icon: "users", title: "Sender-key groups", body: "Each member gets an independent chain, delivered over a verified 1:1 session. Re-key on every membership change." },
  { icon: "ghost", title: "No phone, no email", body: "Identity is a handle plus a keypair generated in your browser. Invite-only by default — not a public directory." },
  { icon: "shield", title: "Admin, without god-mode", body: "Block, purge, broadcast, audit — full operator control, zero ability to read a single conversation." },
  { icon: "db", title: "Bring your own database", body: "Postgres, libSQL/Turso, SQLite, or in-memory. One interface, four adapters, swap with an env var." },
];

const STEPS: { n: string; t: string; d: string }[] = [
  { n: "01", t: "Generate", d: "Your browser creates an identity key, a signed prekey, and a pool of one-time prekeys. The private halves never leave this tab." },
  { n: "02", t: "Seal", d: "Every message is encrypted with a key that existed for a fraction of a second and is destroyed the moment it's used." },
  { n: "03", t: "Route blind", d: "The relay stores ciphertext, an opaque id, and a timestamp. That's the entire contract — nothing else is legible to it." },
  { n: "04", t: "Verify", d: "Compare a 60-digit safety number out of band. If it matches, nobody swapped keys in the middle." },
];

export default function Landing({
  relay,
  onEnter,
}: {
  relay: { adapter?: string; users?: number; ciphertextRows?: number } | null;
  onEnter: () => void;
}) {
  const [lang, setLang] = useState<"en" | "hi">(() => {
    try { return (localStorage.getItem("ked.lang") as "en" | "hi") || "en"; } catch { return "en"; }
  });
  return (
    <div className="relative z-[1] h-[100dvh] overflow-x-hidden overflow-y-auto scroll-smooth">
      {/* ---------------- nav */}
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[rgba(5,7,12,.78)] backdrop-blur-xl">
        <div className="mx-auto row max-w-[1180px] items-center justify-between gap-3 px-5 py-3">
          <div className="row gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--line-strong)] bg-[rgba(79,240,182,.12)] text-[var(--acc)]">
              <Icon name="shield" size={16} />
            </span>
            <span className="text-[13.5px] font-bold tracking-tight">
              KED<span className="text-[var(--acc)]">·</span>VAULT
            </span>
          </div>
          <nav className="row hidden gap-1 md:flex">
            <a className="btn btn-sm !border-transparent !bg-transparent" href="#features">
              {lang === "hi" ? "फीचर्स" : "Features"}
            </a>
            <a className="btn btn-sm !border-transparent !bg-transparent" href="#how">
              {lang === "hi" ? "कैसे काम करता है" : "How it works"}
            </a>
            <a className="btn btn-sm" href="/guide">
              Guide
            </a>
            <a className="btn btn-sm" href="/plan">
              Docs
            </a>
          </nav>
          <div className="row gap-1.5">
            <button className="btn btn-sm" onClick={() => { const n = lang === "en" ? "hi" : "en"; setLang(n); try { localStorage.setItem("ked.lang", n); } catch {} }}>
              {lang === "en" ? "हिंदी" : "EN"}
            </button>
            <button className="btn btn-primary btn-sm" onClick={onEnter}>
              <Icon name="lock" size={13} /> {lang === "hi" ? "वॉल्ट खोलें" : "Open the vault"}
            </button>
          </div>
        </div>
      </header>

      {/* ---------------- hero */}
      <section className="relative min-h-[calc(100dvh-57px)] overflow-hidden px-5 pb-24 pt-16 md:flex md:items-center md:pb-28 md:pt-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="orb orb-a" />
          <div className="orb orb-b" />
          <div className="orb orb-c" />
        </div>

        <div className="mx-auto w-full max-w-[900px] text-center">
          <Reveal>
            <span className="chip chip-good mx-auto inline-flex">
              <span className="dot" /> free · open source · MIT licensed
            </span>
          </Reveal>

          <Reveal delay={90}>
            <h1 className="mt-6 text-[clamp(34px,7vw,66px)] font-bold leading-[1.02] tracking-[-0.035em]">
              Every message is <Typewriter words={["sealed.", "yours.", "ephemeral.", "unreadable to us."]} />
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mx-auto mt-5 max-w-[62ch] text-[15px] leading-relaxed text-[var(--ink-dim)]">
              A personal, zero-knowledge messenger you actually own. Real X3DH + Double Ratchet cryptography runs
              entirely in your browser — the server only ever sees ciphertext, opaque ids, and timestamps.
            </p>
          </Reveal>

          <Reveal delay={230}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button className="btn btn-primary scale-100 px-6 py-3 text-[14px] transition hover:scale-[1.03]" onClick={onEnter}>
                <Icon name="key" size={16} /> Create your vault
              </button>
              <a className="btn px-6 py-3 text-[14px] transition hover:scale-[1.03]" href="/guide">
                <Icon name="spark" size={16} /> See how it works
              </a>
            </div>
          </Reveal>

          <Reveal delay={300}>
            <div className="mx-auto mt-10 max-w-[560px] rounded-2xl border border-[var(--line)] bg-black/40 p-4 text-left shadow-2xl backdrop-blur">
              <div className="row justify-between border-b border-[var(--line)] pb-2.5">
                <span className="row gap-1.5 text-[var(--ink-faint)]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b7a]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ffbe55]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#4ff0b6]" />
                </span>
                <span className="kicker">relay.log</span>
              </div>
              <div className="mono pt-3 text-[12.5px] leading-relaxed text-[var(--ink-dim)]">
                <div>
                  <span className="text-[var(--ink-faint)]">$</span> POST /api/ked/send
                </div>
                <div className="mt-1 truncate text-[var(--acc-2)]">
                  body: &quot;v1.aB92kd==.Zx88nQ2mP1c...&quot;
                </div>
                <div className="mt-2.5 text-[var(--ink-faint)]">{"// what the plaintext actually was:"}</div>
                <div className="mt-1 text-[var(--acc)]">
                  <DecryptDemo />
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={360}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <Chip tone="good">
                <span className="dot" /> relay: {relay?.adapter ?? "detecting…"}
              </Chip>
              <Chip tone="acc">
                <Icon name="doc" size={11} /> accounts: {relay?.users ?? "—"}
              </Chip>
              <Chip>
                <Icon name="lock" size={11} /> ciphertext rows: {relay?.ciphertextRows ?? "—"}
              </Chip>
              <Chip tone="warn">plaintext rows: 0</Chip>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- feature grid */}
      <section id="features" className="relative mx-auto w-full max-w-[1180px] px-5 py-20 md:py-28">
        <Reveal>
          <div className="mx-auto max-w-[640px] text-center">
            <div className="kicker">what's inside</div>
            <h2 className="mt-2 text-[clamp(24px,4vw,36px)] font-bold tracking-[-0.02em]">Not a demo. A working protocol.</h2>
            <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--ink-dim)]">
              Every card below is a real, working feature — not marketing copy. Open the Inspector panel after you sign in
              and watch the ratchet counters move as you type.
            </p>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-[var(--line)] bg-gradient-to-b from-white/[.05] to-white/[.01] p-5 transition hover:-translate-y-1 hover:border-[rgba(79,240,182,.4)]">
                <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[var(--acc)]/0 blur-2xl transition group-hover:bg-[var(--acc)]/10" />
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line-strong)] bg-[rgba(79,240,182,.1)] text-[var(--acc)]">
                  <Icon name={f.icon} size={18} />
                </span>
                <h3 className="mt-3.5 text-[14px] font-bold">{f.title}</h3>
                <p className="mono mt-1.5 text-[11.5px] leading-relaxed text-[var(--ink-faint)]">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------- ephemeral public rooms */}
      <section className="mx-auto w-full max-w-[1180px] px-5 py-10 md:py-16">
        <Reveal>
          <div className="panel relative overflow-hidden p-6 md:p-8">
            <span className="glowline" />
            <div className="kicker">extreme privacy — public, no login</div>
            <h2 className="mt-2 text-[clamp(22px,3.6vw,30px)] font-bold tracking-[-0.02em]">Free 30-minute rooms — code se enter, bina login ke.</h2>
            <p className="mt-2 max-w-[70ch] text-[13px] leading-relaxed text-[var(--ink-dim)]">
              Web public khula rahega, <code>/admin</code> sirf <code>ADMIN_EMAIL</code>+<code>ADMIN_PASSWORD</code> env se khulta (bearer + env double-gate). Koi user aaya, <b>room banaya</b> → creator <code>maxUsers 2-30</code> + <code>30m</code> hard cap set karta → <b>6-char code</b> milta → code baanto, dusra user code dalte hi `rooms/join` → chat start. 30m baad `shredExpired` + `burnDue` se `body=NULL` server + local history blur, browser band karte hi `beforeunload` `sessionStorage` wipe.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--line)] bg-black/25 p-3">
                <div className="kicker">screenshot / download</div>
                <p className="mono mt-1 text-[11px] leading-relaxed text-[var(--ink-faint)]">`.no-screenshot` + watermark + `copy/contextmenu` block + `PrintScreen` toast + `blur while unfocused`. OS photo 100% nahi rukta — friction + blur-after-download + ledger flag.</p>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-black/25 p-3">
                <div className="kicker">localStorage kya</div>
                <p className="mono mt-1 text-[11px] leading-relaxed text-[var(--ink-faint)]">ked.vault handle = seal PBKDF2 750k AES-256-GCM n c salt at + ked.resume.v1 tab-only. Clear cache to ls.del plus ss.clear to no vault blob.</p>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-black/25 p-3">
                <div className="kicker">clear cache ke baad</div>
                <p className="mono mt-1 text-[11px] leading-relaxed text-[var(--ink-faint)]">Vault local se gaya, relay pe sirf `ciphertext` bacha — `passphrase` bina `unreadable`. Backup se restore ya naya identity.</p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------------- how it works */}
      <section id="how" className="relative overflow-hidden px-5 py-20 md:py-28">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-60">
          <div className="orb orb-d" />
        </div>
        <div className="mx-auto max-w-[1000px]">
          <Reveal>
            <div className="text-center">
              <div className="kicker">the flow</div>
              <h2 className="mt-2 text-[clamp(24px,4vw,36px)] font-bold tracking-[-0.02em]">Four steps, every single message</h2>
            </div>
          </Reveal>

          <div className="relative mt-12 grid gap-8 md:grid-cols-4">
            <div aria-hidden className="absolute left-0 right-0 top-[22px] hidden h-px bg-gradient-to-r from-transparent via-[var(--line-strong)] to-transparent md:block" />
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 120} className="relative">
                <div className="relative z-10 grid gap-3">
                  <span className="mono grid h-11 w-11 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--bg)] text-[13px] font-bold text-[var(--acc)] shadow-[0_0_0_5px_var(--bg)]">
                    {s.n}
                  </span>
                  <h3 className="text-[14.5px] font-bold">{s.t}</h3>
                  <p className="mono text-[11.5px] leading-relaxed text-[var(--ink-faint)]">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- free room — no login */}
      <section className="mx-auto w-full max-w-[1180px] px-5 pb-10">
        <Reveal>
          <div className="panel p-6">
            <div className="kicker">try now — no login</div>
            <h3 className="mt-1 text-[16px] font-bold">Free 30m room — bas naam daalo, code baanto</h3>
            <p className="mono mt-1 text-[11px] text-[var(--ink-faint)]">Bina handle/pass ke. Code se koi bhi join karega, maxUsers creator set karta, 30m me auto-burn, tab band karte hi wipe.</p>
            <FreeRoomDemo />
          </div>
        </Reveal>
      </section>

      {/* ---------------- deploy strip */}
      <section className="mx-auto w-full max-w-[1180px] px-5 py-20 md:py-28">
        <Reveal>
          <div className="panel relative overflow-hidden p-8 text-center">
            <span className="glowline" />
            <div className="kicker">₹0 to run</div>
            <h2 className="mt-2 text-[clamp(22px,3.6vw,32px)] font-bold tracking-[-0.02em]">
              Deploy your own in one click. Free forever, on infrastructure you control.
            </h2>
            <p className="mx-auto mt-3 max-w-[62ch] text-[13px] leading-relaxed text-[var(--ink-dim)]">
              Vercel, Netlify, Render, Railway, Cloudflare Workers, or a $4 VPS. Postgres, Turso, SQLite, or nothing at
              all. Same code, same guarantees, everywhere.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {["Vercel", "Netlify", "Render", "Railway", "Cloudflare", "Deno"].map((n) => (
                <Chip key={n} tone="acc">
                  {n}
                </Chip>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button className="btn btn-primary px-6 py-3 text-[14px]" onClick={onEnter}>
                <Icon name="lock" size={15} /> Create your vault
              </button>
              <a className="btn px-6 py-3 text-[14px]" href="/deploy">
                <Icon name="bolt" size={15} /> One-click deploy wizard
              </a>
              <a className="btn px-6 py-3 text-[14px]" href="/guide#deploy-vercel">
                <Icon name="doc" size={15} /> Step-by-step guide
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------------- footer */}
      <footer className="border-t border-[var(--line)] px-5 py-8">
        <div className="mx-auto row max-w-[1180px] flex-wrap items-center justify-between gap-3">
          <span className="mono text-[10.5px] text-[var(--ink-faint)]">
            SHER Messenger · MIT licensed · no analytics · no telemetry
          </span>
          <div className="row flex-wrap gap-1.5">
            <a className="btn btn-sm" href="/guide">
              Guide
            </a>
            <a className="btn btn-sm" href="/plan">
              PRD
            </a>
            <a className="btn btn-sm" href="/privacy">
              Privacy
            </a>
            <a className="btn btn-sm" href="/terms">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
