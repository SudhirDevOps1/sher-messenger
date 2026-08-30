"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Chip, Icon, Modal } from "./ui";
import { useI18n, type Lang } from "@/lib/i18n";
import { KedClient } from "@/lib/client";

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

function FreeRoomDemo({ onEnterGuest }: { onEnterGuest?: (client: KedClient) => void }) {
  const { lang, t } = useI18n();
  const [createName, setCreateName] = useState("");
  const [createUserName, setCreateUserName] = useState("");
  const [maxUsers, setMaxUsers] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [hardcore, setHardcore] = useState(true);
  const [createdResult, setCreatedResult] = useState<{ code: string; link: string; client: KedClient } | null>(null);
  
  const [joinCode, setJoinCode] = useState("");
  const [joinUserName, setJoinUserName] = useState("");
  const [joinKey, setJoinKey] = useState("");
  
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await KedClient.createGuestRoom({
        displayName: createUserName.trim() || (lang === "hi" ? "अतिथि" : "Guest"),
        roomName: createName.trim() || (lang === "hi" ? "अस्थायी चैट" : "Ephemeral Room"),
        maxUsers,
        ttlMs: durationMinutes * 60_000,
        hardcore,
      });
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const directLink = `${origin}/?room=${res.code}${res.key ? `#k=${res.key}` : ""}`;
      setCreatedResult({ code: res.code, link: directLink, client: res.client });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    let code = joinCode.trim();
    let key = joinKey.trim();

    // Support pasting full link
    if (code.includes("/?room=") || code.includes("/r/")) {
      try {
        const u = new URL(code);
        code = u.searchParams.get("room") || u.pathname.split("/").pop() || "";
        if (u.hash.includes("k=")) {
          key = u.hash.replace("#k=", "");
        }
      } catch {}
    }

    if (!code || code.length < 6) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await KedClient.joinGuestRoom({
        displayName: joinUserName.trim() || (lang === "hi" ? "सहभागी" : "Member"),
        code: code.toLowerCase(),
        key,
      });
      if (onEnterGuest) {
        onEnterGuest(res.client);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      {/* Create ephemeral room */}
      <div className="panel relative p-5">
        <span className="glowline" />
        <div className="row gap-2 text-[var(--acc)]">
          <Icon name="plus" size={17} />
          <span className="text-[14px] font-bold text-[var(--ink)]">{t("createRoomTitle")}</span>
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--ink-dim)]">
          {t("createRoomDesc")}
        </p>

        {createdResult ? (
          <div className="mt-4 space-y-3 rounded-xl border border-[rgba(79,240,182,.4)] bg-[rgba(79,240,182,.08)] p-4">
            <div className="text-xs font-bold text-[#a9ffe2]">
              {lang === "hi" ? "🎉 रूम तैयार है! लिंक या कोड शेयर करें:" : "🎉 Room created! Share the link or code:"}
            </div>

            <div className="row items-center justify-between gap-2 rounded-lg bg-black/40 p-2.5">
              <span className="mono text-sm font-bold text-[var(--acc)]">{createdResult.code.toUpperCase()}</span>
              <button
                className="btn btn-sm"
                onClick={() => {
                  void navigator.clipboard.writeText(createdResult.link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                <Icon name="copy" size={12} /> {copied ? (lang === "hi" ? "कॉपी हुआ!" : "Copied!") : (lang === "hi" ? "लिंक कॉपी करें" : "Copy Link")}
              </button>
            </div>

            <button
              className="btn btn-primary w-full py-2 font-bold justify-center"
              onClick={() => onEnterGuest && onEnterGuest(createdResult.client)}
            >
              {lang === "hi" ? "रूम में प्रवेश करें ➔" : "Enter Room Now ➔"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreateRoom} className="mt-4 grid gap-2.5">
            <div>
              <label className="kicker mb-1 block">{t("displayName")}</label>
              <input
                className="input"
                value={createUserName}
                onChange={(e) => setCreateUserName(e.target.value.slice(0, 24))}
                placeholder={lang === "hi" ? "उदा. अमन" : "e.g. Alex"}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="kicker mb-1 block">{t("roomCapacity")}</label>
                <select
                  className="input"
                  value={maxUsers}
                  onChange={(e) => setMaxUsers(Number(e.target.value))}
                >
                  {[2, 3, 5, 10, 15, 20, 30].map((n) => (
                    <option key={n} value={n}>
                      {n} {t("usersCount")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="kicker mb-1 block">{t("roomDuration")}</label>
                <select
                  className="input"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                >
                  {[5, 10, 15, 30, 60].map((m) => (
                    <option key={m} value={m}>
                      {m} {lang === "hi" ? "मिनट" : "Minutes"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="row items-center gap-2 mt-1">
              <input
                type="checkbox"
                id="hardcore"
                checked={hardcore}
                onChange={(e) => setHardcore(e.target.checked)}
                className="rounded border-[var(--line)]"
              />
              <label htmlFor="hardcore" className="text-xs text-[var(--ink-dim)] cursor-pointer">
                <b>Hardcore E2EE</b> ({lang === "hi" ? "256-बिट लिंक फ्रैगमेंट एन्क्रिप्शन" : "256-bit link fragment key"})
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary mt-2 justify-center py-2.5"
              disabled={busy || !createUserName.trim()}
            >
              <Icon name="plus" size={14} /> {busy ? "Creating..." : t("createRoomBtn")}
            </button>
          </form>
        )}
      </div>

      {/* Join ephemeral room */}
      <div className="panel relative p-5">
        <span className="glowline" />
        <div className="row gap-2 text-[var(--acc-2)]">
          <Icon name="key" size={17} />
          <span className="text-[14px] font-bold text-[var(--ink)]">{t("joinRoomTitle")}</span>
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--ink-dim)]">
          {t("joinRoomDesc")}
        </p>

        <form onSubmit={handleJoinRoom} className="mt-4 grid gap-2.5">
          <div>
            <label className="kicker mb-1 block">{t("displayName")}</label>
            <input
              className="input"
              value={joinUserName}
              onChange={(e) => setJoinUserName(e.target.value.slice(0, 24))}
              placeholder={lang === "hi" ? "उदा. राहुल" : "e.g. Sam"}
              required
            />
          </div>

          <div>
            <label className="kicker mb-1 block">{t("roomCode")} / Direct Link</label>
            <input
              className="input mono tracking-wider font-semibold"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.trim())}
              placeholder="e.g. a7f2k9 or https://..."
              required
            />
          </div>

          <button
            type="submit"
            className="btn mt-2 justify-center py-2.5"
            disabled={busy || joinCode.length < 6 || !joinUserName.trim()}
          >
            <Icon name="chevron" size={14} /> {busy ? "Joining..." : t("joinRoomBtn")}
          </button>

          {err ? (
            <div className="mono mt-2 text-[11px] text-[#ffc2c9]">
              {err}
            </div>
          ) : null}
        </form>
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
  onEnterGuest,
}: {
  relay: { adapter?: string; users?: number; ciphertextRows?: number } | null;
  onEnter: () => void;
  onEnterGuest?: (client: KedClient) => void;
}) {
  const { lang, setLang, t } = useI18n();
  const [contactModal, setContactModal] = useState(false);
  const contactFormAction = process.env.NEXT_PUBLIC_CONTACT_FORM_ACTION || "";
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
            <div className="kicker">{lang === "hi" ? "बिना लॉगिन तुरंत शुरू करें" : "Instant Ephemeral Chat — No Sign Up"}</div>
            <h3 className="mt-1 text-[18px] font-bold">{lang === "hi" ? "अस्थायी चैट रूम — कोड साझा करें और 30 मिनट तक सुरक्षित बात करें" : "Zero-Login Ephemeral Rooms — Share code and chat securely"}</h3>
            <p className="mt-1 text-[12.5px] text-[var(--ink-dim)]">
              {lang === "hi"
                ? "कोई ईमेल या पासवर्ड की आवश्यकता नहीं। रूम क्रिएटर समय और सदस्यों की सीमा तय कर सकता है। ब्राउज़र बंद करते ही सभी डेटा समाप्त।"
                : "No email or password required. End-to-end encrypted in memory with automatic shredding on timer expiry or browser exit."}
            </p>
            <FreeRoomDemo onEnterGuest={onEnterGuest} />
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
            <button className="btn btn-sm" onClick={() => setContactModal(true)}>
              {lang === "hi" ? "फीडबैक" : "Feedback"}
            </button>
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

      {/* Contact & Feedback Modal */}
      <Modal open={contactModal} onClose={() => setContactModal(false)} title={lang === "hi" ? "संपर्क व फीडबैक" : "Contact & Feedback"} icon="spark">
        <form
          method="POST"
          action={contactFormAction || "#"}
          onSubmit={(e) => {
            if (!contactFormAction) {
              e.preventDefault();
              alert(lang === "hi" ? "व्यवस्थापक द्वारा फीडबैक एंडपॉइंट कॉन्फ़िगर नहीं है।" : "Contact form endpoint is not configured by the deployer.");
            }
          }}
          className="grid gap-3"
        >
          <p className="text-[12.5px] leading-relaxed text-[var(--ink-dim)]">
            {lang === "hi"
              ? "आपके सुझाव और संदेश सीधे व्यवस्थापक को सुरक्षित रूप से भेजे जाते हैं।"
              : "Send your feedback, feature requests, or bug reports directly to the deployer."}
          </p>
          <div>
            <label className="kicker mb-1 block">{lang === "hi" ? "आपका ईमेल" : "Your Email"}</label>
            <input name="email" type="email" required placeholder="you@example.com" className="input" />
          </div>
          <div>
            <label className="kicker mb-1 block">{lang === "hi" ? "संदेश" : "Message"}</label>
            <textarea name="message" required placeholder={lang === "hi" ? "अपना संदेश यहाँ लिखें..." : "Type your message or question here..."} className="input min-h-[100px]" />
          </div>
          {/* Honeypot field */}
          <input name="website" tabIndex={-1} autoComplete="off" style={{ display: "none" }} />
          <div className="row justify-end gap-2 mt-2">
            <button type="button" className="btn" onClick={() => setContactModal(false)}>
              {lang === "hi" ? "रद्द करें" : "Cancel"}
            </button>
            <button type="submit" className="btn btn-primary">
              {lang === "hi" ? "भेजें" : "Send Feedback"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
