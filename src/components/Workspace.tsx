"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type HistMsg, type Room, countdown, fmtBytes, fmtTime } from "@/lib/client";
import type { KedClient } from "@/lib/client";
import { Chip, Copyable, EmojiPicker, FireOverlay, Icon, Identicon, TtlRing, useNow } from "./ui";
import { useI18n } from "@/lib/i18n";

/* ------------------------------------------------------------------ shared */

const DAY = 86_400_000;
const dayLabel = (ts: number) => {
  const d = new Date(ts);
  const today = new Date();
  const diff = Math.floor((today.setHours(0, 0, 0, 0) - new Date(ts).setHours(0, 0, 0, 0)) / DAY);
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

function relTime(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 45) return "active just now";
  if (s < 3600) return `last seen ${Math.round(s / 60)}m ago`;
  if (s < 86_400) return `last seen ${Math.round(s / 3600)}h ago`;
  return `last seen ${Math.round(s / 86_400)}d ago`;
}

function Rich({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            className="text-[var(--acc-2)] underline decoration-dotted underline-offset-2"
          >
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/* ------------------------------------------------------------------ attachment card */

function AttachmentView({ client, msg }: { client: KedClient; msg: HistMsg }) {
  const att = msg.attachment;
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const isImage = att?.mime.startsWith("image/") ?? false;

  useEffect(() => {
    if (!att) return;
    const cached = client.attachmentCache.get(att.id);
    if (cached && isImage) setUrl(cached);
  }, [att, client, isImage]);

  if (!att) return null;
  const load = async () => {
    try {
      const u = await client.loadAttachment(att, msg.roomId);
      setUrl(u);
      setOpen(true);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-[var(--line)] bg-black/30">
      {isImage && url ? (
        // The source is a short-lived in-memory blob: URL created after local decryption;
        // framework image optimization would upload/re-proxy plaintext and violate E2EE.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={att.name} className="max-h-[320px] w-full object-cover" />
      ) : (
        <div className="row items-center justify-between gap-3 px-3 py-2.5">
          <span className="row min-w-0">
            <Icon name="doc" size={16} />
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-semibold">{att.name}</span>
              <span className="mono block text-[10px] text-[var(--ink-faint)]">
                {fmtBytes(att.size)} · {att.mime} · sealed with a one-time AES key
              </span>
            </span>
          </span>
          <button className="btn btn-sm" onClick={load} type="button">
            <Icon name={open ? "eyeoff" : "eye"} size={13} /> {open ? "re-decrypt" : "open"}
          </button>
        </div>
      )}
      {url && isImage && open ? (
        <a className="mono block border-t border-[var(--line)] px-3 py-1.5 text-[10.5px] text-[var(--acc-2)]" href={url} download={att.name}>
          saved copy lives only as a blob: URL in this tab
        </a>
      ) : null}
      {err ? <div className="mono border-t border-[rgba(255,107,122,.3)] px-3 py-2 text-[10.5px] text-[#ffc2c9]">{err}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ bubble */

function DoubleTick({ read }: { read?: boolean }) {
  return (
    <svg width="15" height="11" viewBox="0 0 18 12" fill="none" aria-hidden="true" className={read ? "opacity-100" : "opacity-70"}>
      <path d="M1 6.6l2.6 2.6L9 3.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.2 6.6l2.6 2.6L17 3.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Bubble({
  client,
  msg,
  prev,
  peerName,
  onReply,
  onInfo,
  isGroup,
}: {
  client: KedClient;
  msg: HistMsg;
  prev: HistMsg | null;
  peerName: string;
  onReply: (m: HistMsg) => void;
  onInfo: (m: HistMsg) => void;
  isGroup: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.text);
  const now = useNow(1000);
  const left = msg.expiresAt ? msg.expiresAt - now : null;

  if (msg.kind === "system")
    return (
      <div className="mono mx-auto my-2 max-w-[70ch] rounded-full border border-[var(--line)] bg-black/30 px-3 py-1.5 text-center text-[10.5px] text-[var(--ink-faint)]">
        {msg.text}
      </div>
    );

  const me = msg.me;
  const sameAsPrev = prev && prev.me === msg.me && prev.from === msg.from && msg.at - prev.at < 4 * 60_000 && !msg.replyTo;
  const total = msg.expiresAt ? Math.max(1, msg.expiresAt - msg.at) : 1;

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      client.error = (e as Error).message;
    }
  };

  return (
    <div className={`group flex flex-col ${me ? "items-end" : "items-start"}`} style={{ marginTop: sameAsPrev ? 2 : 10 }}>
      <div className="row max-w-full gap-1.5">
        {!me ? (
          <div className="row flex-none gap-1.5 self-end pb-1">
            <Identicon seed={msg.from} label={peerName} />
            {isGroup && !sameAsPrev ? <span className="mono text-[10px] text-[var(--ink-faint)]">{peerName}</span> : null}
          </div>
        ) : null}
        <div
          className={`bubble ${me ? "bubble-me" : ""} ${msg.destroyed ? "bubble-destroyed" : ""}`}
          data-seq={msg.seq}
        >
          {msg.replyTo ? (
            <div className="mono mb-1.5 border-l-2 border-[var(--acc)] pl-2 text-[10px] text-[var(--ink-faint)]">
              reply → {msg.replyTo.slice(0, 12)}
            </div>
          ) : null}
          {msg.destroyed ? (
            <div className="row gap-2 py-0.5">
              <Icon name="flame" size={14} />
              <span className="mono text-[11.5px]">burned — plaintext destroyed on every device, relay row zeroed</span>
            </div>
          ) : editing ? (
            <div className="grid w-full gap-2">
              <textarea className="input" value={draft} rows={3} onChange={(e) => setDraft(e.target.value)} />
              <div className="row justify-end gap-2">
                <button className="btn btn-sm" onClick={() => setEditing(false)}>
                  cancel
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() =>
                    act(async () => {
                      await client.edit(msg.roomId, msg.id, draft);
                      setEditing(false);
                    })
                  }
                >
                  re-seal & send
                </button>
              </div>
            </div>
          ) : (
            <div className="whitespace-pre-wrap text-[13.5px] leading-[1.55]">
              <Rich text={msg.text} />
            </div>
          )}

          {!msg.destroyed && msg.attachment ? <AttachmentView client={client} msg={msg} /> : null}

          {Object.keys(msg.reactions).length ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {Object.entries(msg.reactions).map(([emoji, who]) =>
                who.length ? (
                  <span key={emoji} className="chip !py-0.5 text-[10px]">
                    {emoji} {who.length}
                  </span>
                ) : null,
              )}
            </div>
          ) : null}

          <div className="mono row mt-1 justify-end gap-2 text-[9.5px] text-[var(--ink-faint)]">
            {left !== null && !msg.destroyed ? <TtlRing left={Math.max(0, left)} total={total} /> : null}
            <span>{fmtTime(msg.at)}</span>
            {msg.expiresAt && !msg.destroyed ? <span className="text-[var(--warn)]">burns in {countdown(msg.expiresAt)}</span> : null}
            {me && !msg.destroyed ? (
              <span
                className={`row gap-1 ${msg.readBy.length ? "text-[var(--acc)]" : msg.seq > 0 ? "text-[var(--ink-dim)]" : "text-[var(--ink-faint)]"}`}
                title={
                  msg.readBy.length
                    ? `read by ${msg.readBy.length} device(s) — receipt travelled encrypted`
                    : msg.seq > 0
                      ? "sealed and stored at the relay (ciphertext only)"
                      : "queued locally"
                }
              >
                {msg.readBy.length ? (
                  <DoubleTick read />
                ) : msg.seq > 0 ? (
                  <DoubleTick />
                ) : (
                  <Icon name="check" size={11} />
                )}
                {msg.readBy.length ? "read" : msg.seq > 0 ? "sealed" : "queued"}
              </span>
            ) : null}
          </div>
        </div>

        {/* hover toolbar */}
        <div className="hover-tools row flex-none self-center gap-1">
          {["🔥", "👍", "🔐"].map((e) => (
            <button
              key={e}
              className="btn btn-icon btn-sm !px-1.5"
              title={`react ${e}`}
              onClick={() => act(() => client.react(msg.roomId, msg.id, e))}
            >
              <span className="text-[12px] leading-none">{e}</span>
            </button>
          ))}
          <button className="btn btn-icon btn-sm" title="Reply" onClick={() => onReply(msg)}>
            <Icon name="reply" size={13} />
          </button>
          <button
            className="btn btn-icon btn-sm"
            title="Copy plaintext (clipboard auto-clears if enabled)"
            onClick={() =>
              act(async () => {
                await navigator.clipboard.writeText(msg.text);
                if (client.data.settings.clearClipboard)
                  setTimeout(() => void navigator.clipboard.writeText("— cleared by SHER Messenger —").catch(() => undefined), 45_000);
              })
            }
          >
            <Icon name="copy" size={13} />
          </button>
          <button className="btn btn-icon btn-sm" title="Seal details" onClick={() => onInfo(msg)}>
            <Icon name="key" size={13} />
          </button>
          {me ? (
            <>
              <button
                className="btn btn-icon btn-sm"
                title="Edit (re-encrypt with the next ratchet key)"
                onClick={() => {
                  setDraft(msg.text);
                  setEditing(true);
                }}
              >
                <Icon name="gear" size={13} />
              </button>
              <button
                className="btn btn-icon btn-sm btn-danger"
                title="Unsend: shred at relay + destroy local copies"
                onClick={() => act(() => client.recall(msg.roomId, msg.id))}
              >
                <Icon name="trash" size={13} />
              </button>
            </>
          ) : (
            <button
              className="btn btn-icon btn-sm btn-danger"
              title="Burn my copy now"
              onClick={() => act(() => client.recall(msg.roomId, msg.id, false))}
            >
              <Icon name="flame" size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ sidebar */

function RoomRow({
  room,
  client,
  active,
  onSelect,
  unread,
}: {
  room: Room;
  client: KedClient;
  active: boolean;
  onSelect: () => void;
  unread: number;
}) {
  const list = client.data.history[room.id] ?? [];
  const last = list[list.length - 1];
  const peer = room.type === "dm" ? client.data.contacts[room.peerId ?? ""] : null;
  const name = room.type === "group" ? room.name ?? room.id.slice(0, 8) : peer?.username ?? room.name ?? "dm";
  return (
    <button
      onClick={onSelect}
      className={`row w-full gap-3 rounded-xl border px-2.5 py-2 text-left transition ${
        active ? "border-[rgba(79,240,182,.35)] bg-[rgba(79,240,182,.08)]" : "border-transparent hover:border-[var(--line)] hover:bg-white/5"
      }`}
    >
      <Identicon seed={room.type === "group" ? room.id : peer?.ikPub ?? room.id} label={name} />
      <span className="min-w-0 flex-1">
        <span className="row justify-between gap-2">
          <span className="truncate text-[13px] font-semibold">{name}</span>
          <span className="mono flex-none text-[9.5px] text-[var(--ink-faint)]">{last ? fmtTime(last.at) : ""}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-1.5">
          <span className="mono min-w-0 flex-1 truncate text-[10.5px] text-[var(--ink-faint)]">
            {last ? (last.destroyed ? "🔥 burned" : `${last.me ? "you: " : ""}${last.text || "attachment"}`) : "no messages yet — say hi"}
          </span>
          {unread > 0 ? <span className="mono rounded-full bg-[var(--acc)] px-1.5 text-[9.5px] font-semibold text-[var(--acc-ink)]">{unread}</span> : null}
        </span>
        <span className="mt-1 flex flex-wrap gap-1">
          {room.type === "group" ? (
            <Chip tone="acc">
              <Icon name="users" size={10} /> {room.members.length}
            </Chip>
          ) : (
            <Chip tone={peer?.verified ? "good" : "warn"} title={peer?.verified ? "safety number verified" : "not verified out-of-band"}>
              <Icon name={peer?.verified ? "shield" : "alert"} size={10} /> {peer?.verified ? "verified" : "unverified"}
            </Chip>
          )}
          {room.ttl ? (
            <Chip tone="warn">
              <Icon name="flame" size={10} /> {Math.round(room.ttl / 1000)}s
            </Chip>
          ) : null}
        </span>
      </span>
    </button>
  );
}

export function Sidebar({
  client,
  activeRoomId,
  onSelect,
  onNewContact,
  onNewGroup,
  lastOpen,
}: {
  client: KedClient;
  activeRoomId: string | null;
  onSelect: (id: string) => void;
  onNewContact: () => void;
  onNewGroup: () => void;
  lastOpen: Record<string, number>;
}) {
  const { lang } = useI18n();
  const [q, setQ] = useState("");
  // The encrypted-vault store is mutable and drives rerenders through subscribe();
  // sorting this small personal room list directly keeps it correct without memo identity traps.
  const rooms = Object.values(client.data.rooms).sort((a, b) => b.createdAt - a.createdAt);
  const filtered = q.trim() ? rooms.filter((r) => (r.name ?? "").toLowerCase().includes(q.toLowerCase()) || r.id.includes(q.toLowerCase())) : rooms;
  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const out: { room: Room; m: HistMsg }[] = [];
    for (const r of rooms)
      for (const m of client.data.history[r.id] ?? []) if (!m.destroyed && m.text.toLowerCase().includes(needle)) out.push({ room: r, m });
    return out.slice(-14).reverse();
  }, [q, rooms, client.data.history]);

  return (
    <aside className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="grid gap-2 border-b border-[var(--line)] p-3">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]">
            <Icon name="search" size={14} />
          </span>
          <input
            id="ked-search"
            className="input mono pl-8 text-[12px]"
            placeholder={lang === "hi" ? "कमरे खोजें · संदेश इतिहास" : "filter rooms · search decrypted history"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="row gap-2">
          <button className="btn btn-sm flex-1 justify-center" onClick={onNewContact}>
            <Icon name="plus" size={13} /> {lang === "hi" ? "नया DM" : "New DM"}
          </button>
          <button className="btn btn-sm flex-1 justify-center" onClick={onNewGroup}>
            <Icon name="users" size={13} /> {lang === "hi" ? "समूह" : "Group"}
          </button>
        </div>
      </div>

      <div className="scroll min-h-0 flex-1 p-2">
        <div className="kicker px-1.5 py-2">{lang === "hi" ? "बातचीत" : "conversations"}</div>
        {filtered.length === 0 ? (
          <div className="grid gap-2 px-2 py-6">
            <p className="mono text-[11px] leading-relaxed text-[var(--ink-faint)]">
              {lang === "hi" ? (
                <>
                  अभी कोई रूम नहीं है। ऊपर <b className="text-[var(--ink-dim)]">नया DM</b> से संपर्क जोड़ें (उसे इसी रिले पर पंजीकृत होना चाहिए)।
                </>
              ) : (
                <>
                  No active rooms yet. Use <b className="text-[var(--ink-dim)]">New DM</b> above to start a conversation with a registered handle.
                </>
              )}
            </p>
            <a className="btn btn-sm justify-center" href="/guide" target="_blank" rel="noreferrer">
              <Icon name="spark" size={13} /> {lang === "hi" ? "मार्गदर्शिका पढ़ें" : "Read User Guide"}
            </a>
          </div>
        ) : (
          <div className="grid gap-0.5">
            {filtered.map((r) => {
              const list = client.data.history[r.id] ?? [];
              const unread = list.filter((m) => !m.me && m.at > (lastOpen[r.id] ?? 0) && !m.destroyed).length;
              return <RoomRow key={r.id} room={r} client={client} active={r.id === activeRoomId} onSelect={() => onSelect(r.id)} unread={unread} />;
            })}
          </div>
        )}

        {hits.length ? (
          <>
            <div className="divider my-3" />
            <div className="kicker px-1.5 py-2">matches in decrypted history</div>
            <div className="grid gap-1">
              {hits.map(({ room, m }) => (
                <button
                  key={m.id}
                  className="rounded-lg border border-[var(--line)] px-2.5 py-2 text-left hover:bg-white/5"
                  onClick={() => {
                    onSelect(room.id);
                    setTimeout(() => document.querySelector(`[data-seq="${m.seq}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
                  }}
                >
                  <span className="mono block text-[9.5px] text-[var(--ink-faint)]">
                    {room.name ?? room.id.slice(0, 8)} · {fmtTime(m.at)}
                  </span>
                  <span className="block truncate text-[12px]">{m.text}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        <div className="divider my-3" />
        <div className="kicker px-1.5 py-2">identities on file</div>
        {Object.values(client.data.contacts).length === 0 ? (
          <p className="mono px-2 pb-3 text-[10.5px] text-[var(--ink-faint)]">none yet</p>
        ) : (
          <div className="grid gap-1 pb-3">
            {Object.values(client.data.contacts).map((c) => (
              <div key={c.userId} className="row justify-between gap-2 rounded-lg px-1.5 py-1.5 hover:bg-white/5">
                <span className="row min-w-0 gap-2">
                  <Identicon seed={c.ikPub} label={c.username} />
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold">{c.username}</span>
                    <span className={`mono block text-[9.5px] ${c.verified ? "text-[var(--acc)]" : "text-[var(--ink-faint)]"}`}>
                      {c.verified ? "trust on board" : "safety number unchecked"}
                    </span>
                  </span>
                </span>
                <button
                  className="btn btn-icon btn-sm"
                  title="Remove contact + wipe those sessions locally"
                  onClick={() => void client.removeContact(c.userId)}
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-[var(--line)] p-3">
        <Copyable value={client.username} label={`you · @${client.username}`} />
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ chat */

export function Chat({
  client,
  roomId,
  onInfo,
  onOpenInspector,
  blur,
  sentryHint,
}: {
  client: KedClient;
  roomId: string | null;
  onInfo: (m: HistMsg) => void;
  onOpenInspector: () => void;
  blur: boolean;
  sentryHint: string;
}) {
  const { lang, t } = useI18n();
  const [draft, setDraft] = useState("");
  const [ttl, setTtl] = useState<number | null>(null);
  const [reply, setReply] = useState<HistMsg | null>(null);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [emoji, setEmoji] = useState(false);
  const [burning, setBurning] = useState(false);
  const [burnText, setBurnText] = useState("Burning & Shredding Room...");
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const now = useNow(1000);

  const room = roomId ? client.data.rooms[roomId] : null;
  const list = roomId ? client.data.history[roomId] ?? [] : [];
  const peer = room?.type === "dm" ? client.data.contacts[room.peerId ?? ""] : null;
  const typing = roomId ? (client.typingPeers[roomId] ?? 0) > now - 4500 : false;
  const lastInbound = list.filter((m) => !m.me).reduce((acc, m) => Math.max(acc, m.at), 0) || null;

  const handleBurnRoom = async () => {
    if (!roomId || burning) return;
    setBurning(true);
    setBurnText("Incinerating & Shredding History...");
    try {
      await client.burnRoom(roomId);
    } catch {}
    setTimeout(() => {
      setBurning(false);
    }, 1700);
  };

  // Auto-burn when room duration or TTL expires
  useEffect(() => {
    if (!roomId) return;
    if (client.roomExpiresAt && now >= client.roomExpiresAt) {
      void handleBurnRoom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, roomId, client.roomExpiresAt]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 260;
    if (near) endRef.current?.scrollIntoView({ block: "end" });
  }, [list.length, roomId]);

  useEffect(() => {
    setErr(null);
    setReply(null);
    setTtl(room?.ttl ?? null);
  }, [roomId, room?.ttl]);

  const send = async (file: File | null = null) => {
    if (!roomId || (!draft.trim() && !file)) return;
    setSending(true);
    setErr(null);
    try {
      await client.send({ roomId, text: draft, ttlMs: ttl, replyTo: reply?.id ?? null, file });
      setDraft("");
      setReply(null);
      if (file && fileRef.current) fileRef.current.value = "";
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const [screenAlert, setScreenAlert] = useState<string | null>(null);
  const [windowBlurred, setWindowBlurred] = useState(false);
  const [shieldActive, setShieldActive] = useState(() => {
    try {
      return localStorage.getItem("ked.shield") !== "false";
    } catch {
      return true;
    }
  });

  // Snapchat-style screenshot & capture detection
  useEffect(() => {
    if (!roomId) return;
    let lastAlert = 0;
    const notifyScreenshot = async (reason = "screen capture") => {
      const currentTime = Date.now();
      if (currentTime - lastAlert < 3000) return; // debounce
      lastAlert = currentTime;
      setScreenAlert(`📸 Screen capture attempt (${reason}) detected!`);
      setTimeout(() => setScreenAlert(null), 4500);

      try {
        client.ledger("privacy.screenshot", `Attempted ${reason} detected in room ${roomId.slice(0, 8)}`);
        await client.send({
          roomId,
          text: `📸 [PRIVACY ALERT] @${client.username || "Member"} took/attempted a ${reason}!`,
        });
      } catch {}
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key ? e.key.toLowerCase() : "";
      if (
        key === "printscreen" ||
        key === "snapshot" ||
        (e.ctrlKey && key === "p") ||
        (e.metaKey && e.shiftKey && (key === "3" || key === "4" || key === "5" || key === "s")) ||
        (e.ctrlKey && e.shiftKey && (key === "s" || key === "c" || key === "i")) ||
        (e.altKey && key === "printscreen") ||
        key === "f12"
      ) {
        void notifyScreenshot(key === "printscreen" ? "PrintScreen" : "screen-grab shortcut");
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key ? e.key.toLowerCase() : "";
      if (key === "printscreen" || key === "snapshot") {
        void notifyScreenshot("PrintScreen");
      }
    };

    const handleBlur = () => {
      setWindowBlurred(true);
    };

    const handleFocus = () => {
      setWindowBlurred(false);
    };

    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [client, roomId]);

  if (!room)
    return (
      <section className="panel flex h-full flex-col items-center justify-center gap-4 p-10 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[var(--line-strong)] bg-[rgba(79,240,182,.1)] text-[var(--acc)]">
          <Icon name="lock" size={26} />
        </span>
        <div>
          <h2 className="text-[19px] font-bold tracking-tight">No conversation selected</h2>
          <p className="mono mx-auto mt-2 max-w-[54ch] text-[11.5px] leading-relaxed text-[var(--ink-dim)]">
            Nothing is decrypted until you open a room, and even then only inside this tab. Add a handle from the left rail, or{" "}
            <span className="text-[var(--acc)]">{sentryHint}</span> to run a live two-identity handshake against a real peer.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Chip tone="good">
            <span className="dot" /> relay: {String(client.stats?.adapter ?? "connecting")}
          </Chip>
          <Chip>cursor {client.data.cursor}</Chip>
          <Chip tone="acc">poll 1.6s</Chip>
        </div>
      </section>
    );

  const name = room.type === "group" ? room.name ?? "group" : peer?.username ?? "dm";

  return (
    <section className="panel relative flex h-full min-h-0 flex-col overflow-hidden">
      <header className="row items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
        <div className="row min-w-0 gap-3">
          <Identicon seed={peer?.ikPub ?? room.id} label={name} />
          <div className="min-w-0">
            <div className="row gap-2">
              <h2 className="truncate text-[14.5px] font-bold tracking-tight">{name}</h2>
              {client.roomKey ? (
                <Chip tone="good" title="Hardcore E2EE: 256-bit key in link fragment">
                  <Icon name="lock" size={10} /> Hardcore #k=
                </Chip>
              ) : client.roomCode ? (
                <Chip tone="acc" title="Code-Nity: PBKDF2 250k key derivation">
                  <Icon name="shield" size={10} /> Code-Nity
                </Chip>
              ) : null}
              {room.type === "group" ? (
                <Chip tone="acc">
                  <Icon name="users" size={10} /> {room.members.length}
                </Chip>
              ) : (
                <Chip tone={peer?.verified ? "good" : "warn"}>
                  <Icon name={peer?.verified ? "shield" : "alert"} size={10} /> {peer?.verified ? "verified" : "unverified"}
                </Chip>
              )}
              {typing ? (
                <Chip tone="good">
                  <span className="dot" /> typing…
                </Chip>
              ) : lastInbound ? (
                <Chip>{relTime(now - lastInbound)}</Chip>
              ) : (
                <Chip>waiting for first message</Chip>
              )}
            </div>
            <div className="mono mt-0.5 truncate text-[10px] text-[var(--ink-faint)]">
              room {room.id.slice(0, 14)}… · {client.roomKey ? "fragment key in memory" : peer?.safety ? `safety ${peer.safety.slice(0, 15)}…` : "sender keys"}
            </div>
          </div>
        </div>
        <div className="row gap-1.5">
          <button
            className="btn btn-sm !border-[rgba(255,100,50,.5)] !bg-[rgba(255,80,0,.14)] !text-[#ff9d5c] hover:!bg-[rgba(255,80,0,.28)] shadow-[0_0_15px_rgba(255,100,0,.25)]"
            title="DuckDuckGo-style Fire Button: Burn & Shred Room History"
            onClick={handleBurnRoom}
          >
            <Icon name="flame" size={13} /> Fire Burn
          </button>
          <button
            className="btn btn-sm"
            title="Cycle auto-burn for this room"
            onClick={() => {
              const choices = [null, 30_000, 300_000, 3_600_000];
              const next = choices[(choices.indexOf(room.ttl ?? null) + 1) % choices.length];
              void client.setRoomTtl(room.id, next);
            }}
          >
            <Icon name="flame" size={13} /> {room.ttl ? `${Math.round(room.ttl / 1000)}s` : "burn off"}
          </button>
          <button
            className={`btn btn-sm ${shieldActive ? "!border-[var(--acc)] !bg-[rgba(79,240,182,.15)] text-[var(--acc)]" : ""}`}
            title="Toggle Anti-Snoop Shield (Auto-blurs chat when window loses focus)"
            onClick={() => {
              setShieldActive((prev) => {
                const next = !prev;
                try {
                  localStorage.setItem("ked.shield", String(next));
                } catch {}
                return next;
              });
            }}
          >
            <Icon name="shield" size={13} /> {shieldActive ? (lang === "hi" ? "शील्ड सक्रिय" : "Shield On") : (lang === "hi" ? "शील्ड" : "Shield")}
          </button>
          <button
            className="btn btn-icon btn-sm"
            title="Session inspector"
            onClick={onOpenInspector}
          >
            <Icon name="key" size={14} />
          </button>
        </div>
      </header>

      {screenAlert ? (
        <div className="mx-4 mt-2 row items-center justify-between gap-2 rounded-xl border border-[rgba(255,107,122,.5)] bg-[rgba(255,107,122,.18)] px-3 py-2 text-xs font-semibold text-[#ffc2c9] shadow-lg animate-pulse z-20">
          <span className="row gap-2">
            <Icon name="alert" size={14} className="text-[#ff6b7a]" />
            {screenAlert}
          </span>
          <button className="text-[11px] text-white/70 hover:text-white px-1" onClick={() => setScreenAlert(null)}>
            ✕
          </button>
        </div>
      ) : null}

      <FireOverlay active={burning} text={burnText} />

      <div ref={listRef} className={`scroll min-h-0 flex-1 px-4 py-3 ${blur || (shieldActive && windowBlurred) ? "secret" : ""} ${burning ? "fire-incinerate" : ""}`}>
        {list.length === 0 ? (
          <div className="mono mx-auto mt-16 max-w-[60ch] rounded-xl border border-dashed border-[var(--line-strong)] p-5 text-[11.5px] leading-relaxed text-[var(--ink-dim)]">
            Empty room. Your first message carries an X3DH prekey bundle in its header, so the peer can build the matching session even
            while offline. Try <span className="text-[var(--acc)]">audit</span>, <span className="text-[var(--acc)]">verify</span>,{" "}
            <span className="text-[var(--acc)]">burn</span> or <span className="text-[var(--acc)]">threat model</span>.
          </div>
        ) : null}
        {list.map((m, i) => {
          const prev = list[i - 1] ?? null;
          const newDay = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
          return (
            <div key={m.id}>
              {newDay ? (
                <div className="mono my-3 text-center text-[9.5px] uppercase tracking-[0.2em] text-[var(--ink-faint)]">{dayLabel(m.at)}</div>
              ) : null}
              <Bubble
                client={client}
                msg={m}
                prev={prev}
                peerName={m.me ? client.username : client.data.contacts[m.from]?.username ?? m.from.slice(0, 8)}
                onReply={setReply}
                onInfo={onInfo}
                isGroup={room.type === "group"}
              />
            </div>
          );
        })}
        {typing ? (
          <div className="mono row mt-2 gap-2 text-[10.5px] text-[var(--ink-faint)]">
            <span className="dot" /> peer is typing — indicator travels encrypted as its own ratchet message
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <footer className="border-t border-[var(--line)] p-3">
        {reply ? (
          <div className="row mb-2 justify-between gap-2 rounded-lg border border-[var(--line)] bg-black/30 px-2.5 py-1.5">
            <span className="mono truncate text-[10.5px] text-[var(--ink-dim)]">replying to {reply.from === client.userId ? "yourself" : name}: {reply.text.slice(0, 60)}</span>
            <button className="btn btn-icon btn-sm" onClick={() => setReply(null)}>
              <Icon name="x" size={12} />
            </button>
          </div>
        ) : null}
        {err ? (
          <div className="mono mb-2 row items-center gap-2 rounded-lg border border-[rgba(255,107,122,.35)] bg-[rgba(255,107,122,.08)] px-2.5 py-1.5 text-[10.5px] text-[#ffc2c9]">
            <Icon name="alert" size={13} /> {err}
          </div>
        ) : null}
        <div className="row items-end gap-2">
          <div className="row flex-1 items-end gap-1 rounded-xl border border-[var(--line)] bg-black/35 p-1.5 focus-within:border-[rgba(79,240,182,.5)]">
            <button className="btn btn-icon btn-sm !border-transparent !bg-transparent" title="Attach (encrypted before upload)" onClick={() => fileRef.current?.click()}>
              <Icon name="clip" size={15} />
            </button>
            <div className="relative">
              <button
                className="btn btn-icon btn-sm !border-transparent !bg-transparent"
                title="Emoji"
                onClick={() => setEmoji((v) => !v)}
              >
                <Icon name="smile" size={15} />
              </button>
              <EmojiPicker
                open={emoji}
                onClose={() => setEmoji(false)}
                onPick={(e) => {
                  setDraft((d) => d + e);
                  setEmoji(false);
                  void client.sendTyping(room.id);
                }}
              />
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void send(f);
              }}
            />
            <textarea
              className="max-h-[150px] min-h-[34px] flex-1 resize-none bg-transparent px-1 py-1.5 text-[13.5px] leading-[1.5] outline-none placeholder:text-[var(--ink-faint)]"
              placeholder={`Message @${name} — encrypted in this tab before it leaves`}
              value={draft}
              rows={1}
              onChange={(e) => {
                setDraft(e.target.value);
                void client.sendTyping(room.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <span className="mono px-1 text-[9.5px] text-[var(--ink-faint)]">
              {draft.length ? `${draft.length}c → ${Math.ceil(draft.length * 1.4)}B ct` : ""}
            </span>
          </div>
          <button className="btn btn-primary" onClick={() => void send()} disabled={sending || (!draft.trim() && !reply)}>
            {sending ? <Icon name="refresh" size={15} className="animate-spin" /> : <Icon name="send" size={15} />}
            seal & send
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="kicker">ttl</span>
          {[
            { l: "off", ms: null },
            { l: "30s", ms: 30_000 },
            { l: "2m", ms: 120_000 },
            { l: "15m", ms: 900_000 },
            { l: "1h", ms: 3_600_000 },
            { l: "1d", ms: 86_400_000 },
          ].map((o) => (
            <button
              key={o.l}
              onClick={() => {
                setTtl(o.ms);
                void client.setRoomTtl(room.id, o.ms);
              }}
              className={`chip transition ${ttl === o.ms ? "!border-[rgba(79,240,182,.5)] !bg-[rgba(79,240,182,.14)] !text-[#a9ffe2]" : "hover:bg-white/5"}`}
            >
              {o.l}
            </button>
          ))}
          <span className="flex-1" />
          <span className="mono text-[9.5px] text-[var(--ink-faint)]">enter send · shift+enter newline</span>
        </div>
      </footer>
    </section>
  );
}
