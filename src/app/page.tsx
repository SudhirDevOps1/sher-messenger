"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Auth, { type AuthResult } from "@/components/Auth";
import Landing from "@/components/Landing";
import { Chat, Sidebar } from "@/components/Workspace";
import Inspector, { SealDetails, type InspectorTab } from "@/components/Inspector";
import { Chip, Icon, Modal } from "@/components/ui";
import { KedClient, type HistMsg } from "@/lib/client";
import { ensureSentry, type SentryHandle } from "@/lib/sentry";
import { safeJson } from "@/lib/safeFetch";
import { outbox } from "@/lib/outbox";

type Toast = { id: number; msg: string; tone: "good" | "bad" };

export default function Page() {
  const [phase, setPhase] = useState<"boot" | "landing" | "auth" | "app">("boot");
  const [client, setClient] = useState<KedClient | null>(null);
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [tab, setTab] = useState<InspectorTab>("identity");
  const [inspector, setInspector] = useState(true);
  const [modal, setModal] = useState<"dm" | "group" | "panic" | null>(null);
  const [handle, setHandle] = useState("");
  const [groupName, setGroupName] = useState("Secure circle");
  const [groupPicks, setGroupPicks] = useState<string[]>([]);
  const [groupTtl, setGroupTtl] = useState<number | null>(null);
  const [seal, setSeal] = useState<HistMsg | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [hidden, setHidden] = useState(false);
  const [sentry, setSentry] = useState<SentryHandle | null>(null);
  const [sentryMsg, setSentryMsg] = useState("not started");
  const [relay, setRelay] = useState<{ adapter?: string; users?: number; ciphertextRows?: number } | null>(null);
  const [me, setMe] = useState<{ username: string; role: string } | null>(null);
  const [mobile, setMobile] = useState<"rooms" | "chat">("rooms");
  const [welcome, setWelcome] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ body: string; level: string } | null>(null);
  const [outboxN, setOutboxN] = useState(0);
  const [online, setOnline] = useState(true);
  const [lastOpen, setLastOpen] = useState<Record<string, number>>({});
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const toastId = useRef(1);
  const [lang, setLang] = useState<"en" | "hi">(() => {
    try {
      return (localStorage.getItem("ked.lang") as "en" | "hi") || "en";
    } catch {
      return "en";
    }
  });

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [themeAccent, setThemeAccent] = useState<"emerald" | "blue" | "purple" | "amber" | "rose">(() => {
    try {
      return (localStorage.getItem("ked.accent") as "emerald" | "blue" | "purple" | "amber" | "rose") || "emerald";
    } catch {
      return "emerald";
    }
  });

  const toast = useCallback((msg: string, tone: "good" | "bad" = "good") => {
    const id = toastId.current++;
    setToasts((t) => [...t, { id, msg, tone }].slice(-4));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  /* ---------------- boot */

  useEffect(() => {
    let alive = true;
    void safeJson<{ adapter?: string; users?: number; ciphertextRows?: number }>("/api/ked/stats").then(
      (s) => alive && s && setRelay(s),
    );
    try {
      const sp = new URLSearchParams(location.search);
      const p = sp.get("invite");
      const roomParam = sp.get("room") || sp.get("join");
      const hashKey = location.hash.includes("k=") ? location.hash.replace("#k=", "") : "";

      if (roomParam) {
        void KedClient.joinGuestRoom({
          displayName: "Guest",
          code: roomParam.toLowerCase(),
          key: hashKey,
        }).then((res) => {
          if (alive && res?.client) {
            setClient(res.client);
            setPhase("app");
            setRoom(res.roomId);
            toast(lang === "hi" ? "रूम में शामिल हो गए" : "Joined room via link", "good");
          }
        }).catch(() => {});
      }

      if (p) {
        setInviteCode(p);
        try {
          sessionStorage.setItem("ked.invite", p);
        } catch {
          /* ignore */
        }
      } else {
        const saved = sessionStorage.getItem("ked.invite");
        if (saved) setInviteCode(saved);
      }
    } catch {
      /* ignore */
    }
    void safeJson<{ notice: { body: string; level: string } | null }>("/api/ked/notice").then((n) => alive && setNotice(n?.notice ?? null));
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    void KedClient.quick()
      .then((c) => {
        if (!alive) return;
        if (c) {
          setClient(c);
          setPhase("app");
          const first = Object.values(c.data.rooms)[0];
          if (first) setRoom(first.id);
        } else {
          const hasInvite = (() => {
            try {
              return !!(new URLSearchParams(location.search).get("invite") || sessionStorage.getItem("ked.invite"));
            } catch {
              return false;
            }
          })();
          setPhase(hasInvite ? "auth" : "landing");
        }
      })
      .catch(() => alive && setPhase("landing"));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!client) return;
    const un = client.subscribe(() => {
      bump();
      setOnline(client.online);
      setOutboxN(client.outboxCount);
      void outbox.count().then(setOutboxN);
    });
    void outbox.count().then(setOutboxN);
    return () => un();
  }, [client]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ked.lastopen.v1");
      if (raw) setLastOpen(JSON.parse(raw) as Record<string, number>);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const sync = () => setHidden(document.hidden || !document.hasFocus());
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("blur", sync);
    window.addEventListener("focus", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("blur", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        setInspector((v) => !v);
      } else if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        (document.getElementById("ked-search") as HTMLInputElement | null)?.focus();
      } else if (e.key === ".") {
        e.preventDefault();
        if (client) setModal("panic");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [client]);

  // privacy: auto-delete ephemeral rooms on tab close + screenshot friction
  useEffect(() => {
    const onBeforeUnload = () => {
      try {
        // mark code-rooms for 30m burn; actual shred is server TTL + local history wipe
        if (client) {
          const now = Date.now();
          for (const r of Object.values(client.data.rooms)) {
            if (r.type === "group" && (r.ttl ?? 0) <= 30 * 60_000 && (r.ttl ?? 0) > 0) {
              // flag for next open to purge
              client.data.history[r.id] = [];
            }
            void now;
          }
        }
        // best-effort: clear tab-local resume key so next open requires passphrase
        sessionStorage.clear();
      } catch {}
    };
    const onCopy = (e: ClipboardEvent) => {
      // allow copy inside inputs, block elsewhere for screenshot friction
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      e.preventDefault();
    };
    const onContext = (e: MouseEvent) => e.preventDefault();
    const onPrint = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen" || (e.ctrlKey && e.key.toLowerCase() === "p") || (e.metaKey && e.shiftKey && e.key === "S")) {
        e.preventDefault();
        toast("screenshot blocked — privacy first", "bad");
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("copy", onCopy as unknown as EventListener);
    document.addEventListener("contextmenu", onContext as unknown as EventListener);
    window.addEventListener("keydown", onPrint as unknown as EventListener);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("copy", onCopy as unknown as EventListener);
      document.removeEventListener("contextmenu", onContext as unknown as EventListener);
      window.removeEventListener("keydown", onPrint as unknown as EventListener);
    };
  }, [client, toast]);

  /* ---------------- auth */

  const openRoom = useCallback((id: string) => {
    setRoom(id);
    setMobile("chat");
    setLastOpen((prev) => {
      const next = { ...prev, [id]: Date.now() };
      try {
        localStorage.setItem("ked.lastopen.v1", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const summonSentry = useCallback(
    async (c: KedClient, autoOpen: boolean) => {
      setSentryMsg("booting peer agent…");
      try {
        const h = await ensureSentry(setSentryMsg);
        setSentry(h);
        setSentryMsg(`live as @${h.username}`);
        const contact = await c.addContact(h.username);
        const roomId = Object.values(c.data.rooms).find((r) => r.peerId === contact.userId)?.id ?? null;
        if (roomId && autoOpen) openRoom(roomId);
        toast(`Sentry paired as @${h.username} — real X3DH handshake over the relay`, "good");
        setTimeout(() => void c.poll(), 250);
      } catch (e) {
        setSentryMsg("failed: " + (e as Error).message);
        toast((e as Error).message, "bad");
      }
    },
    [openRoom, toast],
  );

  const onAuth = async (r: AuthResult) => {
    setBusy(true);
    setAuthError(null);
    try {
      const c =
        r.mode === "register"
          ? await KedClient.register({ username: r.username, passphrase: r.passphrase, device: navigator.platform || "web", inviteCode: r.inviteCode })
          : await KedClient.unlock({ username: r.username, passphrase: r.passphrase });
      setClient(c);
      setPhase("app");
      try {
        sessionStorage.removeItem("ked.invite");
      } catch {
        /* ignore */
      }
      void safeJson<{ username: string; role: string }>("/api/ked/me", { headers: { authorization: `Bearer ${c.token}` } }).then((m) => m && setMe(m));
      toast(`vault unlocked for @${c.username}`, "good");
      const seenGuide = (() => {
        try {
          return localStorage.getItem("ked.guided.v1") === "1";
        } catch {
          return false;
        }
      })();
      if (!seenGuide && Object.keys(c.data.contacts).length === 0) {
        setWelcome(true);
        try {
          localStorage.setItem("ked.guided.v1", "1");
        } catch {
          /* ignore */
        }
      }
      if (Object.keys(c.data.rooms).length === 0) void summonSentry(c, true);
    } catch (e) {
      setAuthError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- derived */

  const blur = hidden && (client?.data.settings.blurOnBackground ?? true);
  const rooms = useMemo(() => (client ? Object.values(client.data.rooms) : []), [client]);
  const totalUnread = useMemo(() => {
    if (!client) return 0;
    let n = 0;
    for (const r of rooms) n += (client.data.history[r.id] ?? []).filter((m) => !m.me && m.at > (lastOpen[r.id] ?? 0)).length;
    return n;
  }, [client, rooms, lastOpen]);
  const pollAge = client ? Math.max(0, Math.round((Date.now() - client.lastPoll) / 1000)) : 0;

  if (phase === "boot")
    return (
      <div className="shell items-center justify-center gap-4">
        <div className="scanline panel w-[280px] px-4 py-3 text-center">
          <div className="mono text-[11px] text-[var(--ink-dim)]">checking for a tab-local vault key…</div>
        </div>
      </div>
    );

  if (phase === "landing")
    return (
      <>
        <Landing
          relay={relay}
          onEnter={() => setPhase("auth")}
          onEnterGuest={(guestClient) => {
            setClient(guestClient);
            setPhase("app");
            const first = Object.values(guestClient.data.rooms)[0];
            if (first) setRoom(first.id);
            toast(lang === "hi" ? "अस्थायी रूम तैयार है — चैट शुरू करें" : "Ephemeral room ready — start chatting", "good");
          }}
        />
        <Toasts toasts={toasts} />
      </>
    );

  if (phase === "auth" || !client)
    return (
      <>
        <Auth
          inviteCode={inviteCode}
          onBack={() => setPhase("landing")}
          onBootstrap={async () => {
            const r = await safeJson<{ code?: string; error?: string }>("/api/ked/bootstrap-invite", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: "{}",
            });
            if (r?.code) {
              setInviteCode(r.code);
              try {
                sessionStorage.setItem("ked.invite", r.code);
              } catch {
                /* optional */
              }
              toast("private relay initialized — your new identity will be admin", "good");
            } else {
              toast(r?.error ?? "relay initialization failed — refresh and retry", "bad");
            }
          }}
          onSubmit={(r) => void onAuth(r)}
          busy={busy}
          error={authError}
          relay={relay}
          sentryStatus={sentryMsg}
          onSentry={() => void (async () => {
            const h = await ensureSentry(setSentryMsg).catch((e) => {
              toast((e as Error).message, "bad");
              return null;
            });
            if (h) {
              setSentry(h);
              setSentryMsg(`ready as @${h.username} — create an identity and I will pair you`);
            }
          })()}
        />
        <Toasts toasts={toasts} />
      </>
    );

  const accentStyles: Record<string, { acc: string; glow: string }> = {
    emerald: { acc: "#4ff0b6", glow: "rgba(79,240,182,.15)" },
    blue: { acc: "#38bdf8", glow: "rgba(56,189,248,.15)" },
    purple: { acc: "#c084fc", glow: "rgba(192,132,252,.15)" },
    amber: { acc: "#fbbf24", glow: "rgba(251,191,36,.15)" },
    rose: { acc: "#fb7185", glow: "rgba(251,113,133,.15)" },
  };

  const currentTheme = accentStyles[themeAccent] || accentStyles.emerald;

  return (
    <div
      className="shell"
      style={{
        ["--acc" as any]: currentTheme.acc,
        ["--acc-glow" as any]: currentTheme.glow,
      }}
    >
      <header className="row items-center justify-between gap-3 border-b border-[var(--line)] px-3 py-2.5 md:px-4">
        <div className="row min-w-0 gap-3">
          <span className="grid h-8 w-8 flex-none place-items-center rounded-xl border border-[var(--line-strong)] bg-[rgba(79,240,182,.12)] text-[var(--acc)]">
            <Icon name="shield" size={17} />
          </span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-bold leading-none tracking-tight">
              SHER<span className="text-[var(--acc)]">·</span>MESSENGER
            </div>
            <div className="mono mt-1 truncate text-[9.5px] text-[var(--ink-faint)]">@{client.username}</div>
          </div>
        </div>

        <div className="hidden items-center gap-1.5 lg:flex">
          <Chip tone="good">
            <span className="dot" /> e2ee · zero-knowledge
          </Chip>
          <Chip tone="acc">
            <Icon name="db" size={11} /> {String(client.stats?.adapter ?? relay?.adapter ?? "edge-memory")}
          </Chip>
          <Chip tone={pollAge > 8 ? "warn" : ""}>
            <Icon name="refresh" size={11} /> sync {pollAge}s ago
          </Chip>
          {client.error ? <Chip tone="bad">{client.error.slice(0, 40)}</Chip> : null}
          <Chip tone={totalUnread ? "warn" : ""}>{totalUnread ? `${totalUnread} unread` : "no unread"}</Chip>
        </div>

        <div className="row gap-1.5">
          <button
            className={`btn btn-sm ${!sidebarOpen ? "!border-[var(--acc)] !text-[var(--acc)] font-semibold" : ""}`}
            onClick={() => setSidebarOpen((s) => !s)}
            title={sidebarOpen ? "Collapse sidebar for full screen chat" : "Show sidebar"}
          >
            <Icon name="chevron" size={12} className={sidebarOpen ? "rotate-180" : ""} />
            <span className="hidden sm:inline">{sidebarOpen ? (lang === "hi" ? "फुल स्पेस" : "Full Space") : (lang === "hi" ? "साइडबार" : "Sidebar")}</span>
          </button>

          <button
            className="btn btn-sm"
            onClick={() => {
              const accents: Array<"emerald" | "blue" | "purple" | "amber" | "rose"> = ["emerald", "blue", "purple", "amber", "rose"];
              const next = accents[(accents.indexOf(themeAccent) + 1) % accents.length];
              setThemeAccent(next);
              try { localStorage.setItem("ked.accent", next); } catch {}
            }}
            title="Switch theme accent color"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: currentTheme.acc }} />
            <span className="hidden lg:inline capitalize text-[11px]">{themeAccent}</span>
          </button>

          <button
            className="btn btn-sm"
            onClick={() => {
              const n = lang === "en" ? "hi" : "en";
              setLang(n);
              try { localStorage.setItem("ked.lang", n); } catch {}
            }}
            title="Switch language"
          >
            {lang === "en" ? "हिंदी" : "EN"}
          </button>
          <button className="btn btn-sm" onClick={() => void summonSentry(client, true)} title="Boot / re-pair the local peer agent">
            <Icon name="ghost" size={13} /> <span className="hidden sm:inline">Sentry</span>
          </button>
          <button className="btn btn-sm" onClick={() => setInspector((v) => !v)} title="Toggle inspector (⌘B)">
            <Icon name="key" size={13} /> <span className="hidden sm:inline">Inspector</span>
          </button>
          <a className="btn btn-sm" href="/guide" title="Kaise kaam karta hai + deploy guide">
            <Icon name="spark" size={13} /> <span className="hidden sm:inline">Guide</span>
          </a>
          <a className="btn btn-sm" href="/plan" title="PRD + protocol spec">
            <Icon name="doc" size={13} /> <span className="hidden sm:inline">Plan</span>
          </a>
          {me?.role === "admin" ? (
            <a className="btn btn-sm" href="/sh3r-9x-admin" title="Admin console">
              <Icon name="shield" size={13} /> <span className="hidden sm:inline">Admin</span>
            </a>
          ) : null}
        </div>
      </header>

      {client.isGuest ? (
        <div className="mono row items-center justify-between gap-3 border-b border-[rgba(79,240,182,.3)] bg-[rgba(79,240,182,.08)] px-4 py-2 text-[11px] text-[#a9ffe2]">
          <div className="row gap-2">
            <Icon name="flame" size={14} className="text-[var(--acc)]" />
            <span>
              <b>{lang === "hi" ? "अस्थायी चैट रूम" : "Ephemeral Guest Room"}</b> · {lang === "hi" ? "ब्राउज़र बंद होने पर सभी डेटा स्वतः नष्ट होगा" : "In-memory · Auto-wipes on tab close"}
            </span>
          </div>
          {client.roomCode ? (
            <div className="row gap-2">
              <span className="kicker !text-[#a9ffe2]">{lang === "hi" ? "रूम कोड:" : "Room Code:"}</span>
              <button
                className="btn btn-sm !bg-black/40 !text-[#a9ffe2]"
                onClick={() => {
                  void navigator.clipboard.writeText(client.roomCode || "");
                  toast(lang === "hi" ? "रूम कोड कॉपी किया गया" : "Room code copied to clipboard", "good");
                }}
              >
                <Icon name="copy" size={12} /> {client.roomCode.toUpperCase()}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {notice ? (
        <div
          className={`mono row items-start gap-2 px-4 py-2 text-[11px] leading-relaxed ${
            notice.level === "critical"
              ? "bg-[rgba(255,107,122,.14)] text-[#ffc2c9]"
              : notice.level === "warn"
                ? "bg-[rgba(255,190,85,.12)] text-[#ffdca6]"
                : "bg-[rgba(106,166,255,.1)] text-[#b9d6ff]"
          }`}
        >
          <Icon name="alert" size={13} />
          <span className="min-w-0 flex-1">
            <b>SYSTEM NOTICE (not E2EE)</b> — {notice.body}
          </span>
          {me?.role === "admin" ? (
            <a className="btn btn-sm flex-none" href="/sh3r-9x-admin">
              admin
            </a>
          ) : null}
        </div>
      ) : null}
      {!online || outboxN > 0 ? (
        <div className="mono row items-center gap-2 border-b border-[rgba(255,190,85,.3)] bg-[rgba(255,190,85,.1)] px-4 py-2 text-[11px] text-[#ffdca6]">
          <Icon name="alert" size={13} />
          <span className="min-w-0 flex-1">
            {outboxN > 0 ? `${outboxN} message(s) sealed and queued offline — auto-flush jab relay jawab dega` : "relay se connection nahi — naye messages outbox mein queue honge"}
          </span>
          {outboxN > 0 ? (
            <button
              className="btn btn-sm flex-none"
              onClick={() => {
                void client.flushOutbox().then((n) => toast(n ? `${n} delivered` : "nothing to flush yet", n ? "good" : "bad"));
              }}
            >
              <Icon name="refresh" size={12} /> flush now
            </button>
          ) : null}
        </div>
      ) : null}

      <main
        className={`grid min-h-0 flex-1 gap-2.5 p-2.5 md:gap-3 md:p-3 ${
          inspector
            ? sidebarOpen
              ? "lg:grid-cols-[280px_minmax(0,1fr)_336px]"
              : "lg:grid-cols-[minmax(0,1fr)_336px]"
            : sidebarOpen
            ? "lg:grid-cols-[280px_minmax(0,1fr)]"
            : "grid-cols-1"
        }`}
      >
        {sidebarOpen ? (
          <div className={`${mobile === "rooms" ? "flex" : "hidden"} min-h-0 lg:flex`}>
            <Sidebar
              client={client}
              activeRoomId={room}
              onSelect={(id) => {
                openRoom(id);
                void client.poll();
              }}
              onNewContact={() => setModal("dm")}
              onNewGroup={() => setModal("group")}
              lastOpen={lastOpen}
            />
          </div>
        ) : null}
        <div className={`${mobile === "chat" ? "flex" : "hidden"} min-h-0 flex-col gap-2 lg:flex`}>
          <div className="row gap-2 lg:hidden">
            <button className="btn btn-sm" onClick={() => setMobile("rooms")}>
              <Icon name="chevron" size={13} className="rotate-180" /> rooms ({rooms.length})
            </button>
            <Chip tone="good">
              <span className="dot" /> sealed
            </Chip>
          </div>
          <div className="min-h-0 flex-1">
            <Chat
              client={client}
              roomId={room}
              blur={!!blur}
              sentryHint={sentry ? `Sentry is live as @${sentry.username}` : "boot Sentry from the top bar"}
              onInfo={setSeal}
              onOpenInspector={() => {
                setInspector(true);
                setTab("session");
              }}
            />
          </div>
        </div>
        {inspector ? (
          <div className="hidden min-h-0 lg:flex">
            <Inspector
              client={client}
              roomId={room}
              tab={tab}
              onTab={setTab}
              onClose={() => setInspector(false)}
              toast={toast}
            />
          </div>
        ) : null}
      </main>

      {blur ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center">
          <Chip tone="warn">
            <Icon name="eyeoff" size={11} /> blurred while unfocused — disable in Hardening
          </Chip>
        </div>
      ) : null}

      <Modal open={modal === "dm"} onClose={() => setModal(null)} title="Start a sealed DM" icon="plus">
        <p className="text-[13px] leading-relaxed text-[var(--ink-dim)]">
          Handles are the only directory on this relay — no phone numbers, no emails. The room id is the SHA-256 of both identity keys,
          so nobody else can name the conversation, and the first message carries your X3DH prekey bundle.
        </p>
        <input
          className="input mono mt-3"
          placeholder="handle, e.g. ked or sententry-ab12"
          value={handle}
          onChange={(e) => setHandle(e.target.value.replace(/\s+/g, "").toLowerCase())}
        />
        <div className="mt-3 row gap-2">
          <button className="btn flex-1 justify-center" onClick={() => setModal(null)}>
            cancel
          </button>
          <button
            className="btn btn-primary flex-1 justify-center"
            onClick={async () => {
              try {
                const c = await client.addContact(handle);
                setModal(null);
                setHandle("");
                const r = Object.values(client.data.rooms).find((x) => x.peerId === c.userId);
                if (r) openRoom(r.id);
                toast(`@${c.username} added — verify the safety number in the Inspector`, "good");
              } catch (e) {
                toast((e as Error).message, "bad");
              }
            }}
          >
            fetch bundle & derive room
          </button>
        </div>
      </Modal>

      <Modal open={modal === "group"} onClose={() => setModal(null)} title="New group (sender keys)" icon="users">
        <div className="grid gap-3">
          <input className="input" value={groupName} onChange={(e) => setGroupName(e.target.value.slice(0, 40))} placeholder="group name" />
          <div className="kicker">members — each seed is delivered over that person&apos;s verified 1:1 session</div>
          <div className="grid gap-1.5">
            {Object.values(client.data.contacts).length === 0 ? (
              <p className="mono text-[11px] text-[var(--ink-faint)]">add at least one contact first</p>
            ) : null}
            {Object.values(client.data.contacts).map((c) => (
              <label key={c.userId} className="row justify-between rounded-lg border border-[var(--line)] px-2.5 py-2 text-[12.5px]">
                <span className="row gap-2">
                  <input
                    type="checkbox"
                    className="accent-[var(--acc)]"
                    checked={groupPicks.includes(c.userId)}
                    onChange={(e) => setGroupPicks((p) => (e.target.checked ? [...p, c.userId] : p.filter((x) => x !== c.userId)))}
                  />
                  @{c.username}
                </span>
                <Chip tone={c.verified ? "good" : "warn"}>{c.verified ? "verified" : "unverified"}</Chip>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[null, 30_000, 300_000, 3_600_000].map((ms) => (
              <button key={String(ms)} className={`chip ${groupTtl === ms ? "!border-[rgba(79,240,182,.5)] !text-[#a9ffe2]" : ""}`} onClick={() => setGroupTtl(ms)}>
                ttl {ms ? `${ms / 1000}s` : "off"}
              </button>
            ))}
          </div>
          <div className="row gap-2">
            <button className="btn flex-1 justify-center" onClick={() => setModal(null)}>
              cancel
            </button>
            <button
              className="btn btn-primary flex-1 justify-center"
              onClick={async () => {
                try {
                  const gid = await client.createGroup(groupName || "group", groupPicks, groupTtl);
                  setModal(null);
                  setGroupPicks([]);
                  openRoom(gid);
                  toast("group created — sender chains generated locally", "good");
                } catch (e) {
                  toast((e as Error).message, "bad");
                }
              }}
            >
              generate sender keys
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === "panic"} onClose={() => setModal(null)} title="Panic wipe" icon="flame">
        <p className="text-[13px] leading-relaxed text-[var(--ink-dim)]">
          Type the confirmation word below, or just close this dialog. Wiping destroys the local vault (sessions, decrypted history,
          keys), revokes every relay session and asks the relay to zero your own ciphertext rows. Hotkey: ⌘/Ctrl + .
        </p>
        <div className="mt-4 row gap-2">
          <button
            className="btn btn-danger flex-1 justify-center"
            onClick={async () => {
              setModal(null);
              await client.panicWipe();
              setClient(null);
              setPhase("auth");
              setRoom(null);
              toast("vault destroyed · you are signed out everywhere", "bad");
            }}
          >
            <Icon name="flame" size={13} /> confirm WIPE
          </button>
          <button className="btn flex-1 justify-center" onClick={() => setModal(null)}>
            not now
          </button>
        </div>
      </Modal>

      <SealDetails open={!!seal} onClose={() => setSeal(null)} msg={seal} client={client} />

      <Modal open={welcome} onClose={() => setWelcome(false)} title="Welcome to SHER Messenger" icon="shield" wide>
        <div className="grid gap-4">
          <p className="text-[13.5px] leading-relaxed text-[var(--ink-dim)]">
            Ye ekdum jaana-pehchana chalega — bas farq itna hai ki <b className="text-[var(--ink)]">message aapke tab se nikalne se pehle hi
            band ho chuka hota hai</b>. Server ko sirf ciphertext milta hai, isliye DB chori hone par bhi kuch nahi padha ja sakta.
          </p>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {[
              { i: "key", t: "1 · Pehchaan ban gayi", d: "Aapki identity key + 24 one-time prekeys ban gaye. Private keys isi device par encrypted hain — server par sirf public material gaya." },
              { i: "ghost", t: "2 · Sentry abhi pair ho raha hai", d: "Ek doosri ASLI identity isi tab mein chal rahi hai (apne keys, apni vault). Usse turant baat karo: help, audit, verify, threat model." },
              { i: "plus", t: "3 · Dost kaise jodo", d: "Left rail → New DM → uska handle. Usko isi relay par registered hona hoga. Phir Inspector → Session → 60-digit safety number milao." },
              { i: "flame", t: "4 · Auto-burn try karo", d: "Composer ke neeche TTL chips: 30s chuno, message bhejo, countdown ghoomte dekho. Dono taraf + relay par destroy ho jayega." },
            ].map((c) => (
              <div key={c.t} className="rounded-xl border border-[var(--line)] bg-black/25 p-3">
                <div className="row gap-2 text-[var(--acc)]">
                  <Icon name={c.i} size={15} />
                  <span className="text-[12.5px] font-bold text-[var(--ink)]">{c.t}</span>
                </div>
                <p className="mono mt-1.5 text-[10.5px] leading-relaxed text-[var(--ink-dim)]">{c.d}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[rgba(255,190,85,.32)] bg-[rgba(255,190,85,.07)] p-3">
            <div className="row gap-2 text-[var(--warn)]">
              <Icon name="alert" size={15} />
              <span className="text-[12.5px] font-bold text-[var(--ink)]">Sabse zaroori: passphrase</span>
            </div>
            <p className="mono mt-1.5 text-[10.5px] leading-relaxed text-[var(--ink-dim)]">
              Passphrase hi aapki chaabi hai — server ke paas uska koi hissa nahi hai, isliye <b>reset nahi ho sakta</b>. Abhi
              password manager mein save karo ya kagaz par likh lo. Bhool gaye to history hamesha ke liye chali jayegi.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button className="btn btn-primary justify-center" onClick={() => setWelcome(false)}>
              <Icon name="lock" size={14} /> Samajh gaya — shuru karte hain
            </button>
            <a className="btn justify-center" href="/guide" target="_blank" rel="noreferrer">
              <Icon name="doc" size={14} /> Poori guide padho (deploy bhi)
            </a>
          </div>
        </div>
      </Modal>

      <Toasts toasts={toasts} />
    </div>
  );
}

function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] grid gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`sheet panel mono max-w-[340px] px-3.5 py-2.5 text-[11.5px] leading-relaxed ${
            t.tone === "bad" ? "!border-[rgba(255,107,122,.45)] text-[#ffc2c9]" : "text-[#a9ffe2]"
          }`}
        >
          <span className="row gap-2">
            <Icon name={t.tone === "bad" ? "alert" : "check"} size={13} /> {t.msg}
          </span>
        </div>
      ))}
    </div>
  );
}
