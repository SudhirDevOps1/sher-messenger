"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/* ------------------------------------------------------------------ icons */

const P = (d: string) => <path d={d} />;

const ICONS: Record<string, ReactNode> = {
  shield: P("M12 3l7 3v5.5c0 4.2-2.9 7.7-7 8.5-4.1-.8-7-4.3-7-8.5V6l7-3z"),
  lock: (
    <>
      {P("M6 11h12v9H6z")}
      {P("M9 11V8a3 3 0 016 0v3")}
    </>
  ),
  key: (
    <>
      {P("M14 7a4 4 0 103.5 5.9L21 15l-2 2-1.6-1.6-1.5 1.5-2-2L4 21H3v-3l6.1-5.9-2-2 1.5-1.5L7 7l2-2 2 2z")}
      {P("M15 9.2h.01")}
    </>
  ),
  flame: P("M12 3s5 4 5 8a5 5 0 01-10 0c0-2 1-3 1-3s0 2 1.5 2S12 8 12 3z"),
  ghost: (
    <>
      {P("M5 20V10a7 7 0 0114 0v10l-2.3-1.6L14.4 20 12 18.4 9.6 20l-2.3-1.6z")}
      {P("M9.5 10.5h.01M14.5 10.5h.01")}
    </>
  ),
  plus: P("M12 5v14M5 12h14"),
  search: (
    <>
      {P("M11 19a8 8 0 100-16 8 8 0 000 16z")}
      {P("M21 21l-4.3-4.3")}
    </>
  ),
  gear: (
    <>
      {P("M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z")}
      {P("M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2V21a2 2 0 11-4 0v-.1A1.7 1.7 0 006 19.7l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 003 14H3a2 2 0 110-4h.1A1.7 1.7 0 004.3 7L4.2 7a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 0010 3.1V3a2 2 0 114 0v.1a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1A1.7 1.7 0 0020.9 10H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z")}
    </>
  ),
  copy: (
    <>
      {P("M9 9h10v12H9z")}
      {P("M15 5H5v12")}
    </>
  ),
  check: P("M4 13l5 5L20 7"),
  send: P("M4 12l16-8-6 16-2.6-6.2z"),
  clip: P("M20 11l-8.5 8.5a4.5 4.5 0 01-6.4-6.4L13 4.6a3 3 0 014.3 4.2l-8 8.1a1.5 1.5 0 01-2.2-2.1l7.4-7.5"),
  users: (
    <>
      {P("M9 12a4 4 0 100-8 4 4 0 000 8z")}
      {P("M2 21a7 7 0 0114 0")}
      {P("M17 4.2a4 4 0 010 7.6M18 21a7 7 0 00-2-4.9")}
    </>
  ),
  eye: (
    <>
      {P("M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z")}
      {P("M12 14.8a2.8 2.8 0 100-5.6 2.8 2.8 0 000 5.6z")}
    </>
  ),
  eyeoff: P("M3 3l18 18M10.6 6.2A9.6 9.6 0 0112 6c6.4 0 10 6 10 6a17 17 0 01-3 3.6M6.3 8.1A16.6 16.6 0 002 12s3.6 6 10 6a10 10 0 003.6-.6"),
  refresh: P("M4 12a8 8 0 0113.7-5.6L20 8M20 4v4h-4M20 12a8 8 0 01-13.7 5.6L4 16m0 4v-4h4"),
  alert: (
    <>
      {P("M12 4l9 16H3z")}
      {P("M12 10v4M12 17h.01")}
    </>
  ),
  cpu: (
    <>
      {P("M7 7h10v10H7z")}
      {P("M10 3v2M14 3v2M10 19v2M14 19v2M3 10h2M3 14h2M19 10h2M19 14h2")}
    </>
  ),
  db: (
    <>
      {P("M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3z")}
      {P("M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7")}
    </>
  ),
  globe: (
    <>
      {P("M12 21a9 9 0 100-18 9 9 0 000 18z")}
      {P("M3.5 9h17M3.5 15h17M12 3c2.5 2.4 3.8 5.6 3.8 9S14.5 18.6 12 21c-2.5-2.4-3.8-5.6-3.8-9S9.5 5.4 12 3z")}
    </>
  ),
  terminal: (
    <>
      {P("M4 5h16v14H4z")}
      {P("M8 10l2.5 2L8 14M13 15h4")}
    </>
  ),
  x: P("M6 6l12 12M18 6L6 18"),
  qr: (
    <>
      {P("M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z")}
      {P("M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z")}
    </>
  ),
  bolt: P("M13 3l-8 10h6l-2 8 8-10h-6z"),
  trash: (
    <>
      {P("M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13")}
      {P("M11 11v6M13 11v6")}
    </>
  ),
  doc: (
    <>
      {P("M6 3h8l4 4v14H6z")}
      {P("M14 3v4h4M9 12h6M9 16h6")}
    </>
  ),
  spark: P("M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"),
  chevron: P("M9 6l6 6-6 6"),
  reply: P("M9 10L4 15l5 5M4 15h9a6 6 0 006-6V6"),
  smile: (
    <>
      {P("M12 21a9 9 0 100-18 9 9 0 000 18z")}
      {P("M8.5 14a4.5 4.5 0 007 0M9 9.5h.01M15 9.5h.01")}
    </>
  ),
  infinity: P("M8 12a3.5 3.5 0 113.5 3.5A3.5 3.5 0 0116 12a3.5 3.5 0 00-3.5-3.5A3.5 3.5 0 009 12z"),
};

export function Icon({ name, size = 16, className = "" }: { name: keyof typeof ICONS | string; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[name] ?? ICONS.shield}
    </svg>
  );
}

/* ------------------------------------------------------------------ bits */

export function Chip({ tone = "", children, title }: { tone?: "good" | "warn" | "bad" | "acc" | ""; children: ReactNode; title?: string }) {
  const cls = tone ? `chip chip-${tone}` : "chip";
  return (
    <span className={cls} title={title}>
      {children}
    </span>
  );
}

export function Copyable({ value, label, mono = true }: { value: string; label?: string; mono?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          setDone(false);
        }
      }}
      className="row w-full justify-between gap-3 rounded-xl border border-[var(--line)] bg-black/30 px-3 py-2 text-left transition hover:border-[var(--line-strong)] hover:bg-black/50"
      title="Copy to clipboard (auto-clears after 45s when enabled)"
    >
      <span className={`min-w-0 truncate ${mono ? "mono" : ""} text-[11.5px] text-[var(--ink-dim)]`}>{label ?? value}</span>
      <span className="flex-none text-[var(--acc)]">
        <Icon name={done ? "check" : "copy"} size={14} />
      </span>
    </button>
  );
}

export function KV({ k, v, tone }: { k: string; v: ReactNode; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className="row items-start justify-between gap-4 py-[5px]">
      <span className="kicker flex-none">{k}</span>
      <span
        className={`mono min-w-0 text-right text-[11.5px] leading-relaxed break-all ${
          tone === "good" ? "text-[#a9ffe2]" : tone === "warn" ? "text-[#ffdca6]" : tone === "bad" ? "text-[#ffc2c9]" : "text-[var(--ink)]"
        }`}
      >
        {v}
      </span>
    </div>
  );
}

export function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="row w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/5"
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold">{label}</span>
        {hint ? <span className="mono block text-[10.5px] leading-snug text-[var(--ink-faint)]">{hint}</span> : null}
      </span>
      <span
        className={`relative flex h-[22px] w-[40px] flex-none items-center rounded-full border transition ${
          on ? "border-transparent bg-[var(--acc)]" : "border-[var(--line-strong)] bg-black/40"
        }`}
      >
        <span
          className={`absolute h-[16px] w-[16px] rounded-full bg-[#05140f] transition-all ${on ? "left-[20px]" : "left-[3px] bg-white/70"}`}
        />
      </span>
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  icon = "shield",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  icon?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-[8vh] backdrop-blur-sm" onClick={onClose}>
      <div
        className={`sheet panel relative w-full ${wide ? "max-w-3xl" : "max-w-lg"} shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <span className="glowline" />
        <div className="row items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3.5">
          <div className="row gap-2.5">
            <span className="text-[var(--acc)]">
              <Icon name={icon} size={17} />
            </span>
            <h3 className="text-[14.5px] font-bold tracking-tight">{title}</h3>
          </div>
          <button className="btn btn-icon btn-sm" onClick={onClose} aria-label="Close">
            <Icon name="x" size={15} />
          </button>
        </div>
        <div className="scroll max-h-[70vh] px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Meter({
  value,
  label,
  tone = "acc",
}: {
  value: number;
  label: string;
  tone?: "acc" | "good" | "warn" | "bad";
}) {
  const color = tone === "bad" ? "var(--danger)" : tone === "warn" ? "var(--warn)" : "var(--acc)";
  return (
    <div className="meter w-full">
      <div className="row mb-1 justify-between">
        <span className="kicker">{label}</span>
        <span className="mono text-[10.5px]" style={{ color }}>
          {Math.round(value)}
        </span>
      </div>
      <div className="h-[5px] w-full overflow-hidden rounded-full bg-white/8">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: color }} />
      </div>
    </div>
  );
}

export function TtlRing({ left, total }: { left: number; total: number }) {
  const pct = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  const r = 8;
  const c = 2 * Math.PI * r;
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" className="ttl-ring flex-none" aria-label="time to live">
      <circle cx="11" cy="11" r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="2.2" />
      <circle
        cx="11"
        cy="11"
        r={r}
        fill="none"
        stroke={pct < 0.25 ? "var(--danger)" : "var(--warn)"}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
      />
    </svg>
  );
}

export function Identicon({ seed, label }: { seed: string; label: string }) {
  // deterministic glyph from the identity key — a cheap visual twin of the fingerprint
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const cells = Array.from({ length: 9 }, (_, i) => ((h >> (i * 2)) & 3) > 0);
  return (
    <div className="avatar" title={`${label} · visual id derived from the identity key`}>
      <svg width="22" height="22" viewBox="0 0 9 9" aria-hidden="true">
        {cells.map((on, i) => (
          <rect
            key={i}
            x={i % 3}
            y={Math.floor(i / 3)}
            width="0.82"
            height="0.82"
            rx="0.2"
            fill={on ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.12)"}
          />
        ))}
      </svg>
    </div>
  );
}

const EMOJI_SETS: { label: string; items: string[] }[] = [
  {
    label: "reactions",
    items: ["🔥", "👍", "❤️", "😂", "😮", "😢", "🙏", "👏", "🎉", "🤝", "🔐", "👀", "✅", "💯", "🤔", "😅"],
  },
  {
    label: "faces",
    items: ["😀", "😃", "😄", "😁", "😆", "😊", "🙂", "😉", "😍", "😘", "😎", "🤩", "🥳", "😴", "🤯", "🥲", "😇", "🫡", "🤗", "😜"],
  },
  {
    label: "gestures",
    items: ["👋", "✌️", "🤙", "🫶", "👌", "🤞", "✊", "👊", "🤘", "🫰", "🙏", "💪", "🧠", "👀", "🫀", "🦾"],
  },
  {
    label: "life",
    items: ["🚀", "⚡", "💡", "🎯", "🏆", "🎁", "☕", "🍕", "🌍", "🌙", "☀️", "❄️", "🌊", "🌈", "⭐", "🔔"],
  },
  {
    label: "security",
    items: ["🔐", "🔑", "🛡️", "🧱", "🚨", "⏳", "💣", "🧨", "📛", "🚫", "🕵️", "👁️", "🧿", "📌", "🧾", "🗝️"],
  },
];

export function EmojiPicker({
  open,
  onPick,
  onClose,
  align = "left",
}: {
  open: boolean;
  onPick: (e: string) => void;
  onClose: () => void;
  align?: "left" | "right";
}) {
  const [tab, setTab] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      ref={ref}
      className={`panel sheet absolute bottom-[calc(100%+8px)] z-50 w-[292px] p-2 shadow-2xl ${align === "right" ? "right-0" : "left-0"}`}
      role="dialog"
      aria-label="Emoji picker"
    >
      <div className="mb-1.5 flex gap-1 overflow-x-auto pb-1">
        {EMOJI_SETS.map((s, i) => (
          <button
            key={s.label}
            onClick={() => setTab(i)}
            className={`mono flex-none rounded-md px-2 py-1 text-[10px] transition ${
              tab === i ? "bg-[rgba(79,240,182,.16)] text-[#a9ffe2]" : "text-[var(--ink-faint)] hover:bg-white/5"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-0.5">
        {EMOJI_SETS[tab].items.map((e) => (
          <button
            key={e}
            onClick={() => onPick(e)}
            className="grid h-[30px] place-items-center rounded-lg text-[17px] transition hover:bg-white/10 active:scale-95"
            title={e}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="mono mt-1.5 border-t border-[var(--line)] pt-1.5 text-[9.5px] text-[var(--ink-faint)]">
        emoji bhi ratchet se encrypted hote hain · esc to close
      </div>
    </div>
  );
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function FireOverlay({ active, text = "Burning & Shredding Room..." }: { active: boolean; text?: string }) {
  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex flex-col items-center justify-end overflow-hidden">
      {/* Dark reddish combustion haze */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#ff1a00]/50 via-[#ff5500]/25 to-transparent animate-pulse" />

      {/* Central Flame Glow & Badge */}
      <div className="relative z-20 mb-36 flex flex-col items-center gap-3">
        <div className="relative grid h-24 w-24 place-items-center rounded-full bg-gradient-to-t from-[#ff0000] via-[#ff5500] to-[#ffcc00] shadow-[0_0_90px_rgba(255,60,0,1)] animate-[flameFlicker_0.5s_infinite]">
          <span className="text-5xl">🔥</span>
        </div>
        <div className="mono rounded-full border border-[rgba(255,180,50,.6)] bg-black/85 px-6 py-2 text-sm font-bold tracking-wider text-[#ffe380] shadow-[0_0_35px_rgba(255,90,0,0.9)] backdrop-blur-md">
          {text}
        </div>
      </div>

      {/* Rising Fire Wall at bottom */}
      <div className="relative z-10 w-full h-[55vh] flex items-end justify-center animate-[fireRise_1.6s_ease-out_forwards]">
        <div className="w-full h-full bg-gradient-to-t from-[#ff1a00] via-[#ff6600]/80 to-transparent blur-md opacity-95" />
      </div>

      {/* Floating Sparks & Embers */}
      <div className="absolute inset-x-0 bottom-0 h-80 pointer-events-none">
        {[...Array(28)].map((_, i) => (
          <span
            key={i}
            className="absolute bottom-0 rounded-full bg-[#ffea78] shadow-[0_0_12px_#ff7700]"
            style={{
              left: `${(i * 3.6 + (i % 3) * 2)}%`,
              width: `${Math.max(3, (i % 5) * 2 + 2)}px`,
              height: `${Math.max(3, (i % 5) * 2 + 2)}px`,
              animation: `emberFly ${0.9 + (i % 6) * 0.2}s infinite ease-out`,
              animationDelay: `${(i % 5) * 0.12}s`,
              ["--drift" as any]: `${(i % 2 === 0 ? 1 : -1) * (18 + (i % 4) * 12)}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

