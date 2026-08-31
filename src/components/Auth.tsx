"use client";

import { useEffect, useMemo, useState } from "react";
import { Chip, Icon, Meter } from "./ui";

export interface AuthResult {
  mode: "register" | "unlock";
  username: string;
  passphrase: string;
  inviteCode?: string;
}

function strengthOf(p: string): { score: number; label: string; tone: "good" | "warn" | "bad" } {
  let s = 0;
  if (p.length >= 10) s += 18;
  if (p.length >= 16) s += 22;
  if (p.length >= 24) s += 14;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s += 12;
  if (/\d/.test(p)) s += 10;
  if (/[^\w\s]/.test(p)) s += 14;
  if (new Set(p).size < 5) s -= 25;
  if (/^(password|qwerty|1234|letmein)/i.test(p)) s -= 40;
  s = Math.max(2, Math.min(100, s));
  return { score: s, label: s > 78 ? "hard to brute force" : s > 50 ? "okay — lengthen it" : "weak", tone: s > 78 ? "good" : s > 50 ? "warn" : "bad" };
}

const SPECS = [
  { k: "Agreement", v: "X3DH-lite · ECDH P-256 · IK+SPK+OPK pool" },
  { k: "Ratchet", v: "Double Ratchet — FS + post-compromise security" },
  { k: "Cipher", v: "AES-256-GCM, 96-bit IV, header as AAD" },
  { k: "KDF", v: "HKDF-SHA-256 · PBKDF2 750k for the vault key" },
  { k: "Files", v: "sealed pre-upload with a one-time key + SHA-256" },
  { k: "Relay", v: "ciphertext + opaque ids only · TTL shred sweeps" },
];

export default function Auth({
  onSubmit,
  busy,
  error,
  relay,
  onSentry,
  sentryStatus,
  inviteCode,
  onBack,
  onBootstrap,
}: {
  onSubmit: (r: AuthResult) => void;
  busy: boolean;
  error: string | null;
  relay: { adapter?: string; users?: number; ciphertextRows?: number } | null;
  onSentry: () => void;
  sentryStatus: string;
  inviteCode?: string | null;
  onBack?: () => void;
  onBootstrap?: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"register" | "unlock">("register");
  const [username, setUsername] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [show, setShow] = useState(false);
  const [ack, setAck] = useState(false);

  const strength = useMemo(() => strengthOf(passphrase), [passphrase]);

  useEffect(() => {
    if (mode === "unlock") setAck(true);
  }, [mode]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !passphrase) return;
    if (mode === "register" && (!ack || passphrase.length < 10)) return;
    onSubmit({ mode, username: username.trim().toLowerCase(), passphrase, inviteCode: inviteCode ?? undefined });
  };

  return (
    <div className="shell scroll">
      {onBack ? (
        <button
          onClick={onBack}
          className="btn btn-sm fixed left-3 top-3 z-40 !border-transparent !bg-black/60 backdrop-blur shadow-lg"
          title="Back to showcase"
        >
          <Icon name="chevron" size={13} className="rotate-180" /> Back
        </button>
      ) : null}
      <div className="mx-auto grid min-h-[100dvh] w-full max-w-[1180px] items-center gap-6 px-4 py-14 sm:px-5 sm:py-10 lg:grid-cols-[1.05fr_.95fr]">
        {/* ---- pitch */}
        <div className="relative sheet">
          <div className="row gap-3">
            <span className="grid h-10 w-10 sm:h-11 sm:w-11 place-items-center rounded-2xl border border-[var(--line-strong)] bg-[rgba(79,240,182,.12)] text-[var(--acc)]">
              <Icon name="shield" size={22} />
            </span>
            <div>
              <div className="text-[18px] sm:text-[20px] font-bold leading-none tracking-tight">
                SHER<span className="text-[var(--acc)]">·</span>VAULT
              </div>
              <div className="kicker mt-1.5">personal zero-knowledge messenger</div>
            </div>
          </div>

          <h1 className="mt-5 sm:mt-7 max-w-[19ch] text-[clamp(26px,5.2vw,54px)] font-bold leading-[1.05] sm:leading-[0.98] tracking-[-0.03em]">
            Your keys never leave this tab.
            <span className="block text-[var(--ink-faint)]">The relay is allowed to be stupid.</span>
          </h1>
          <p className="mt-4 sm:mt-5 max-w-[62ch] text-[13.5px] sm:text-[14px] leading-relaxed text-[var(--ink-dim)]">
            Every conversation is sealed client-side with a real Double Ratchet before it touches the network. No phone number, no
            email, no analytics, no cloud backup, no admin. Passphrase is the vault key — if it is lost, nobody can recover your
            history, including me. That is the whole point.
          </p>

          <div className="mt-7 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {SPECS.map((s) => (
              <div key={s.k} className="row items-baseline justify-between gap-3 border-b border-[var(--line)] py-2">
                <span className="kicker">{s.k}</span>
                <span className="mono text-right text-[11px] text-[var(--ink-dim)]">{s.v}</span>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            <Chip tone="good">
              <span className="dot" /> live relay
            </Chip>
            <Chip tone="acc">
              <Icon name="db" size={12} /> {relay?.adapter ?? "detecting…"}
            </Chip>
            <Chip>
              <Icon name="doc" size={12} /> accounts: {relay?.users ?? "—"}
            </Chip>
            <Chip>
              <Icon name="lock" size={12} /> ciphertext rows: {relay?.ciphertextRows ?? "—"}
            </Chip>
            <a className="chip" href="/guide">
              <Icon name="spark" size={12} /> Guide & Handbook
            </a>
            <a className="chip" href="/plan">
              <Icon name="terminal" size={12} /> PRD + Threat Model
            </a>
          </div>
        </div>

        {/* ---- form */}
        <div className="panel sheet relative overflow-hidden p-6" style={{ animationDelay: "80ms", animationFillMode: "backwards" }}>
          <span className="glowline" />
          {onBack ? (
            <div className="mb-4 rounded-xl border border-[rgba(56,189,248,.35)] bg-[rgba(56,189,248,.08)] p-3">
              <div className="row items-center justify-between gap-2 flex-wrap">
                <span className="mono text-[11px] text-[#bae6fd]">
                  ⚡ <b>Prefer 1-click ephemeral chat without a password?</b>
                </span>
                <button type="button" className="btn btn-sm !bg-sky-500/20 !text-sky-300 hover:!bg-sky-500/30" onClick={onBack}>
                  Instant Ephemeral Room ➔
                </button>
              </div>
            </div>
          ) : null}
          {inviteCode ? (
            <div className="row mb-4 items-start gap-2 rounded-xl border border-[rgba(79,240,182,.35)] bg-[rgba(79,240,182,.08)] p-3 text-[11.5px] text-[#a9ffe2]">
              <Icon name="key" size={14} />
              <span className="mono min-w-0 break-all">
                Invite detected — <b>{inviteCode.slice(0, 10)}…</b> (only SHA-256 hash sent to relay)
              </span>
            </div>
          ) : relay?.users === 0 && onBootstrap ? (
            <div className="mb-4 rounded-xl border border-[rgba(79,240,182,.35)] bg-[rgba(79,240,182,.07)] p-3">
              <div className="row items-start gap-2 text-[11.5px] text-[#a9ffe2]">
                <Icon name="spark" size={14} />
                <span className="mono min-w-0">
                  Fresh relay detected — zero identities registered. You can initialize as the first operator.
                </span>
              </div>
              <button className="btn btn-primary btn-sm mt-2.5 w-full justify-center" type="button" onClick={() => void onBootstrap()}>
                <Icon name="key" size={13} /> Initialize Private Relay (One-Time)
              </button>
              <p className="mono mt-1.5 text-[9.5px] leading-relaxed text-[var(--ink-faint)]">
                Mints a 1-hour admin invite token. This button is permanently disabled after the first identity is created.
              </p>
            </div>
          ) : (
            <div className="row mb-4 items-start gap-2 rounded-xl border border-[rgba(255,190,85,.3)] bg-[rgba(255,190,85,.07)] p-3 text-[11.5px] text-[#ffdca6]">
              <Icon name="alert" size={14} />
              <span className="mono">
                This relay is <b>invite-only</b>. Request an invite link from the operator (<b>/?invite=…</b>).
              </span>
            </div>
          )}

          <div className="row mb-5 rounded-xl border border-[var(--line)] bg-black/30 p-1">
            {(["register", "unlock"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold transition ${
                  mode === m ? "bg-white/10 text-[var(--ink)]" : "text-[var(--ink-faint)] hover:text-[var(--ink-dim)]"
                }`}
              >
                {m === "register" ? "Create identity" : "Unlock vault"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="grid gap-3.5">
            <label className="grid gap-1.5">
              <span className="kicker">handle (public on this relay)</span>
              <input
                className="input mono"
                value={username}
                autoCapitalize="none"
                spellCheck={false}
                onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ""))}
                placeholder="ked"
                maxLength={24}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="kicker">passphrase = vault key</span>
              <div className="relative">
                <input
                  className="input mono pr-11"
                  type={show ? "text" : "password"}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="correct horse battery staple ×4"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[var(--ink-faint)] hover:bg-white/5 hover:text-[var(--ink)]"
                  aria-label={show ? "Hide" : "Show"}
                >
                  <Icon name={show ? "eyeoff" : "eye"} size={15} />
                </button>
              </div>
            </label>

            {mode === "register" ? (
              <>
                <Meter value={passphrase ? strength.score : 0} label={`entropy · ${passphrase ? strength.label : "empty"}`} tone={strength.tone} />
                <label className="row items-start gap-2.5 rounded-xl border border-[var(--line)] bg-black/25 p-3 text-[12px] text-[var(--ink-dim)]">
                  <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 accent-[var(--acc)]" />
                  <span>
                    I understand there is <b className="text-[var(--ink)]">no recovery path</b>. Forgetting this passphrase means the vault blob on the
                    relay is permanently unreadable — I cannot reset it for you.
                  </span>
                </label>
              </>
            ) : null}

            {error ? (
              <div className="row items-start gap-2 rounded-xl border border-[rgba(255,107,122,.4)] bg-[rgba(255,107,122,.1)] p-3 text-[12.5px] text-[#ffc2c9]">
                <Icon name="alert" size={15} />
                <span>{error}</span>
              </div>
            ) : null}

            <button className="btn btn-primary mt-1 w-full justify-center py-3" disabled={busy}>
              {busy ? (
                <>
                  <Icon name="refresh" size={15} className="animate-spin" /> deriving keys — 750k PBKDF2 rounds…
                </>
              ) : (
                <>
                  <Icon name={mode === "register" ? "key" : "lock"} size={15} />
                  {mode === "register" ? "Generate bundle & register" : "Decrypt vault locally"}
                </>
              )}
            </button>
          </form>

          <div className="divider my-5" />

          <div className="row items-start gap-3">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-xl border border-[var(--line)] bg-[rgba(106,166,255,.12)] text-[var(--acc-2)]">
              <Icon name="ghost" size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold">Second identity for a live handshake</div>
              <div className="mono mt-1 text-[10.5px] leading-relaxed text-[var(--ink-faint)]">
                Sentry is a real peer with its own keys and its own session — {sentryStatus}.
              </div>
              <button className="btn btn-sm mt-2.5" onClick={onSentry} type="button">
                <Icon name="spark" size={13} /> Boot Sentry node
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
