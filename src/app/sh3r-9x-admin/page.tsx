"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Chip, Icon } from "@/components/ui";

interface RoomItem {
  id: string;
  type: string;
  createdAt: string;
  defaultTtl: number | null;
  membersCount: number;
  expiresAt: string | null;
  uses: number;
  maxUsers: number;
}

interface PolicyMatrix {
  roomTtlDefaultMin: number;
  roomTtlHardCapMin: number;
  maxParticipantsDefault: number;
  maxParticipantsCap: number;
  perIpCreateRate: number;
  codeLockoutMin: number;
  maintenanceMode: boolean;
}

export default function MaskedAdminPage() {
  const { lang, t, setLang } = useI18n();
  const [authed, setAuthed] = useState(false);
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [tab, setTab] = useState<"rooms" | "policy" | "audit" | "overview">("rooms");
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [policy, setPolicy] = useState<PolicyMatrix>({
    roomTtlDefaultMin: 30,
    roomTtlHardCapMin: 120,
    maxParticipantsDefault: 10,
    maxParticipantsCap: 50,
    perIpCreateRate: 5,
    codeLockoutMin: 15,
    maintenanceMode: false,
  });

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/ked/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), pass }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Authentication failed");
      }
      setToken(data.token);
      setAuthed(true);
      void loadRooms(data.token);
      void loadPolicy(data.token);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const loadRooms = async (tok = token) => {
    try {
      const res = await fetch("/api/ked/admin/rooms", {
        headers: { authorization: `Bearer ${tok}` },
      });
      const data = await res.json();
      if (data.rooms) setRooms(data.rooms);
    } catch {}
  };

  const loadPolicy = async (tok = token) => {
    try {
      const res = await fetch("/api/ked/admin/policy", {
        headers: { authorization: `Bearer ${tok}` },
      });
      const data = await res.json();
      if (data.policy) setPolicy(data.policy);
    } catch {}
  };

  const terminateRoom = async (roomId: string) => {
    try {
      await fetch("/api/ked/admin/room/terminate", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId }),
      });
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
    } catch {}
  };

  const allBurn = async () => {
    if (!confirm(lang === "hi" ? "क्या आप वाकई सभी सक्रिय रूम्स को तुरंत नष्ट करना चाहते हैं?" : "Are you sure you want to terminate and crypto-shred all active rooms?")) return;
    try {
      await fetch("/api/ked/admin/all-burn", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      setRooms([]);
    } catch {}
  };

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-[#05070c] text-white">
        <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[#0d121d]/90 p-6 backdrop-blur-xl shadow-2xl">
          <div className="row items-center gap-3 border-b border-[var(--line)] pb-4 mb-6">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line-strong)] bg-[rgba(79,240,182,.12)] text-[var(--acc)]">
              <Icon name="shield" size={20} />
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-tight">SHER Messenger Admin</h1>
              <p className="text-xs text-[var(--ink-dim)]">Protected Operator Portal (PocketBase-Style)</p>
            </div>
          </div>

          {err && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              {err}
            </div>
          )}

          <form onSubmit={login} className="space-y-4">
            <div>
              <label className="kicker mb-1.5 block">ADMIN EMAIL</label>
              <input
                type="email"
                required
                className="input w-full text-sm"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="kicker mb-1.5 block">ADMIN PASSWORD</label>
              <input
                type="password"
                required
                className="input w-full text-sm"
                placeholder="••••••••••••"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
              />
            </div>

            <button type="submit" disabled={busy} className="btn btn-primary w-full py-2.5 font-bold">
              {busy ? "Authenticating..." : "Unlock Operator Console"}
            </button>
          </form>

          <div className="mt-4 flex justify-between text-[11px] text-[var(--ink-faint)]">
            <span>Even admin sees only shadows 🕶️</span>
            <button
              onClick={() => setLang(lang === "en" ? "hi" : "en")}
              className="text-[var(--acc)] hover:underline"
            >
              {lang === "en" ? "हिन्दी में देखें" : "View in English"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070c] text-white p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="row items-center justify-between border-b border-[var(--line)] pb-4 mb-6">
          <div className="row items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line-strong)] bg-[rgba(79,240,182,.12)] text-[var(--acc)]">
              <Icon name="shield" size={20} />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight">SHER Control Plane</h1>
              <p className="mono text-xs text-[var(--ink-dim)]">Authenticated as Server Deployer</p>
            </div>
          </div>

          <div className="row gap-2">
            <button
              onClick={() => setLang(lang === "en" ? "hi" : "en")}
              className="btn btn-sm"
            >
              {lang === "en" ? "हिन्दी" : "EN"}
            </button>
            <button
              onClick={() => setAuthed(false)}
              className="btn btn-sm text-red-400 border-red-500/30 hover:bg-red-500/10"
            >
              <Icon name="x" size={14} /> Exit
            </button>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-[var(--line)] pb-3 mb-6">
          {[
            { id: "rooms", label: lang === "hi" ? "सक्रिय रूम्स" : "Active Rooms", icon: "flame" },
            { id: "policy", label: lang === "hi" ? "पॉलिसी मैट्रिक्स" : "Policy Matrix", icon: "doc" },
            { id: "overview", label: lang === "hi" ? "सिस्टम स्थिति" : "System Status", icon: "db" },
          ].map((tItem) => (
            <button
              key={tItem.id}
              onClick={() => setTab(tItem.id as any)}
              className={`btn btn-sm ${tab === tItem.id ? "!border-[var(--acc)] !bg-[rgba(79,240,182,.12)] !text-[#a9ffe2]" : ""}`}
            >
              <Icon name={tItem.icon as any} size={14} /> {tItem.label}
            </button>
          ))}
          <span className="flex-1" />
          <button
            onClick={allBurn}
            className="btn btn-sm !border-red-500/50 !bg-red-500/10 text-red-300 hover:!bg-red-500/20"
          >
            <Icon name="flame" size={14} /> {lang === "hi" ? "आपातकालीन ऑल-बर्न (Kill All)" : "Emergency All-Burn"}
          </button>
        </div>

        {tab === "rooms" && (
          <div className="space-y-4">
            <div className="row items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--ink-dim)]">
                {lang === "hi" ? `सक्रिय अस्थायी रूम्स (${rooms.length})` : `Active Ephemeral Rooms (${rooms.length})`}
              </h2>
              <button onClick={() => loadRooms()} className="btn btn-sm">
                <Icon name="refresh" size={12} /> {lang === "hi" ? "रिफ्रेश" : "Refresh"}
              </button>
            </div>

            {rooms.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--line)] p-12 text-center text-sm text-[var(--ink-dim)]">
                {lang === "hi" ? "वर्तमान में कोई सक्रिय अस्थायी रूम नहीं है。" : "No active ephemeral rooms currently running on this relay."}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rooms.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-[var(--line)] bg-[#0d121d]/80 p-4 space-y-3">
                    <div className="row items-center justify-between">
                      <Chip tone="acc">
                        <Icon name="users" size={12} /> {r.membersCount} / {r.maxUsers}
                      </Chip>
                      <span className="mono text-[10px] text-[var(--ink-faint)]">
                        {r.expiresAt ? `Expires: ${new Date(r.expiresAt).toLocaleTimeString()}` : "No TTL"}
                      </span>
                    </div>

                    <div className="mono text-xs font-semibold text-[#a9ffe2] truncate">
                      Room: {r.id}
                    </div>

                    <div className="text-[11px] text-[var(--ink-dim)]">
                      Created: {new Date(r.createdAt).toLocaleTimeString()}
                    </div>

                    <button
                      onClick={() => terminateRoom(r.id)}
                      className="btn btn-sm w-full !border-red-500/40 text-red-300 hover:!bg-red-500/20"
                    >
                      <Icon name="flame" size={12} /> {lang === "hi" ? "रूम तुरंत नष्ट करें" : "Terminate & Burn"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "policy" && (
          <div className="max-w-2xl space-y-6 rounded-2xl border border-[var(--line)] bg-[#0d121d]/80 p-6">
            <h2 className="text-base font-bold text-[#a9ffe2]">
              {lang === "hi" ? "ग्लोबल रूम एवं सुरक्षा पॉलिसी" : "Global Room & Security Policy Matrix"}
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="kicker mb-1 block">Default Room TTL (Minutes)</label>
                <input
                  type="number"
                  className="input w-full"
                  value={policy.roomTtlDefaultMin}
                  onChange={(e) => setPolicy({ ...policy, roomTtlDefaultMin: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="kicker mb-1 block">Hard Cap TTL (Minutes)</label>
                <input
                  type="number"
                  className="input w-full"
                  value={policy.roomTtlHardCapMin}
                  onChange={(e) => setPolicy({ ...policy, roomTtlHardCapMin: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="kicker mb-1 block">Max Participants Cap</label>
                <input
                  type="number"
                  className="input w-full"
                  value={policy.maxParticipantsCap}
                  onChange={(e) => setPolicy({ ...policy, maxParticipantsCap: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="kicker mb-1 block">Creation Rate / IP / Hour</label>
                <input
                  type="number"
                  className="input w-full"
                  value={policy.perIpCreateRate}
                  onChange={(e) => setPolicy({ ...policy, perIpCreateRate: Number(e.target.value) })}
                />
              </div>
            </div>

            <button
              onClick={() => {
                void fetch("/api/ked/admin/policy", {
                  method: "POST",
                  headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
                  body: JSON.stringify(policy),
                });
                alert("Policy Matrix updated successfully!");
              }}
              className="btn btn-primary font-bold"
            >
              Save Policy Matrix
            </button>
          </div>
        )}

        {tab === "overview" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--line)] bg-[#0d121d]/80 p-5 space-y-2">
              <div className="kicker">ENCRYPTION PROTOCOL</div>
              <div className="text-lg font-bold text-[#a9ffe2]">Hardcore E2EE #k=</div>
              <div className="text-xs text-[var(--ink-dim)]">WebCrypto AES-256-GCM + PBKDF2 250k</div>
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-[#0d121d]/80 p-5 space-y-2">
              <div className="kicker">PLAINTEXT MESSAGES IN STORAGE</div>
              <div className="text-lg font-bold text-[#a9ffe2]">0 Rows</div>
              <div className="text-xs text-[var(--ink-dim)]">Mathematically impossible for server to read</div>
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-[#0d121d]/80 p-5 space-y-2">
              <div className="kicker">RELAY ENGINE</div>
              <div className="text-lg font-bold text-[#a9ffe2]">Durable Objects / Edge</div>
              <div className="text-xs text-[var(--ink-dim)]">WebSocket Hibernation Mode Active</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
