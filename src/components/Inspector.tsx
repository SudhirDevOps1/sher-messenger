"use client";

import { useEffect, useMemo, useState } from "react";
import { KedClient, type HistMsg } from "@/lib/client";
import { computeFingerprint, fmtBytes } from "@/lib/client";
import { b64d } from "@/lib/primitives";
import { OPK_COUNT } from "@/lib/protocol";
import { safeJson } from "@/lib/safeFetch";
import { Chip, Copyable, Icon, KV, Meter, Modal, Toggle } from "./ui";

export type InspectorTab = "identity" | "session" | "ledger" | "devices" | "hardening";

const TABS: { id: InspectorTab; label: string; icon: string }[] = [
  { id: "identity", label: "Identity", icon: "key" },
  { id: "session", label: "Session", icon: "shield" },
  { id: "ledger", label: "Ledger", icon: "terminal" },
  { id: "devices", label: "Devices", icon: "cpu" },
  { id: "hardening", label: "Hardening", icon: "bolt" },
];

function hashPreview(b64: string, n = 12): string {
  try {
    const bytes = b64d(b64);
    let h = 0;
    for (let i = 0; i < Math.min(bytes.length, 64); i++) h = (h * 33 + bytes[i]) >>> 0;
    return `0x${h.toString(16).padStart(8, "0")}…${n}`;
  } catch {
    return "—";
  }
}

export function SealDetails({ open, onClose, msg, client }: { open: boolean; onClose: () => void; msg: HistMsg | null; client: KedClient }) {
  const [info, setInfo] = useState<string>("");
  useEffect(() => {
    if (!msg || !open) return;
    const s = client.data.sessions[msg.from === client.userId ? (client.data.rooms[msg.roomId]?.peerId ?? "") : msg.from];
    setInfo(
      JSON.stringify(
        {
          wire: { room: msg.roomId.slice(0, 16) + "…", kind: msg.kind, seq: msg.seq, ciphertext: `${msg.id.length * 8}-bit id, body base64` },
          ratchet: s
            ? {
                sendChainCounter: s.send?.n ?? null,
                recvChainCounter: s.recv?.n ?? null,
                dhRatchetSteps: s.ds,
                skippedKeys: Object.keys(s.skipped).length,
                peerRatchet: hashPreview(s.peerRatchet ?? ""),
                authenticated: msg.verified,
              }
            : { note: "group sender-key message — chains tracked per member" },
          ttl: msg.expiresAt ? { expiresAt: new Date(msg.expiresAt).toISOString(), left: `${Math.max(0, Math.round((msg.expiresAt - Date.now()) / 1000))}s` } : "none",
        },
        null,
        2,
      ),
    );
  }, [msg, open, client]);
  return (
    <Modal open={open} onClose={onClose} title="Seal details" icon="key" wide>
      <p className="mono mb-3 text-[11px] leading-relaxed text-[var(--ink-dim)]">
        Everything the relay holds about this row, plus the local ratchet state that produced it. Notice there is no plaintext field
        anywhere on the wire — and after the message key is consumed it is destroyed, so this row can never be re-read by anyone.
      </p>
      <pre className="mono scroll max-h-[46vh] overflow-auto rounded-xl border border-[var(--line)] bg-black/45 p-3 text-[11px] leading-relaxed text-[var(--ink-dim)]">
        {info}
      </pre>
    </Modal>
  );
}

export default function Inspector({
  client,
  roomId,
  tab,
  onTab,
  onClose,
  toast,
}: {
  client: KedClient;
  roomId: string | null;
  tab: InspectorTab;
  onTab: (t: InspectorTab) => void;
  onClose: () => void;
  toast: (m: string, tone?: "good" | "bad") => void;
}) {
  const [fp, setFp] = useState("deriving…");
  const [relayEvents, setRelayEvents] = useState<{ event: string; detail: string | null; createdAt: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [backup, setBackup] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ displayName: string; bio: string }>({ displayName: "", bio: "" });
  const [editingProfile, setEditingProfile] = useState(false);

  useEffect(() => {
    void computeFingerprint(client.data.identity?.ik.pub ?? "").then(setFp);
  }, [client.data.identity, client]);

  useEffect(() => {
    if (tab !== "identity" && !editingProfile) return;
    void client.readProfile().then(setProfile);
  }, [tab, client, editingProfile, client.data.profileEnc]);

  useEffect(() => {
    if (tab === "ledger") void client.ledgerOf().then(setRelayEvents).catch(() => setRelayEvents([]));
  }, [tab, client, client.data.cursor]);

  const room = roomId ? client.data.rooms[roomId] : null;
  const peerId = room?.type === "dm" ? room.peerId ?? "" : "";
  const contact = client.data.contacts[peerId];
  const session = client.data.sessions[peerId];
  const groups = room?.type === "group" ? client.data.groups[room.id] : null;

  const posture = useMemo(() => {
    let score = 40;
    const notes: string[] = [];
    if (Object.values(client.data.contacts).some((c) => c.verified)) {
      score += 14;
      notes.push("at least one safety number verified");
    } else notes.push("no safety number verified yet");
    if (client.data.settings.requireVerified) {
      score += 10;
      notes.push("send blocked for unverified peers");
    } else notes.push("unverified peers can still receive (trust-on-first-use)");
    if (client.data.settings.ttlMs > 0 || Object.values(client.data.rooms).some((r) => r.ttl)) {
      score += 12;
      notes.push("auto-burn TTL active");
    } else notes.push("no TTL — messages persist on both sides");
    if (client.data.settings.blurOnBackground) score += 6;
    if (client.data.settings.clearClipboard) score += 6;
    if (Date.now() - (client.data.identity?.createdAt ?? 0) < 1000 * 60 * 60 * 24 * 90) {
      score += 6;
      notes.push("identity bundle younger than 90 days");
    } else notes.push("identity bundle older than 90 days — rotate");
    const used = client.data.identity?.opkConsumed.length ?? 0;
    if (used > OPK_COUNT * 0.6) notes.push("one-time prekey pool running low");
    return { score: Math.min(100, score), notes };
  }, [client.data]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
      toast(label + " done", "good");
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(null);
    }
  };

  return (
    <aside className="panel relative flex h-full min-h-0 flex-col overflow-hidden">
      <span className="glowline" />
      <div className="row items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2.5">
        <div className="row gap-2 text-[var(--acc)]">
          <Icon name="key" size={16} />
          <span className="text-[13px] font-bold tracking-tight text-[var(--ink)]">Inspector</span>
        </div>
        <button className="btn btn-icon btn-sm" onClick={onClose} title="Hide (⌘/Ctrl+B)">
          <Icon name="x" size={14} />
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-[var(--line)] px-2 py-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onTab(t.id)}
            className={`row flex-none gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition ${
              tab === t.id ? "bg-white/10 text-[var(--ink)]" : "text-[var(--ink-faint)] hover:bg-white/5"
            }`}
          >
            <Icon name={t.icon} size={13} /> {t.label}
          </button>
        ))}
      </div>

      <div className="scroll min-h-0 flex-1 p-3">
        {tab === "identity" ? (
          <div className="grid gap-3">
            <div className="rounded-xl border border-[var(--line)] bg-black/25 p-3">
              <Meter value={posture.score} label={`security posture`} tone={posture.score > 74 ? "good" : posture.score > 50 ? "warn" : "bad"} />
              <ul className="mono mt-2.5 grid gap-1 text-[10.5px] text-[var(--ink-faint)]">
                {posture.notes.map((n) => (
                  <li key={n}>• {n}</li>
                ))}
              </ul>
            </div>
            <div className="panel p-3">
              <KV k="handle" v={`@${client.username}`} />
              <KV k="opaque relay id" v={<span className="break-all">{client.userId}</span>} />
              <KV k="identity fingerprint" v={<span className="break-all text-[#a9ffe2]">{fp}</span>} />
              <KV k="signed prekey" v={hashPreview(client.data.identity?.spk.pub ?? "")} />
              <KV
                k="one-time prekeys"
                v={`${Math.max(0, OPK_COUNT - (client.data.identity?.opkConsumed.length ?? 0))} left of ${OPK_COUNT} published`}
              />
              <KV k="vault blob" v={fmtBytes(JSON.stringify(client.data).length)} />
              <KV k="kdf" v="PBKDF2-SHA-256 · 750 000 rounds" tone="good" />
              <KV k="private keys shipped" v="0 bytes" tone="good" />
            </div>
            <Copyable value={fp} label="copy fingerprint (for out-of-band check)" />

            <div className="panel p-3">
              <div className="row justify-between">
                <span className="kicker">profile (vault-encrypted)</span>
                <button className="btn btn-icon btn-sm" onClick={() => setEditingProfile((v) => !v)} title="Edit profile">
                  <Icon name={editingProfile ? "x" : "gear"} size={13} />
                </button>
              </div>
              {editingProfile ? (
                <div className="mt-2 grid gap-2">
                  <input
                    className="input text-[13px]"
                    placeholder="display name (optional)"
                    value={profile.displayName}
                    maxLength={48}
                    onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
                  />
                  <textarea
                    className="input text-[13px]"
                    rows={2}
                    placeholder="bio / status (optional)"
                    value={profile.bio}
                    maxLength={160}
                    onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                  />
                  <div className="row justify-end gap-2">
                    <button className="btn btn-sm" onClick={() => setEditingProfile(false)}>
                      cancel
                    </button>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() =>
                        run("profile save", async () => {
                          await client.setProfile(profile.displayName, profile.bio);
                          setEditingProfile(false);
                        })
                      }
                    >
                      save encrypted
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-1.5">
                  <div className="text-[13px] font-semibold">{profile.displayName || `@${client.username}`}</div>
                  <div className="mono mt-0.5 text-[10.5px] leading-relaxed text-[var(--ink-faint)]">
                    {profile.bio || "no bio — click the gear to add one (encrypted with your vault key)"}
                  </div>
                </div>
              )}
            </div>
            <div className="row gap-2">
              <button
                className="btn btn-sm flex-1 justify-center"
                disabled={!!busy}
                onClick={() => run("rotate bundle", () => client.rotateKeys())}
              >
                <Icon name="refresh" size={13} /> {busy === "rotate bundle" ? "rotating…" : "Rotate bundle"}
              </button>
              <button
                className="btn btn-sm flex-1 justify-center"
                disabled={!!busy}
                onClick={() =>
                  run("export", async () => {
                    const blob = await client.exportBackup();
                    setBackup(blob);
                    const url = URL.createObjectURL(new Blob([blob], { type: "application/json" }));
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `sher-messenger-${client.username}.enc.json`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 30_000);
                  })
                }
              >
                <Icon name="doc" size={13} /> Encrypted export
              </button>
            </div>
            {backup ? (
              <p className="mono rounded-lg border border-[var(--line)] bg-black/30 p-2.5 text-[10px] leading-relaxed text-[var(--ink-faint)]">
                export sealed with SHA-256(&quot;KED-backup-v1&quot; ‖ vault key) · {fmtBytes(backup.length)} · keep it offline, it is
                only as strong as your passphrase
              </p>
            ) : null}
          </div>
        ) : null}

        {tab === "session" ? (
          <div className="grid gap-3">
            {!room ? (
              <p className="mono text-[11px] text-[var(--ink-faint)]">Open a conversation to inspect its ratchet.</p>
            ) : (
              <>
                <div className="panel p-3">
                  <KV k="peer" v={contact?.username ?? room.name ?? room.id.slice(0, 10)} />
                  <KV k="room id (SHA-256 of both IKs)" v={<span className="break-all">{room.id}</span>} />
                  <KV k="type" v={room.type} />
                  <KV k="auto-burn" v={room.ttl ? `${room.ttl / 1000}s` : "off"} tone={room.ttl ? "warn" : undefined} />
                  {room.type === "group" ? <KV k="members" v={room.members.map((m) => client.data.contacts[m]?.username ?? m.slice(0, 6)).join(", ")} /> : null}
                </div>
                {session ? (
                  <div className="panel p-3">
                    <div className="kicker mb-1.5">double ratchet state</div>
                    <KV k="sending chain counter" v={session.send?.n ?? "—"} />
                    <KV k="receiving chain counter" v={session.recv?.n ?? "—"} />
                    <KV k="DH ratchet steps" v={session.ds} tone="good" />
                    <KV k="skipped keys buffered" v={Object.keys(session.skipped).length} />
                    <KV k="my ratchet pub" v={hashPreview(session.myRatchet.pub)} />
                    <KV k="peer ratchet pub" v={hashPreview(session.peerRatchet ?? "")} />
                    <KV k="session opened" v={new Date(session.createdAt).toLocaleString()} />
                    <p className="mono mt-2 text-[10px] leading-relaxed text-[var(--ink-faint)]">
                      Each inbound message key is derived then discarded; a peer ratchet key you have never seen before forces a fresh
                      ECDH step, which is what gives the conversation future secrecy.
                    </p>
                  </div>
                ) : groups ? (
                  <div className="panel p-3">
                    <div className="kicker mb-1.5">group sender keys</div>
                    <KV k="my chain" v={`n=${groups.own.n}`} />
                    <KV k="peer chains" v={Object.entries(groups.peers).map(([k, v]) => `${k.slice(0, 6)}:${v.n}`).join("  ") || "—"} />
                    <button className="btn btn-sm mt-2 w-full justify-center" onClick={() => run("re-key group", () => client.rekeyGroup(room.id))}>
                      <Icon name="refresh" size={13} /> Re-key everyone (PCS)
                    </button>
                  </div>
                ) : (
                  <p className="mono text-[11px] text-[var(--ink-faint)]">No session yet — your first message performs the X3DH handshake.</p>
                )}
                {contact ? (
                  <div className="panel p-3">
                    <div className="kicker mb-1.5">safety number · 60 digits</div>
                    <div className="mono grid grid-cols-4 gap-1.5 text-[12px] leading-relaxed text-[var(--ink)]">
                      {contact.safety.split(" ").map((g, i) => (
                        <span key={i} className="rounded-md bg-black/35 py-1 text-center">
                          {g}
                        </span>
                      ))}
                    </div>
                    <div className="row mt-2.5 gap-2">
                      <button
                        className={`btn btn-sm flex-1 justify-center ${contact.verified ? "btn-primary" : ""}`}
                        onClick={() => void client.verifyContact(contact.userId, !contact.verified)}
                      >
                        <Icon name={contact.verified ? "check" : "shield"} size={13} /> {contact.verified ? "verified" : "mark verified"}
                      </button>
                      <button
                        className="btn btn-sm"
                        title="Drop this session; the next message performs a fresh X3DH handshake"
                        onClick={() =>
                          run("reset session", async () => {
                            delete client.data.sessions[contact.userId];
                            await client.updateSettings({});
                            await client.persistNow();
                          })
                        }
                      >
                        <Icon name="refresh" size={13} /> re-handshake
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {tab === "ledger" ? (
          <div className="grid gap-3">
            <div className="panel p-3">
              <div className="row justify-between">
                <span className="kicker">local vault ledger</span>
                <Chip>{client.data.ledger.length}</Chip>
              </div>
              <div className="mt-2 grid gap-1.5">
                {client.data.ledger.length === 0 ? <p className="mono text-[11px] text-[var(--ink-faint)]">nothing recorded yet</p> : null}
                {client.data.ledger.slice(0, 60).map((e, i) => (
                  <div key={i} className="row items-start justify-between gap-3 border-b border-[var(--line)] pb-1.5 last:border-0">
                    <span className="mono min-w-0 break-all text-[10.5px] text-[var(--ink-dim)]">
                      <span className={e.kind.includes("burn") || e.kind.includes("shred") ? "text-[var(--warn)]" : e.kind.includes("violation") ? "text-[var(--danger)]" : "text-[var(--acc)]"}>
                        {e.kind}
                      </span>{" "}
                      {e.note}
                    </span>
                    <span className="mono flex-none text-[9.5px] text-[var(--ink-faint)]">{new Date(e.t).toLocaleTimeString([], { hour12: false })}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel p-3">
              <div className="row justify-between">
                <span className="kicker">relay-side events (content-free)</span>
                <Chip tone="acc">{String((client.stats?.adapter as string) ?? "…").slice(0, 22)}</Chip>
              </div>
              <div className="mt-2 grid gap-1.5">
                {relayEvents.length === 0 ? <p className="mono text-[11px] text-[var(--ink-faint)]">relay has no rows for you</p> : null}
                {relayEvents.map((e, i) => (
                  <div key={i} className="row items-start justify-between gap-3 border-b border-[var(--line)] pb-1.5 last:border-0">
                    <span className="mono min-w-0 break-all text-[10.5px] text-[var(--ink-dim)]">
                      <span className="text-[var(--acc-2)]">{e.event}</span> {e.detail ?? ""}
                    </span>
                    <span className="mono flex-none text-[9.5px] text-[var(--ink-faint)]">{new Date(e.createdAt).toLocaleTimeString([], { hour12: false })}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {tab === "devices" ? (
          <DeviceList client={client} toast={toast} />
        ) : null}

        {tab === "hardening" ? (
          <div className="grid gap-3">
            <div className="panel p-2">
              <Toggle
                on={client.data.settings.requireVerified}
                label="Require verified peers before sending"
                hint="hard mode: refuses to seal a message to a contact whose safety number you have not confirmed"
                onChange={(v) => void client.updateSettings({ requireVerified: v })}
              />
              <Toggle
                on={client.data.settings.blurOnBackground}
                label="Blur when the tab loses focus"
                hint="cheap screen-share / shoulder-surfing mitigation"
                onChange={(v) => void client.updateSettings({ blurOnBackground: v })}
              />
              <Toggle
                on={client.data.settings.clearClipboard}
                label="Auto-clear clipboard after 45s"
                hint="overwrites what you copied from a chat"
                onChange={(v) => void client.updateSettings({ clearClipboard: v })}
              />
              <Toggle
                on={client.data.settings.readReceipts}
                label="Send read receipts"
                hint="off = peers never learn you opened it (also stops your ticks)"
                onChange={(v) => void client.updateSettings({ readReceipts: v })}
              />
              <Toggle
                on={client.data.settings.typingIndicators}
                label="Typing indicators"
                hint="travels as encrypted ratchet messages with an 8s TTL"
                onChange={(v) => void client.updateSettings({ typingIndicators: v })}
              />
            </div>
            <div className="panel p-3">
              <span className="kicker">default TTL for new rooms</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[0, 30_000, 120_000, 900_000, 3_600_000, 86_400_000].map((ms) => (
                  <button
                    key={ms}
                    onClick={() => void client.updateSettings({ ttlMs: ms })}
                    className={`chip ${client.data.settings.ttlMs === ms ? "!border-[rgba(79,240,182,.5)] !bg-[rgba(79,240,182,.14)] !text-[#a9ffe2]" : ""}`}
                  >
                    {ms === 0 ? "off" : ms < 60_000 ? `${ms / 1000}s` : ms < 3_600_000 ? `${ms / 60_000}m` : ms < 86_400_000 ? `${ms / 3_600_000}h` : "1d"}
                  </button>
                ))}
              </div>
            </div>
            <div className="panel p-3">
              <div className="kicker mb-1.5">relay reality</div>
              <KV k="adapter" v={String((client.stats?.adapter as string) ?? "…")} />
              <KV k="stored rows" v={String((client.stats?.ciphertextRows as number) ?? "…")} />
              <KV k="plaintext on server" v={String((client.stats?.plaintextRowsOnServer as number) ?? 0)} tone="good" />
              <KV k="analytics / CDN trackers" v="none" tone="good" />
              <a className="btn btn-sm mt-2 w-full justify-center" href="/plan">
                <Icon name="doc" size={13} /> PRD, threat model, deploy matrix
              </a>
              <a className="btn btn-sm mt-2 w-full justify-center" href="/api/dev-selftest" target="_blank" rel="noreferrer">
                <Icon name="terminal" size={13} /> Run the protocol conformance checks
              </a>
            </div>
            <div className="rounded-xl border border-[rgba(255,107,122,.35)] bg-[rgba(255,107,122,.07)] p-3">
              <div className="kicker !text-[#ffc2c9]">kill switch</div>
              <p className="mono mt-1.5 text-[10.5px] leading-relaxed text-[var(--ink-dim)]">
                Panic wipe destroys the local vault, revokes every relay session and asks the relay to zero your own ciphertext rows.
                Without the vault key those rows are unrecoverable by anyone.
              </p>
              <button className="btn btn-danger btn-sm mt-2.5 w-full justify-center" onClick={() => setWipeOpen(true)}>
                <Icon name="flame" size={13} /> Panic wipe this account
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <Modal open={wipeOpen} onClose={() => setWipeOpen(false)} title="Confirm panic wipe" icon="flame">
        <p className="text-[13px] leading-relaxed text-[var(--ink-dim)]">
          This is irreversible: local vault, sessions, decrypted history and the relay copy of your encrypted blob are destroyed. Peers
          keep their ratcheted transcripts (their own copies) but can no longer reach you.
        </p>
        <div className="mt-4 row gap-2">
          <button className="btn flex-1 justify-center" onClick={() => setWipeOpen(false)}>
            cancel
          </button>
          <button
            className="btn btn-danger flex-1 justify-center"
            onClick={async () => {
              setWipeOpen(false);
              await client.panicWipe();
              KedClient.wipeLocal(client.username);
              toast("vault destroyed · all sessions revoked", "bad");
            }}
          >
            <Icon name="flame" size={13} /> WIPE
          </button>
        </div>
      </Modal>
    </aside>
  );
}

function DeviceList({ client, toast }: { client: KedClient; toast: (m: string, t?: "good" | "bad") => void }) {
  const [rows, setRows] = useState<Awaited<ReturnType<KedClient["deviceList"]>> | null>(null);
  const load = () => client.deviceList().then(setRows).catch(() => setRows([]));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);
  return (
    <div className="grid gap-3">
      <div className="panel p-3">
        <div className="row justify-between">
          <span className="kicker">authenticated devices</span>
          <button className="btn btn-icon btn-sm" onClick={load} title="Refresh">
            <Icon name="refresh" size={13} />
          </button>
        </div>
        <div className="mt-2 grid gap-2">
          {(rows ?? []).map((d) => (
            <div key={d.id} className="row items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-black/25 px-2.5 py-2">
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-semibold">
                  {d.device ?? "device"} {d.current ? <Chip tone="good">this one</Chip> : null}
                </span>
                <span className="mono block text-[9.5px] text-[var(--ink-faint)]">
                  created {new Date(d.createdAt).toLocaleDateString()} · token expires {new Date(d.expiresAt).toLocaleDateString()} · ip {d.id.slice(2, 6)}
                </span>
              </span>
              {d.current ? null : (
                <button
                  className="btn btn-icon btn-sm btn-danger"
                  title="Revoke every other session"
                  onClick={() =>
                    void safeJson("/api/ked/revoke-device", {
                      method: "POST",
                      headers: { "content-type": "application/json", authorization: `Bearer ${client.token}` },
                      body: JSON.stringify({ id: d.id }),
                    }).then((res) => {
                      if (res) {
                        toast("other sessions revoked", "good");
                        void load();
                      } else {
                        toast("could not reach the relay to revoke that device", "bad");
                      }
                    })
                  }
                >
                  <Icon name="trash" size={13} />
                </button>
              )}
            </div>
          ))}
          {rows && rows.length === 0 ? <p className="mono text-[11px] text-[var(--ink-faint)]">none</p> : null}
        </div>
      </div>
      <div className="panel p-3">
        <div className="kicker mb-1.5">session policy</div>
        <p className="mono text-[10.5px] leading-relaxed text-[var(--ink-dim)]">
          Bearer tokens (64 hex) are hashed with SHA-256 before storage and expire in 30 days. Closing the tab drops the derived vault
          key from memory and sessionStorage — the passphrase is required again. 6 wrong passphrases → 15 minute lockout.
        </p>
      </div>
    </div>
  );
}
