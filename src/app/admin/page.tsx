"use client";

import { useCallback, useEffect, useState } from "react";
import { Chip, Icon, KV, Modal } from "@/components/ui";
import { safeJson } from "@/lib/safeFetch";

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

type Tab = "overview" | "users" | "invites" | "broadcast" | "audit";

export default function Admin() {
  const [token, setToken] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [counts, setCounts] = useState<Counts | null>(null);
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

  const call = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T | null> => {
      setErr(null);
      const res = await safeJson<T>(`/api/ked/${path}`, {
        ...init,
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) },
      });
      if (res === null) setErr(`relay ne ${path} par JSON nahi diya (auth ya DB issue)`);
      else if ((res as { error?: string }).error) setErr((res as { error?: string }).error!);
      return res;
    },
    [token],
  );

  const refresh = useCallback(
    async (t: Tab) => {
      if (!token) return;
      if (t === "overview") {
        const o = await call<{ counts: Counts; notice: { body: string; level: string } | null; inviteOnly: boolean }>("admin/overview");
        if (o) {
          setCounts(o.counts);
          setNotice(o.notice);
        }
      } else if (t === "users") {
        const u = await call<{ users: AdminUser[] }>("admin/users");
        if (u) setUsers(u.users);
      } else if (t === "invites") {
        const i = await call<{ invites: Invite[] }>("admin/invites");
        if (i) setInvites(i.invites);
      } else if (t === "audit") {
        const a = await call<{ events: AuditEvent[] }>("admin/audit");
        if (a) setAudit(a.events);
      }
    },
    [token, call],
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ked.admin.token");
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
        setErr("token rejected — log in again as an admin identity");
        return;
      }
      setMe(meRes);
      if (meRes.role !== "admin") {
        setErr(`@${meRes.username} ka role "${meRes.role}" hai — admin panel ke liye admin invite chahiye`);
        return;
      }
      await refresh("overview");
    })();
  }, [token, refresh]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await refresh(tab);
    } finally {
      setBusy(false);
    }
  };

  if (!token || !me)
    return (
      <div className="shell scroll">
        <div className="mx-auto grid min-h-[100dvh] max-w-[460px] place-content-center gap-4 px-5">
          <div className="panel relative p-6">
            <span className="glowline" />
            <div className="row gap-2.5 text-[var(--acc)]">
              <Icon name="shield" size={18} />
              <span className="text-[15px] font-bold text-[var(--ink)]">Admin console</span>
            </div>
            <p className="mono mt-2.5 text-[11px] leading-relaxed text-[var(--ink-dim)]">
              Ye route publicly linked nahi hai. Kisi <b>admin invite</b> se banayi gayi identity ka bearer token chahiye. Token sirf isi
              browser ke localStorage mein rehta hai aur relay par plaintext store nahi hota (sirf SHA-256 hash).
            </p>
            <input className="input mono mt-4" placeholder="bearer token" value={token} onChange={(e) => setToken(e.target.value.trim())} />
            {err ? <div className="mono mt-2.5 text-[11px] leading-relaxed text-[#ffc2c9]">{err}</div> : null}
            <div className="row mt-4 gap-2">
              <a className="btn flex-1 justify-center" href="/">
                <Icon name="chevron" size={13} className="rotate-180" /> App
              </a>
              <button className="btn btn-primary flex-1 justify-center" onClick={() => setTab("overview")} disabled={!token || !!me}>
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    );

  if (me.role !== "admin")
    return (
      <div className="shell scroll">
        <div className="mx-auto grid min-h-[100dvh] max-w-[520px] place-content-center gap-4 px-5">
          <div className="panel p-6">
            <div className="row gap-2 text-[var(--danger)]">
              <Icon name="alert" size={18} />
              <span className="text-[15px] font-bold text-[var(--ink)]">Forbidden (403)</span>
            </div>
            <p className="mono mt-2.5 text-[11.5px] leading-relaxed text-[var(--ink-dim)]">{err}</p>
            <p className="mono mt-2 text-[10.5px] leading-relaxed text-[var(--ink-faint)]">
              Admin banne ke liye: operator se <b>role=admin</b> wala invite lo → us invite se nayi identity banao → yahan wahan ka token
              paste karo. RBAC relay par enforce hota hai, sirf UI par nahi.
            </p>
            <a className="btn mt-4 w-full justify-center" href="/">
              <Icon name="chevron" size={13} className="rotate-180" /> Wapas app
            </a>
          </div>
        </div>
      </div>
    );

  return (
    <div className="shell scroll">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[rgba(5,7,12,.85)] backdrop-blur-xl">
        <div className="mx-auto row max-w-[1200px] flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <div className="row gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--line-strong)] bg-[rgba(79,240,182,.12)] text-[var(--acc)]">
              <Icon name="shield" size={16} />
            </span>
            <div>
              <div className="text-[13.5px] font-bold tracking-tight">
                KED<span className="text-[var(--acc)]">·</span>VAULT <span className="kicker ml-1">/ admin</span>
              </div>
              <div className="mono text-[9.5px] text-[var(--ink-faint)]">@{me.username} · role=admin</div>
            </div>
          </div>
          <div className="row flex-wrap gap-1.5">
            {(["overview", "users", "invites", "broadcast", "audit"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  void refresh(t);
                }}
                className={`mono rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                  tab === t ? "bg-white/10 text-[var(--ink)]" : "text-[var(--ink-faint)] hover:bg-white/5"
                }`}
              >
                {t}
              </button>
            ))}
            <a className="btn btn-sm" href="/">
              <Icon name="chevron" size={12} className="rotate-180" /> App
            </a>
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
                    ["identities", counts.users, "users"],
                    ["suspended", counts.blocked, "blocked"],
                    ["rooms", counts.rooms, "rooms"],
                    ["ciphertext rows", counts.ciphertextRows, "ciphertextRows"],
                    ["live invites", counts.invites, "invites"],
                    ["sessions", counts.activeSessions, "activeSessions"],
                  ] as [string, number, string][]).map(([k, v]) => (
                    <div key={k} className="panel p-3">
                      <div className="kicker">{k}</div>
                      <div className="mono mt-1 text-[22px] font-semibold text-[var(--ink)]">{v}</div>
                    </div>
                  ))
                : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="panel p-4">
                <div className="kicker mb-2">invariants (blind relay)</div>
                <KV k="plaintext message rows" v="0" tone="good" />
                <KV k="raw private keys in DB" v="0" tone="good" />
                <KV k="message content in logs" v="none" tone="good" />
                <KV k="admin can read chats" v="NO — cryptographically impossible" tone="good" />
                <KV k="admin CAN see" v="usernames, sizes, timestamps, room graph" tone="warn" />
              </div>
              <div className="panel p-4">
                <div className="kicker mb-2">system notice</div>
                {notice ? (
                  <div className={`rounded-lg border px-3 py-2 text-[12px] ${notice.level === "critical" ? "border-[rgba(255,107,122,.4)] text-[#ffc2c9]" : notice.level === "warn" ? "border-[rgba(255,190,85,.4)] text-[#ffdca6]" : "border-[var(--line)] text-[var(--ink-dim)]"}`}>
                    {notice.body}
                  </div>
                ) : (
                  <p className="mono text-[11px] text-[var(--ink-faint)]">no active notice</p>
                )}
                <p className="mono mt-2 text-[10px] leading-relaxed text-[var(--ink-faint)]">
                  Notice <b>plaintext</b> hai — ye jaan-boojh kar server-side rakha jata hai aur clearly &quot;SYSTEM, not E2EE&quot;
                  flag ke saath dikhta hai.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "users" ? (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  {["handle", "role", "state", "sessions", "opk left", "created", "last seen", "actions"].map((h) => (
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
                      <Chip tone={u.blocked ? "bad" : "good"}>{u.blocked ? "suspended" : "active"}</Chip>
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
                            unblock
                          </button>
                        ) : (
                          <button className="btn btn-sm" disabled={busy} onClick={() => void act(() => call("admin/user", { method: "POST", body: JSON.stringify({ id: u.id, action: "block" }) }))}>
                            block
                          </button>
                        )}
                        {u.role === "admin" ? (
                          <button className="btn btn-sm" disabled={busy} onClick={() => void act(() => call("admin/user", { method: "POST", body: JSON.stringify({ id: u.id, action: "demote" }) }))}>
                            demote
                          </button>
                        ) : (
                          <button className="btn btn-sm" disabled={busy} onClick={() => void act(() => call("admin/user", { method: "POST", body: JSON.stringify({ id: u.id, action: "promote" }) }))}>
                            promote
                          </button>
                        )}
                        <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => setConfirmPurge(u)}>
                          purge
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-[12px] text-[var(--ink-faint)]" colSpan={8}>
                      koi identity nahi
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
              <div className="kicker mb-2">naya invite banao</div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
                <input className="input" placeholder="label (e.g. 'for ali')" value={inviteLabel} onChange={(e) => setInviteLabel(e.target.value.slice(0, 60))} />
                <select className="input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                </select>
                <input className="input mono" type="number" min={1} max={100} value={inviteUses} onChange={(e) => setInviteUses(Math.max(1, Math.min(100, Number(e.target.value))))} title="max uses" />
                <input className="input mono" type="number" min={0} max={365} value={inviteDays} onChange={(e) => setInviteDays(Math.max(0, Math.min(365, Number(e.target.value))))} title="expiry days (0 = never)" />
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
                  create
                </button>
              </div>
              {newCode ? (
                <div className="mt-3 rounded-xl border border-[rgba(79,240,182,.4)] bg-[rgba(79,240,182,.08)] p-3">
                  <div className="kicker !text-[#a9ffe2]">raw invite code — abhi copy karo, dobara kabhi nahi dikhega</div>
                  <div className="mono mt-1.5 break-all text-[12.5px] text-[#a9ffe2]">{newCode}</div>
                  <div className="mono mt-1.5 text-[10px] text-[var(--ink-faint)]">
                    share link: <b>/?invite={newCode}</b> · relay par sirf SHA-256(code) store hota hai
                  </div>
                  <div className="row mt-2 gap-2">
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        void navigator.clipboard.writeText(newCode);
                        setNewCode(null);
                      }}
                    >
                      <Icon name="copy" size={12} /> copy & dismiss
                    </button>
                    <a className="btn btn-sm" href={`/?invite=${newCode}`} target="_blank" rel="noreferrer">
                      <Icon name="spark" size={12} /> open signup link
                    </a>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="panel overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--line)]">
                    {["label", "role", "uses", "expires", "created", "state", ""].map((h) => (
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
                            revoke
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {invites.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-[12px] text-[var(--ink-faint)]" colSpan={7}>
                        koi invite nahi — pehla banao
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
            <div className="kicker mb-2">system notice broadcast</div>
            <textarea className="input" rows={4} placeholder="e.g. Server maintenance kal 2-4 AM IST. Messages queue ho jayenge." value={broadcast} onChange={(e) => setBroadcast(e.target.value.slice(0, 400))} />
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
                <Icon name="globe" size={13} /> publish to all users
              </button>
              <button className="btn flex-1 justify-center" disabled={busy} onClick={() => void act(() => call("admin/notice", { method: "POST", body: JSON.stringify({ clear: true }) }))}>
                clear notice
              </button>
            </div>
            <p className="mono mt-3 text-[10.5px] leading-relaxed text-[var(--ink-faint)]">
              ⚠️ Ye broadcast <b>end-to-end encrypted NAHI</b> hai — server jaanta hai. Isliye isme kabhi bhi sensitive content mat
              likho; sirf operational notices (maintenance, policy change, emergency wipe warning).
            </p>
          </div>
        ) : null}

        {tab === "audit" ? (
          <div className="panel p-4">
            <div className="row justify-between">
              <span className="kicker">relay audit trail (content-free)</span>
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
              {audit.length === 0 ? <p className="mono py-4 text-[11px] text-[var(--ink-faint)]">empty</p> : null}
            </div>
          </div>
        ) : null}
      </main>

      <Modal open={!!confirmPurge} onClose={() => setConfirmPurge(null)} title={`Purge @${confirmPurge?.username ?? ""}?`} icon="flame">
        <p className="text-[13px] leading-relaxed text-[var(--ink-dim)]">
          Ye <b>crypto-shredding</b> hai: us user ke sab rooms aur messages par relay <code>body=NULL</code> kar dega, sessions revoke
          honge, public keys drop honge. Kyunki plaintext pehle se kahin nahi tha, wapas aane ka koi rasta nahi — user ka khud ka
          encrypted vault bhi blank ho jayega.
        </p>
        <p className="mono mt-2 text-[10.5px] text-[var(--warn)]">
          Aap khud ko purge nahi kar sakte (lockout se bachne ke liye). Ye action audit log mein jaata hai.
        </p>
        <div className="mt-4 row gap-2">
          <button className="btn flex-1 justify-center" onClick={() => setConfirmPurge(null)}>
            cancel
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
            <Icon name="trash" size={13} /> confirm purge
          </button>
        </div>
      </Modal>
    </div>
  );
}
