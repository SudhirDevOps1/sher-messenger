"use client";

import { useCallback, useEffect, useState } from "react";
import { Chip, Icon, KV, Modal } from "@/components/ui";
import { safeJson } from "@/lib/safeFetch";
import { useI18n, type Lang } from "@/lib/i18n";

interface Counts {
  users: number;
  blocked: number;
  rooms: number;
  ciphertextRows: number;
  invites: number;
  activeSessions: number;
}
interface AdminUser {
  id: string;
  username: string;
  createdAt: string;
  lastSeen: string | null;
  role: string;
  blocked: number;
  sessions: number;
  opkLeft: number;
  note: string | null;
  fingerprint: string;
}
interface ActiveRoom {
  id: string;
  type: string;
  createdAt: string;
  defaultTtl: number | null;
  membersCount: number;
  expiresAt: string | null;
  uses: number;
  maxUsers: number;
}
interface Invite {
  id: string;
  label: string | null;
  role: string;
  maxUses: number;
  uses: number;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  claimedBy: string | null;
}
interface AuditEvent {
  userId: string | null;
  event: string;
  detail: string | null;
  createdAt: string;
}

type Tab = "overview" | "rooms" | "users" | "invites" | "broadcast" | "audit";

export default function Admin() {
  const { lang, setLang, t } = useI18n();
  const [token, setToken] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [counts, setCounts] = useState<Counts | null>(null);
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [notice, setNotice] = useState<{ body: string; level: string } | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [me, setMe] = useState<{ username: string; role: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [broadcast, setBroadcast] = useState("");
  const [level, setLevel] = useState("info");
  const [inviteLabel, setInviteLabel] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteUses, setInviteUses] = useState(1);
  const [inviteDays, setInviteDays] = useState(7);
  const [confirmPurge, setConfirmPurge] = useState<AdminUser | null>(null);
  const [confirmBurnRoom, setConfirmBurnRoom] = useState<string | null>(null);
  
  // Clean 1-step login credentials
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  const call = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T | null> => {
      setErr(null);
      const res = await safeJson<T>(`/api/ked/${path}`, {
        ...init,
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) },
      });
      if (res === null) setErr(lang === "hi" ? "सर्वर से उत्तर नहीं मिला।" : "No response from relay server.");
      else if ((res as { error?: string }).error) setErr((res as { error?: string }).error!);
      return res;
    },
    [token, lang],
  );

  const refresh = useCallback(
    async (tName: Tab) => {
      if (!token) return;
      if (tName === "overview") {
        const o = await call<{ counts: Counts; notice: { body: string; level: string } | null; inviteOnly: boolean }>("admin/overview");
        if (o) {
          setCounts(o.counts);
          setNotice(o.notice);
        }
      } else if (tName === "rooms") {
        const r = await call<{ rooms: ActiveRoom[] }>("admin/rooms");
        if (r) setActiveRooms(r.rooms);
      } else if (tName === "users") {
        const u = await call<{ users: AdminUser[] }>("admin/users");
        if (u) setUsers(u.users);
      } else if (tName === "invites") {
        const i = await call<{ invites: Invite[] }>("admin/invites");
        if (i) setInvites(i.invites);
      } else if (tName === "audit") {
        const a = await call<{ events: AuditEvent[] }>("admin/audit");
        if (a) setAudit(a.events);
      }
    },
    [token, call],
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ked.admin.token") || sessionStorage.getItem("ked.admin.token");
      if (saved) setToken(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    try {
      localStorage.setItem("ked.admin.token", token);
    } catch {
      /* ignore */
    }
    void (async () => {
      const meRes = await safeJson<{ username: string; role: string; error?: string }>("/api/ked/me", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!meRes || meRes.error) {
        setErr(lang === "hi" ? "सत्र समाप्त हो गया — कृपया पुनः लॉगिन करें।" : "Session expired — please log in again.");
        setToken("");
        try { localStorage.removeItem("ked.admin.token"); } catch {}
        return;
      }
      setMe(meRes);
      if (meRes.role !== "admin") {
        setErr(lang === "hi" ? "एडमिन अधिकार आवश्यक हैं।" : "Administrator role is required.");
        return;
      }
      await refresh("overview");
    })();
  }, [token, refresh, lang]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await refresh(tab);
    } finally {
      setBusy(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPass) return;
    setLoginBusy(true);
    setLoginErr(null);
    try {
      const res = await safeJson<{ ok?: boolean; token?: string; error?: string }>("/api/ked/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: loginEmail, pass: loginPass }),
      });
      if (res?.ok && res.token) {
        setToken(res.token);
        try {
          localStorage.setItem("ked.admin.token", res.token);
        } catch {}
      } else {
        setLoginErr(res?.error ?? (lang === "hi" ? "अमान्य ईमेल या पासवर्ड।" : "Invalid admin email or password."));
      }
    } catch {
      setLoginErr(lang === "hi" ? "सर्वर से कनेक्ट करने में त्रुटि।" : "Connection error to relay server.");
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = () => {
    setToken("");
    setMe(null);
    try {
      localStorage.removeItem("ked.admin.token");
      sessionStorage.removeItem("ked.admin.token");
    } catch {}
  };

  // 1-step direct login screen
  if (!token || !me || me.role !== "admin")
    return (
      <div className="shell scroll">
        <header className="row justify-between border-b border-[var(--line)] px-5 py-3">
          <div className="row gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--line-strong)] bg-[rgba(79,240,182,.12)] text-[var(--acc)]">
              <Icon name="shield" size={17} />
            </span>
            <span className="text-[14px] font-bold">{t("appName")} · {t("admin")}</span>
          </div>
          <div className="row gap-2">
            <button
              className="btn btn-sm"
              onClick={() => {
                const nextLang: Lang = lang === "en" ? "hi" : "en";
                setLang(nextLang);
                try { localStorage.setItem("ked.lang", nextLang); } catch {}
              }}
            >
              {lang === "en" ? "हिन्दी" : "English"}
            </button>
            <a className="btn btn-sm" href="/">
              <Icon name="chevron" size={13} className="rotate-180" /> {lang === "hi" ? "मुख्य पृष्ठ" : "Back to App"}
            </a>
          </div>
        </header>

        <div className="mx-auto grid min-h-[calc(100dvh-60px)] max-w-[440px] place-content-center gap-4 px-5 py-8">
          <div className="panel relative p-6 sm:p-8">
            <span className="glowline" />
            <div className="row gap-2.5 text-[var(--acc)]">
              <Icon name="shield" size={22} />
              <span className="text-[17px] font-bold text-[var(--ink)]">{t("adminTitle")}</span>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--ink-dim)]">
              {t("adminDesc")}
            </p>

            <form onSubmit={handleAdminLogin} className="mt-5 grid gap-3">
              <div>
                <label className="kicker mb-1 block">{t("adminEmail")}</label>
                <input
                  className="input mono"
                  type="email"
                  placeholder="admin@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value.trim())}
                  required
                />
              </div>
              <div>
                <label className="kicker mb-1 block">{t("adminPassword")}</label>
                <input
                  className="input mono"
                  type="password"
                  placeholder="••••••••••••"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  required
                />
              </div>

              {loginErr ? (
                <div className="row items-center gap-2 rounded-xl border border-[rgba(255,107,122,.4)] bg-[rgba(255,107,122,.1)] p-3 text-[12px] text-[#ffc2c9]">
                  <Icon name="alert" size={14} />
                  <span>{loginErr}</span>
                </div>
              ) : null}

              <button
                type="submit"
                className="btn btn-primary mt-2 w-full justify-center py-3"
                disabled={loginBusy || !loginEmail || !loginPass}
              >
                {loginBusy ? (
                  <>
                    <Icon name="refresh" size={15} className="animate-spin" /> {t("loading")}
                  </>
                ) : (
                  <>
                    <Icon name="lock" size={15} /> {t("adminLoginBtn")}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );

  return (
    <div className="shell scroll">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[rgba(5,7,12,.88)] backdrop-blur-xl">
        <div className="mx-auto row max-w-[1200px] flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <div className="row gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--line-strong)] bg-[rgba(79,240,182,.12)] text-[var(--acc)]">
              <Icon name="shield" size={16} />
            </span>
            <div>
              <div className="text-[13.5px] font-bold tracking-tight">
                {t("appName")} <span className="kicker ml-1">/ {t("admin")}</span>
              </div>
              <div className="mono text-[9.5px] text-[var(--ink-faint)]">@{me.username} · role=admin</div>
            </div>
          </div>
          <div className="row flex-wrap gap-1.5">
            {(["overview", "rooms", "users", "invites", "broadcast", "audit"] as Tab[]).map((tTab) => (
              <button
                key={tTab}
                onClick={() => {
                  setTab(tTab);
                  void refresh(tTab);
                }}
                className={`mono rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                  tab === tTab ? "bg-white/10 text-[var(--ink)]" : "text-[var(--ink-faint)] hover:bg-white/5"
                }`}
              >
                {tTab === "overview" && t("adminTabOverview")}
                {tTab === "rooms" && t("adminTabRooms")}
                {tTab === "users" && t("adminTabUsers")}
                {tTab === "invites" && t("adminTabInvites")}
                {tTab === "broadcast" && t("adminTabNotice")}
                {tTab === "audit" && t("adminTabAudit")}
              </button>
            ))}
            <button
              className="btn btn-sm"
              onClick={() => {
                const nextLang: Lang = lang === "en" ? "hi" : "en";
                setLang(nextLang);
                try { localStorage.setItem("ked.lang", nextLang); } catch {}
              }}
            >
              {lang === "en" ? "हिन्दी" : "English"}
            </button>
            <a className="btn btn-sm" href="/">
              <Icon name="chevron" size={12} className="rotate-180" /> App
            </a>
            <button className="btn btn-sm btn-danger" onClick={handleLogout} title="Logout admin">
              <Icon name="x" size={12} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1200px] gap-4 px-4 py-5">
        {err ? (
          <div className="row items-center gap-2 rounded-xl border border-[rgba(255,107,122,.4)] bg-[rgba(255,107,122,.1)] px-3 py-2.5 text-[12px] text-[#ffc2c9]">
            <Icon name="alert" size={14} /> {err}
          </div>
        ) : null}

        {tab === "overview" ? (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {counts
                ? ([
                    [lang === "hi" ? "पंजीकृत पहचान" : "Identities", counts.users],
                    [lang === "hi" ? "निलंबित खाते" : "Suspended", counts.blocked],
                    [lang === "hi" ? "सक्रिय रूम" : "Active Rooms", counts.rooms],
                    [lang === "hi" ? "एन्क्रिप्टेड संदेश" : "Ciphertext Rows", counts.ciphertextRows],
                    [lang === "hi" ? "सक्रिय इनवाइट" : "Live Invites", counts.invites],
                    [lang === "hi" ? "सत्र संख्या" : "Active Sessions", counts.activeSessions],
                  ] as [string, number][]).map(([k, v]) => (
                    <div key={k} className="panel p-3">
                      <div className="kicker">{k}</div>
                      <div className="mono mt-1 text-[22px] font-semibold text-[var(--ink)]">{v}</div>
                    </div>
                  ))
                : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="panel p-4">
                <div className="kicker mb-2">{lang === "hi" ? "सुरक्षा सिद्धांत (Zero-Knowledge Invariants)" : "Invariants (Blind Relay)"}</div>
                <KV k={t("invariant1")} v={t("invariant1Val")} tone="good" />
                <KV k={t("invariant2")} v={t("invariant2Val")} tone="good" />
                <KV k={t("invariant3")} v={t("invariant3Val")} tone="good" />
                <KV k={lang === "hi" ? "एडमिन संदेश पढ़ सकता है" : "Admin can read messages"} v={lang === "hi" ? "नहीं — गणितीय रूप से असंभव" : "NO — Cryptographically impossible"} tone="good" />
              </div>
              <div className="panel p-4">
                <div className="kicker mb-2">{t("systemNotice")}</div>
                {notice ? (
                  <div className={`rounded-lg border px-3 py-2 text-[12px] ${notice.level === "critical" ? "border-[rgba(255,107,122,.4)] text-[#ffc2c9]" : notice.level === "warn" ? "border-[rgba(255,190,85,.4)] text-[#ffdca6]" : "border-[var(--line)] text-[var(--ink-dim)]"}`}>
                    {notice.body}
                  </div>
                ) : (
                  <p className="mono text-[11px] text-[var(--ink-faint)]">{lang === "hi" ? "कोई सक्रिय सूचना नहीं" : "No active system notice"}</p>
                )}
                <p className="mono mt-2 text-[10px] leading-relaxed text-[var(--ink-faint)]">
                  {lang === "hi" ? "यह सूचना सभी उपयोगकर्ताओं को शीर्ष पर दिखाई देती है।" : "This broadcast banner is visible to all active visitors on the application."}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "rooms" ? (
          <div className="panel overflow-x-auto p-4">
            <div className="row justify-between pb-3">
              <span className="kicker">{lang === "hi" ? "लाइव अस्थायी रूम (30 मिनट ऑटो-बर्न)" : "Live Ephemeral Rooms (Auto-destruct)"}</span>
              <button className="btn btn-sm" onClick={() => void refresh("rooms")}>
                <Icon name="refresh" size={12} /> {lang === "hi" ? "रिफ्रेश करें" : "Refresh"}
              </button>
            </div>
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  {["Room ID", "Type", "Members", "Created At", "Expires At", "Actions"].map((h) => (
                    <th key={h} className="kicker px-3 py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeRooms.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="mono px-3 py-2 text-[12px] font-semibold text-[var(--acc)]">
                      {r.id.slice(0, 16)}…
                    </td>
                    <td className="px-3 py-2">
                      <Chip tone="acc">{r.type}</Chip>
                    </td>
                    <td className="mono px-3 py-2 text-[11.5px]">
                      {r.membersCount} {r.maxUsers ? `/ ${r.maxUsers}` : ""}
                    </td>
                    <td className="mono px-3 py-2 text-[10.5px] text-[var(--ink-faint)]">
                      {new Date(r.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="mono px-3 py-2 text-[10.5px] text-[var(--warn)]">
                      {r.expiresAt ? new Date(r.expiresAt).toLocaleTimeString() : (r.defaultTtl ? `${Math.round(r.defaultTtl / 60000)}m` : "—")}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        className="btn btn-sm btn-danger"
                        disabled={busy}
                        onClick={() => setConfirmBurnRoom(r.id)}
                      >
                        <Icon name="flame" size={12} /> {t("terminateRoom")}
                      </button>
                    </td>
                  </tr>
                ))}
                {activeRooms.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-[12px] text-[var(--ink-faint)]" colSpan={6}>
                      {lang === "hi" ? "कोई सक्रिय रूम नहीं है।" : "No active ephemeral rooms currently running."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === "users" ? (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  {["Handle", "Role", "Status", "Sessions", "Prekeys Left", "Created", "Last Seen", "Actions"].map((h) => (
                    <th key={h} className="kicker px-3 py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-3 py-2">
                      <div className="text-[12.5px] font-semibold">@{u.username}</div>
                      <div className="mono text-[9.5px] text-[var(--ink-faint)]">{u.fingerprint}…</div>
                    </td>
                    <td className="px-3 py-2">
                      <Chip tone={u.role === "admin" ? "acc" : ""}>{u.role}</Chip>
                    </td>
                    <td className="px-3 py-2">
                      <Chip tone={u.blocked ? "bad" : "good"}>{u.blocked ? "Suspended" : "Active"}</Chip>
                    </td>
                    <td className="mono px-3 py-2 text-[11.5px]">{u.sessions}</td>
                    <td className="mono px-3 py-2 text-[11.5px]">{u.opkLeft}</td>
                    <td className="mono px-3 py-2 text-[10.5px] text-[var(--ink-faint)]">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="mono px-3 py-2 text-[10.5px] text-[var(--ink-faint)]">
                      {u.lastSeen ? new Date(u.lastSeen).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="row flex-wrap gap-1">
                        {u.blocked ? (
                          <button className="btn btn-sm" disabled={busy} onClick={() => void act(() => call("admin/user", { method: "POST", body: JSON.stringify({ id: u.id, action: "unblock" }) }))}>
                            Unblock
                          </button>
                        ) : (
                          <button className="btn btn-sm" disabled={busy} onClick={() => void act(() => call("admin/user", { method: "POST", body: JSON.stringify({ id: u.id, action: "block" }) }))}>
                            Block
                          </button>
                        )}
                        {u.role === "admin" ? (
                          <button className="btn btn-sm" disabled={busy} onClick={() => void act(() => call("admin/user", { method: "POST", body: JSON.stringify({ id: u.id, action: "demote" }) }))}>
                            Demote
                          </button>
                        ) : (
                          <button className="btn btn-sm" disabled={busy} onClick={() => void act(() => call("admin/user", { method: "POST", body: JSON.stringify({ id: u.id, action: "promote" }) }))}>
                            Promote
                          </button>
                        )}
                        <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => setConfirmPurge(u)}>
                          Purge
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-[12px] text-[var(--ink-faint)]" colSpan={8}>
                      {lang === "hi" ? "कोई पहचान पंजीकृत नहीं है।" : "No registered vault identities found."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === "invites" ? (
          <div className="grid gap-4">
            <div className="panel p-4">
              <div className="kicker mb-2">{lang === "hi" ? "नया इनवाइट कोड बनाएं" : "Create New Invite"}</div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
                <input className="input" placeholder="Label, e.g. 'Team member'" value={inviteLabel} onChange={(e) => setInviteLabel(e.target.value.slice(0, 60))} />
                <select className="input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                </select>
                <input className="input mono" type="number" min={1} max={100} value={inviteUses} onChange={(e) => setInviteUses(Math.max(1, Math.min(100, Number(e.target.value))))} title="Max uses" />
                <input className="input mono" type="number" min={0} max={365} value={inviteDays} onChange={(e) => setInviteDays(Math.max(0, Math.min(365, Number(e.target.value))))} title="Expiry days (0 = never)" />
                <button
                  className="btn btn-primary justify-center"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      const r = await call<{ code: string }>("admin/invites", {
                        method: "POST",
                        body: JSON.stringify({ create: true, label: inviteLabel, role: inviteRole, maxUses: inviteUses, expiresInDays: inviteDays }),
                      });
                      if (r?.code) {
                        setNewCode(r.code);
                        setInviteLabel("");
                      }
                    })
                  }
                >
                  Create
                </button>
              </div>
              {newCode ? (
                <div className="mt-3 rounded-xl border border-[rgba(79,240,182,.4)] bg-[rgba(79,240,182,.08)] p-3">
                  <div className="kicker !text-[#a9ffe2]">{lang === "hi" ? "इनवाइट कोड (कृपया सुरक्षित रखें)" : "Generated Invite Code"}</div>
                  <div className="mono mt-1.5 break-all text-[12.5px] text-[#a9ffe2]">{newCode}</div>
                  <div className="row mt-2 gap-2">
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        void navigator.clipboard.writeText(newCode);
                        setNewCode(null);
                      }}
                    >
                      <Icon name="copy" size={12} /> {lang === "hi" ? "कॉपी करें" : "Copy & Dismiss"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="panel overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--line)]">
                    {["Label", "Role", "Uses", "Expires", "Created", "Status", ""].map((h) => (
                      <th key={h} className="kicker px-3 py-2 font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invites.map((i) => (
                    <tr key={i.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="px-3 py-2 text-[12.5px]">{i.label ?? <span className="text-[var(--ink-faint)]">—</span>}</td>
                      <td className="px-3 py-2">
                        <Chip tone={i.role === "admin" ? "acc" : ""}>{i.role}</Chip>
                      </td>
                      <td className="mono px-3 py-2 text-[11.5px]">
                        {i.uses}/{i.maxUses}
                      </td>
                      <td className="mono px-3 py-2 text-[10.5px] text-[var(--ink-faint)]">
                        {i.expiresAt ? new Date(i.expiresAt).toLocaleDateString() : "never"}
                      </td>
                      <td className="mono px-3 py-2 text-[10.5px] text-[var(--ink-faint)]">{new Date(i.createdAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2">
                        <Chip tone={i.revokedAt ? "bad" : i.uses >= i.maxUses ? "warn" : "good"}>
                          {i.revokedAt ? "revoked" : i.uses >= i.maxUses ? "used up" : "live"}
                        </Chip>
                      </td>
                      <td className="px-3 py-2">
                        {!i.revokedAt ? (
                          <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => void act(() => call("admin/invites", { method: "POST", body: JSON.stringify({ revoke: i.id }) }))}>
                            Revoke
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {invites.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-[12px] text-[var(--ink-faint)]" colSpan={7}>
                        {lang === "hi" ? "कोई इनवाइट कोड मौजूद नहीं है।" : "No invite codes created yet."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === "broadcast" ? (
          <div className="panel p-4">
            <div className="kicker mb-2">{t("systemNotice")}</div>
            <textarea
              className="input"
              rows={4}
              placeholder={lang === "hi" ? "सिस्टम सूचना लिखें..." : "Enter system announcement..."}
              value={broadcast}
              onChange={(e) => setBroadcast(e.target.value.slice(0, 400))}
            />
            <div className="row mt-2 flex-wrap gap-1.5">
              {["info", "warn", "critical"].map((l) => (
                <button key={l} className={`chip ${level === l ? "!border-[rgba(79,240,182,.5)] !text-[#a9ffe2]" : ""}`} onClick={() => setLevel(l)}>
                  {l}
                </button>
              ))}
              <span className="flex-1" />
              <span className="mono text-[10px] text-[var(--ink-faint)]">{broadcast.length}/400</span>
            </div>
            <div className="row mt-3 gap-2">
              <button
                className="btn btn-primary flex-1 justify-center"
                disabled={busy || !broadcast.trim()}
                onClick={() =>
                  void act(async () => {
                    await call("admin/notice", { method: "POST", body: JSON.stringify({ body: broadcast, level }) });
                    setBroadcast("");
                  })
                }
              >
                <Icon name="globe" size={13} /> {t("publishNotice")}
              </button>
              <button className="btn flex-1 justify-center" disabled={busy} onClick={() => void act(() => call("admin/notice", { method: "POST", body: JSON.stringify({ clear: true }) }))}>
                {t("clearNotice")}
              </button>
            </div>
          </div>
        ) : null}

        {tab === "audit" ? (
          <div className="panel p-4">
            <div className="row justify-between">
              <span className="kicker">{lang === "hi" ? "सुरक्षा ऑडिट लॉग" : "Relay Audit Log"}</span>
              <Chip>{audit.length}</Chip>
            </div>
            <div className="mt-3 grid gap-1.5">
              {audit.map((e, i) => (
                <div key={i} className="row items-start justify-between gap-3 border-b border-[var(--line)] pb-1.5 last:border-0">
                  <span className="mono min-w-0 break-all text-[10.5px] text-[var(--ink-dim)]">
                    <span className={e.event.includes("fail") || e.event.includes("purge") || e.event.includes("blocked") ? "text-[var(--danger)]" : "text-[var(--acc-2)]"}>{e.event}</span>{" "}
                    {e.userId ? <span className="text-[var(--ink-faint)]">{e.userId.slice(0, 10)}</span> : null} {e.detail ?? ""}
                  </span>
                  <span className="mono flex-none text-[9.5px] text-[var(--ink-faint)]">{new Date(e.createdAt).toLocaleString()}</span>
                </div>
              ))}
              {audit.length === 0 ? <p className="mono py-4 text-[11px] text-[var(--ink-faint)]">Empty</p> : null}
            </div>
          </div>
        ) : null}
      </main>

      <Modal open={!!confirmBurnRoom} onClose={() => setConfirmBurnRoom(null)} title={lang === "hi" ? "रूम तुरंत नष्ट करें?" : "Terminate Room Immediately?"} icon="flame">
        <p className="text-[13px] leading-relaxed text-[var(--ink-dim)]">
          {lang === "hi"
            ? "यह रूम और इसके सभी संदेश सर्वर और रिले से तुरंत हटा दिए जाएंगे।"
            : "All messages in this room will be immediately shredded and zeroed on the relay."}
        </p>
        <div className="mt-4 row gap-2">
          <button className="btn flex-1 justify-center" onClick={() => setConfirmBurnRoom(null)}>
            {t("cancel")}
          </button>
          <button
            className="btn btn-danger flex-1 justify-center"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                if (confirmBurnRoom) await call("admin/room/terminate", { method: "POST", body: JSON.stringify({ roomId: confirmBurnRoom }) });
                setConfirmBurnRoom(null);
              })
            }
          >
            <Icon name="flame" size={13} /> {t("terminateRoom")}
          </button>
        </div>
      </Modal>

      <Modal open={!!confirmPurge} onClose={() => setConfirmPurge(null)} title={`Purge @${confirmPurge?.username ?? ""}?`} icon="flame">
        <p className="text-[13px] leading-relaxed text-[var(--ink-dim)]">
          {lang === "hi"
            ? "इस उपयोगकर्ता के सभी रिकॉर्ड, चाबियां और सत्र स्थायी रूप से मिटा दिए जाएंगे।"
            : "All cryptographic material, public keys, and sessions for this identity will be purged permanently."}
        </p>
        <div className="mt-4 row gap-2">
          <button className="btn flex-1 justify-center" onClick={() => setConfirmPurge(null)}>
            {t("cancel")}
          </button>
          <button
            className="btn btn-danger flex-1 justify-center"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                if (confirmPurge) await call("admin/user", { method: "POST", body: JSON.stringify({ id: confirmPurge.id, action: "purge" }) });
                setConfirmPurge(null);
              })
            }
          >
            <Icon name="trash" size={13} /> {t("confirm")}
          </button>
        </div>
      </Modal>
    </div>
  );
}

