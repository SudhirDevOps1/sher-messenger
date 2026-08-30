"use client";

/**
 * SHER Messenger client engine.
 *
 * Responsibilities:
 *  - derive the vault key from the passphrase (PBKDF2-SHA-256, 750k rounds) and keep it
 *    only in memory (sessionStorage holds the raw key for this tab only)
 *  - run X3DH-lite + Double Ratchet for every conversation, locally
 *  - talk to the relay with ciphertext only
 *  - maintain an encrypted local message store (localStorage) with TTL burn timers
 *  - expose a subscribable store so React can render it
 */

import {
  type B64,
  type Bytes,
  VAULT_ITERATIONS,
  b64d,
  b64e,
  constantTimeEqualStr,
  deriveRoomId,
  deriveVaultKey,
  deriveVerifier,
  fromUtf8,
  isB64,
  openAead,
  packEnvelope,
  randomToken,
  rnd,
  safetyNumber,
  seal,
  sha256,
  stripExifMetadata,
  unpackEnvelope,
  utf8,
} from "./primitives";
import { outbox } from "./outbox";
import {
  OPK_COUNT,
  type GroupState,
  type LocalIdentity,
  type MsgHeader,
  type PublicBundle,
  type Session,
  createGroupState,
  createIdentity,
  decryptAttachment,
  encryptAttachment,
  generateHardcoreKey,
  groupDecrypt,
  groupEncrypt,
  ephemeralEncrypt,
  ephemeralDecrypt,
  ratchetDecrypt,
  ratchetEncrypt,
  verifyBundle,
} from "./protocol";

/* ------------------------------------------------------------------ types */

export interface AttachmentRef {
  id: string;
  key: B64;
  sha: B64;
  name: string;
  mime: string;
  size: number;
}

export interface HistMsg {
  id: string;
  roomId: string;
  from: string;
  me: boolean;
  kind: "msg" | "file" | "system";
  text: string;
  at: number;
  expiresAt: number | null;
  destroyed: boolean;
  attachment: AttachmentRef | null;
  readBy: string[];
  reactions: Record<string, string[]>;
  replyTo: string | null;
  verified: boolean;
  seq: number;
}

export interface Contact {
  userId: string;
  username: string;
  ikPub: B64;
  spkPub: B64;
  verified: boolean;
  safety: string;
  addedAt: number;
  keyChangedAt?: number | null;
}

export interface Room {
  id: string;
  type: "dm" | "group";
  peerId?: string;
  name?: string;
  members: string[];
  ttl: number | null;
  createdAt: number;
  pinned?: boolean;
  muted?: boolean;
  verifiedPeer?: boolean;
}

export interface LedgerEntry {
  t: number;
  kind: string;
  note: string;
}

export interface Settings {
  ttlMs: number;
  requireVerified: boolean;
  blurOnBackground: boolean;
  clearClipboard: boolean;
  readReceipts: boolean;
  typingIndicators: boolean;
  lockOnIdleMs: number;
}

export const DEFAULT_SETTINGS: Settings = {
  ttlMs: 0,
  requireVerified: false,
  blurOnBackground: true,
  clearClipboard: true,
  readReceipts: true,
  typingIndicators: true,
  lockOnIdleMs: 0,
};

export interface VaultData {
  version: 1;
  username: string;
  identity: LocalIdentity | null;
  contacts: Record<string, Contact>;
  sessions: Record<string, Session>;
  groups: Record<string, GroupState>;
  rooms: Record<string, Room>;
  history: Record<string, HistMsg[]>;
  ledger: LedgerEntry[];
  settings: Settings;
  cursor: number;
  seen: Record<string, 1>;
  profileEnc: string;
}

export interface RelayItem {
  seq: number;
  id: string;
  roomId: string;
  senderId: string;
  kind: string;
  header: MsgHeader;
  body: string | null;
  createdAt: string;
  expiresAt: string | null;
  destroyedAt: string | null;
}

export interface RelayRoom {
  id: string;
  type: string;
  createdAt: string;
  nameEnc: string | null;
  defaultTtl: number | null;
  members: string[];
  names: Record<string, string>;
}

const API = "/api/ked";
const HISTORY_CAP = 300;
const LEDGER_CAP = 120;
const RESUME_KEY = "ked.resume.v1";

/* ------------------------------------------------------------------ storage helpers */

const ls = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* quota */
    }
  },
  del(k: string) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

const ss = {
  get(k: string): string | null {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      sessionStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
  del(k: string) {
    try {
      sessionStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

export const vaultKeyFor = (username: string) => `ked.vault.v1.${username.toLowerCase()}`;

/**
 * The relay's own route handler always returns JSON (see the `guarded()` wrapper in
 * `route.ts`) — but this client has to survive whatever sits *in front* of that route
 * too: a proxy timeout, a CDN's own 502/504 page, a misconfigured rewrite on some
 * hosts, or simply no network at all. All of those come back as HTML, plain text, or
 * nothing, and a raw `JSON.parse` on that would throw the cryptic native error
 * `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` — which reads like a crypto
 * bug but is really "the relay didn't answer". We turn every one of those cases into a
 * single, readable `Error` instead.
 */
async function req<T>(token: string | null, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}/${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...((init.headers as Record<string, string>) || {}),
      },
    });
  } catch {
    throw new Error("cannot reach the relay — check your connection and try again");
  }

  const text = await res.text().catch(() => "");
  const looksJson = text === "" || /^\s*[[{]/.test(text);
  if (!looksJson) {
    const hint = /<!doctype|<html/i.test(text) ? "the relay returned a web page instead of JSON (proxy/deploy misconfiguration?)" : "the relay returned a non-JSON response";
    throw new Error(`${hint} — HTTP ${res.status}${res.status ? "" : " (network error)"}`);
  }

  let data: Record<string, unknown>;
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`the relay's response could not be parsed (HTTP ${res.status}) — please retry`);
  }
  if (!res.ok) throw new Error(String(data?.error ?? `relay error ${res.status}`));
  return data as T;
}

/* ------------------------------------------------------------------ engine */

export class KedClient {
  token: string | null = null;
  userId = "";
  username = "";
  data!: VaultData;
  connected = false;
  error: string | null = null;
  typingPeers: Record<string, number> = {};
  lastPoll = 0;
  stats: Record<string, unknown> | null = null;
  isGuest = false;
  roomCode?: string;
  roomKey?: string;
  roomExpiresAt?: number;

  private keyBytes: Bytes | null = null;
  private keySalt = "";
  private timer: ReturnType<typeof setInterval> | null = null;
  private burn: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<() => void>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPush = 0;
  private inflight = new Map<string, string>();
  attachmentCache = new Map<string, string>();
  outboxCount = 0;
  onInbound?: (item: RelayItem, value: Record<string, unknown>) => Promise<void>;
  online = true;

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private notify() {
    for (const fn of this.listeners) fn();
  }

  static async createGuestRoom(opts: {
    displayName: string;
    roomName?: string;
    maxUsers?: number;
    ttlMs?: number;
    hardcore?: boolean;
  }): Promise<{ client: KedClient; code: string; roomId: string; key: string; expiresAt: string }> {
    const c = new KedClient();
    c.isGuest = true;
    const name = opts.displayName.trim() || `Guest-${randomToken(4)}`;
    c.username = name;
    const anonUserId = `u_anon_${randomToken(12)}`;
    c.userId = anonUserId;
    c.data = emptyVault(name);
    c.data.identity = await createIdentity();
    c.keyBytes = rnd(32);
    c.keySalt = b64e(rnd(16));

    const hardcoreKey = opts.hardcore !== false ? generateHardcoreKey() : "";
    c.roomKey = hardcoreKey;

    const maxUsers = opts.maxUsers ?? 10;
    const ttlMs = opts.ttlMs ?? 30 * 60_000;
    const roomTitle = opts.roomName?.trim() || "Ephemeral Room";

    const res = await req<{ ok: boolean; roomId: string; code: string; maxUsers: number; expiresAt: string }>(null, "rooms/code", {
      method: "POST",
      body: JSON.stringify({
        anonId: anonUserId,
        nameEnc: roomTitle,
        maxUsers,
        ttlMs,
      }),
    });

    c.roomCode = res.code;
    c.roomExpiresAt = Date.parse(res.expiresAt);

    const gid = res.roomId;
    c.data.rooms[gid] = {
      id: gid,
      type: "group",
      name: roomTitle,
      members: [anonUserId],
      ttl: ttlMs,
      createdAt: Date.now(),
    };
    c.data.groups[gid] = {
      id: gid,
      self: anonUserId,
      own: { k: b64e(rnd(32)), n: 0 },
      peers: {},
    };

    c.startGuest(gid);
    return { client: c, code: res.code, roomId: res.roomId, key: hardcoreKey, expiresAt: res.expiresAt };
  }

  static async joinGuestRoom(opts: { displayName: string; code: string; key?: string }): Promise<{ client: KedClient; roomId: string }> {
    const c = new KedClient();
    c.isGuest = true;
    const code = opts.code.trim().toLowerCase();
    const name = opts.displayName.trim() || `Guest-${randomToken(4)}`;
    c.username = name;
    c.roomCode = code;
    c.roomKey = opts.key?.trim() || "";
    const anonUserId = `u_anon_${randomToken(12)}`;
    c.userId = anonUserId;
    c.data = emptyVault(name);
    c.data.identity = await createIdentity();
    c.keyBytes = rnd(32);
    c.keySalt = b64e(rnd(16));

    const res = await req<{ ok: boolean; roomId: string; error?: string }>(null, "rooms/join", {
      method: "POST",
      body: JSON.stringify({
        code,
        anonId: anonUserId,
      }),
    });

    if (!res.ok) throw new Error(res.error || "Failed to join room");

    const gid = res.roomId;
    c.data.rooms[gid] = {
      id: gid,
      type: "group",
      name: `Room #${code.toUpperCase()}`,
      members: [anonUserId],
      ttl: 30 * 60_000,
      createdAt: Date.now(),
    };
    c.data.groups[gid] = {
      id: gid,
      self: anonUserId,
      own: { k: b64e(rnd(32)), n: 0 },
      peers: {},
    };

    c.startGuest(gid);
    return { client: c, roomId: gid };
  }

  private startGuest(roomId: string) {
    if (this.timer) clearInterval(this.timer);
    this.connected = true;
    this.timer = setInterval(() => void this.pollGuest(roomId), 1500);
    this.burn = setInterval(() => this.burnDue(), 700);
    void this.pollGuest(roomId);
  }

  async pollGuest(roomId: string): Promise<void> {
    this.lastPoll = Date.now();
    let res: { items: RelayItem[]; next: number };
    try {
      res = await req<typeof res>(null, `sync?anonId=${encodeURIComponent(this.userId)}&cursor=${this.data.cursor}&limit=150`);
    } catch (e) {
      this.error = (e as Error).message;
      return;
    }
    this.error = null;
    let touched = false;
    for (const item of res.items) {
      if (this.data.seen[item.id]) continue;
      touched = true;
      await this.handle(item);
      this.data.seen[item.id] = 1;
    }
    if (res.next > this.data.cursor) this.data.cursor = res.next;
    if (touched || res.items.length) {
      this.notify();
    }
  }

  static async register(opts: { username: string; passphrase: string; device?: string; inviteCode?: string }): Promise<KedClient> {
    const c = new KedClient();
    c.username = opts.username.trim().toLowerCase();
    c.data = emptyVault(c.username);
    c.data.identity = await createIdentity();
    const salt = b64e(rnd(16));
    // deterministic, public, per-username salt: the *verifier* is reproducible without
    // ever being derivable into the vault key (which uses `salt`, a random per-account value)
    const authSalt = `ked-auth-v1:${c.username}`;
    const vault = await deriveVaultKey(opts.passphrase, salt);
    const verifier = await deriveVerifier(opts.passphrase, authSalt);
    c.keyBytes = vault.bytes;
    c.keySalt = salt;
    const res = await req<{ token: string; userId: string; username: string }>(null, "register", {
      method: "POST",
      body: JSON.stringify({
        username: c.username,
        vaultSalt: salt,
        vaultBlob: await c.encryptVault(),
        authSalt,
        authVerifier: verifier,
        ikPub: c.data.identity.ik.pub,
        spkPub: c.data.identity.spk.pub,
        spkSig: c.data.identity.spkSig,
        opkPubs: c.data.identity.opks.map((k) => k.pub),
        inviteCode: opts.inviteCode || undefined,
      }),
    });
    c.token = res.token;
    c.userId = res.userId;
    c.username = res.username;
    c.data.username = res.username;
    c.ledger("identity.created", `${OPK_COUNT} one-time prekeys published, private keys never left this device`);
    await c.persist();
    c.start();
    return c;
  }

  static async unlock(opts: { username: string; passphrase: string }): Promise<KedClient> {
    const c = new KedClient();
    const username = opts.username.trim().toLowerCase();
    const res = await req<{
      token: string;
      userId: string;
      vaultSalt: string;
      vaultBlob: string;
      username: string;
    }>(null, "login", {
      method: "POST",
      body: JSON.stringify({
        username,
        authVerifier: await deriveVerifier(opts.passphrase, `ked-auth-v1:${username}`),
      }),
    });
    // the relay salt for the verifier is stored client-side so the same verifier reproduces
    void res;
    return c.finishLogin(username, opts.passphrase, res);
  }

  private async finishLogin(
    username: string,
    passphrase: string,
    res: { token: string; userId: string; vaultSalt: string; vaultBlob: string; username: string },
  ): Promise<KedClient> {
    this.token = res.token;
    this.userId = res.userId;
    this.username = res.username;
    // Prefer the copy on this device; otherwise fall back to the relay's encrypted
    // mirror (which is transported as `v1.<iv>.<ciphertext>`, never as bare base64).
    const local = ls.get(vaultKeyFor(username));
    const localBlob = local ? (JSON.parse(local) as { n?: string; c?: string; salt?: string }) : null;
    const hasLocal = !!(localBlob?.c && localBlob?.n);
    const useSalt = (hasLocal ? localBlob?.salt : null) ?? res.vaultSalt;
    if (!hasLocal && !res.vaultBlob)
      throw new Error("no vault blob on this device and none mirrored on the relay — create a new identity or restore a backup");
    let envelope;
    try {
      envelope = hasLocal ? { n: localBlob!.n!, c: localBlob!.c! } : unpackEnvelope(res.vaultBlob, "relay vault mirror");
    } catch (e) {
      throw new Error(`${(e as Error).message} — restore an encrypted export or register a fresh identity`);
    }
    const vault = await deriveVaultKey(passphrase, useSalt);
    let plain: string;
    try {
      plain = fromUtf8(await openAead(vault.bytes, envelope, utf8(username)));
    } catch {
      throw new Error("vault did not decrypt: wrong passphrase for this handle (or the blob belongs to another account)");
    }
    this.keyBytes = vault.bytes;
    this.keySalt = useSalt;
    this.data = { ...emptyVault(username), ...(JSON.parse(plain) as VaultData), username };
    this.ledger("session.resumed", "vault decrypted locally; relay only supplied ciphertext");
    await this.persist();
    this.start();
    return this;
  }

  /** Fast resume: key material lives in sessionStorage for the lifetime of the tab. */
  static async quick(): Promise<KedClient | null> {
    const raw = ss.get(RESUME_KEY);
    if (!raw) return null;
    try {
      const s = JSON.parse(raw) as { username: string; token: string; key: B64 };
      const blob = ls.get(vaultKeyFor(s.username));
      if (!blob || !s.username || !isB64(s.key)) return null;
      const { salt, ...stored } = JSON.parse(blob) as { n: string; c: string; salt: string };
      const envelope = unpackEnvelope(JSON.stringify(stored), "local vault");
      const key = b64d(s.key, "tab resume key");
      const plain = fromUtf8(await openAead(key, envelope, utf8(s.username)));
      const c2 = new KedClient();
      c2.token = s.token;
      c2.username = s.username;
      c2.keyBytes = key;
      c2.keySalt = salt;
      c2.data = { ...emptyVault(s.username), ...(JSON.parse(plain) as VaultData) };
      c2.userId = c2.data.identity ? c2.data.cursor >= 0 ? c2.userId || "" : "" : "";
      const me = await req<{ userId: string; username: string } | null>(s.token, "me").catch(() => null);
      if (!me) {
        ss.del(RESUME_KEY);
        return null;
      }
      c2.userId = me.userId;
      c2.username = me.username;
      c2.ledger("session.resumed", "restored from tab-local key + relay session token");
      c2.start();
      return c2;
    } catch {
      ss.del(RESUME_KEY);
      return null;
    }
  }

  static wipeLocal(username: string) {
    ls.del(vaultKeyFor(username));
    ss.del(RESUME_KEY);
  }

  /* ---------------- vault crypto */

  private async encryptVault(): Promise<B64> {
    if (!this.keyBytes) throw new Error("vault key missing");
    const env = await seal(this.keyBytes, utf8(JSON.stringify(this.data)), utf8(this.username));
    ls.set(vaultKeyFor(this.username), JSON.stringify({ ...env, salt: this.keySalt, at: Date.now() }));
    ss.set(RESUME_KEY, JSON.stringify({ username: this.username, token: this.token, key: b64e(this.keyBytes) }));
    return packEnvelope(env);
  }

  /** Encrypt + write the local vault. Relay mirror is throttled (metadata only). */
  persistNow = async () => {
    if (this.isGuest) {
      this.notify();
      return;
    }
    if (!this.keyBytes) return;
    const blob = await this.encryptVault();
    if (this.token && Date.now() - this.lastPush > 5000) {
      this.lastPush = Date.now();
      void req(this.token, "vault", {
        method: "POST",
        body: JSON.stringify({ vaultSalt: this.keySalt, vaultBlob: blob }),
      }).catch(() => undefined);
    }
    void blob;
    this.notify();
  };

  private persist(): Promise<void> {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.persistNow(), 120);
    return this.persistNow();
  }

  private ledger(kind: string, note: string) {
    this.data.ledger = [{ t: Date.now(), kind, note }, ...this.data.ledger].slice(0, LEDGER_CAP);
  }

  /* ---------------- lifecycle */

  private start() {
    if (this.timer) clearInterval(this.timer);
    this.connected = true;
    this.timer = setInterval(() => void this.poll(), 1600);
    this.burn = setInterval(() => this.burnDue(), 700);
    void this.poll();
    void req<{ adapter: string }>(null, "stats").then((s) => {
      this.stats = s as unknown as Record<string, unknown>;
      this.notify();
    });
  }

  stop() {
    this.connected = false;
    if (this.timer) clearInterval(this.timer);
    if (this.burn) clearInterval(this.burn);
    this.timer = null;
    this.burn = null;
  }

  private burnDue() {
    const now = Date.now();
    let dirty = false;
    for (const [roomId, list] of Object.entries(this.data.history)) {
      for (const m of list) {
        if (m.expiresAt && !m.destroyed && m.expiresAt <= now) {
          m.destroyed = true;
          m.text = "";
          m.attachment = null;
          dirty = true;
          this.ledger("message.burned", `local copy of ${m.id.slice(0, 10)} destroyed in ${roomId.slice(0, 8)}`);
        }
      }
    }
    if (dirty) {
      void this.persist();
      this.notify();
    }
  }

  /* ---------------- sync */

  async poll(): Promise<void> {
    if (!this.token) return;
    this.lastPoll = Date.now();
    let res: { items: RelayItem[]; next: number; serverShredded?: number };
    try {
      res = await req<typeof res>(this.token, `sync?cursor=${this.data.cursor}&limit=150`);
    } catch (e) {
      this.error = (e as Error).message;
      if (this.online) this.online = false;
      this.outboxCount = await outbox.count();
      this.notify();
      return;
    }
    this.error = null;
    if (!this.online) {
      this.online = true;
      void this.flushOutbox();
    }
    let touched = false;
    for (const item of res.items) {
      if (this.data.seen[item.id]) continue;
      touched = true;
      await this.handle(item);
      this.data.seen[item.id] = 1;
      if (Object.keys(this.data.seen).length > 4000) this.data.seen = { [item.id]: 1 };
    }
    if (res.next > this.data.cursor) this.data.cursor = res.next;
    if (touched) {
      void this.persist();
      this.notify();
    } else if (res.items.length) {
      this.notify();
    }
  }

  private async handle(item: RelayItem) {
    const room = this.data.rooms[item.roomId];
    if (!room) return;
    if (item.destroyedAt || !item.body) {
      const existing = this.data.history[item.roomId]?.find((m) => m.id === item.id);
      if (existing) {
        existing.destroyed = true;
        existing.text = "";
        existing.attachment = null;
      }
      this.ledger("relay.shredded", `${item.id.slice(0, 10)} zeroed at the relay`);
      return;
    }
    const mine = item.senderId === this.userId;
    const isGroup = room.type === "group";
    const peerId = mine ? room.peerId ?? "" : item.senderId;
    let value: Record<string, unknown>;
    try {
      if (this.isGuest || (isGroup && (!this.data.groups[item.roomId] || Object.keys(this.data.groups[item.roomId].peers).length === 0))) {
        const out = await ephemeralDecrypt(item.roomId, item.header, item.body, this.roomCode, this.roomKey);
        value = out.value as Record<string, unknown>;
      } else if (isGroup) {
        const g = this.data.groups[item.roomId];
        if (!g) return;
        const out = await groupDecrypt(g, item.senderId, item.header, item.body);
        this.data.groups[item.roomId] = out.group;
        value = out.value as Record<string, unknown>;
      } else {
        const key = peerId || item.senderId;
        const out = await ratchetDecrypt(this.data.identity!, this.data.sessions[key] ?? null, item.header, item.body);
        out.session.peerId = item.senderId;
        this.data.sessions[key] = out.session;
        value = out.value as Record<string, unknown>;
        if (out.resumed) this.ledger("session.opened", `X3DH handshake completed with ${key.slice(0, 8)} (prekey message)`);
      }
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.startsWith("AUTH_FAILED")) this.ledger("integrity.violation", msg);
      else this.ledger("decrypt.skipped", `${msg} · ${item.kind}`);
      return;
    }
    const t = String(value.t ?? "msg");
    if (t === "typing") {
      if (!mine) this.typingPeers[item.roomId] = Date.now();
      this.notify();
      return;
    }
    if (t === "receipt") {
      const ids = Array.isArray(value.ids) ? (value.ids as string[]) : [];
      for (const id of ids) {
        const m = this.data.history[item.roomId]?.find((x) => x.id === id && x.me);
        if (m && !m.readBy.includes(item.senderId)) {
          m.readBy.push(item.senderId);
          this.ledger("receipt.read", `${id.slice(0, 10)} read by ${item.senderId.slice(0, 8)}`);
        }
      }
      return;
    }
    if (t === "reaction" || t === "edit" || t === "recall") {
      const targetId = String(value.target ?? "");
      const list = this.data.history[item.roomId] ?? [];
      const target = list.find((m) => m.id === targetId);
      if (target) {
        if (t === "reaction") {
          const emoji = String(value.emoji ?? "");
          const cur = target.reactions[emoji] ?? [];
          target.reactions[emoji] = cur.includes(item.senderId) ? cur : [...cur, item.senderId];
        } else if (t === "edit") {
          target.text = String(value.text ?? "").slice(0, 8000);
          target.verified = target.verified;
        } else {
          target.destroyed = true;
          target.text = "";
          target.attachment = null;
          this.ledger("message.recalled", `${targetId.slice(0, 10)} removed for everyone`);
        }
      }
      void req(this.token, "shred", { method: "POST", body: JSON.stringify({ ids: t === "recall" ? [targetId] : [] }) }).catch(() => undefined);
      return;
    }
    if (t === "control" && value.action === "group-add") {
      const groupId = String(item.roomId);
      void groupId;
      const gid = String(value.groupId);
      const seeds = value.seeds as Record<string, { k: B64; n: number }>;
      const own = seeds[this.userId];
      const peers: Record<string, { k: B64; n: number }> = {};
      for (const [k, v] of Object.entries(seeds)) if (k !== this.userId) peers[k] = v;
      this.data.groups[gid] = {
        id: gid,
        self: this.userId,
        own: own ?? { k: b64e(rnd(32)), n: 0 },
        peers,
      };
      if (!this.data.rooms[gid])
        this.data.rooms[gid] = {
          id: gid,
          type: "group",
          name: String(value.name ?? "group"),
          members: Array.isArray(value.members) ? (value.members as string[]) : [],
          ttl: typeof value.ttl === "number" ? value.ttl : null,
          createdAt: Date.now(),
        };
      this.pushSystem(gid, `You were added to “${String(value.name ?? "group")}” — sender keys received over your verified 1:1 session.`);
      this.ledger("group.joined", `${String(value.name ?? "group")} · sender keys installed`);
      if (this.onInbound) await this.onInbound(item, { ...value, t: "group-add" });
      return;
    }
    if (t === "group-hello" && this.onInbound) {
      await this.onInbound(item, value);
      return;
    }

    const history = this.data.history[item.roomId] ?? [];
    const existingIndex = history.findIndex((m) => m.id === item.id);
    const existing = existingIndex >= 0 ? history[existingIndex] : null;

    const msg: HistMsg = {
      id: item.id,
      roomId: item.roomId,
      from: item.senderId,
      me: mine,
      kind: item.kind === "file" ? "file" : "msg",
      text: String(value.text ?? "").slice(0, 12_000),
      at: typeof value.at === "number" ? value.at : Date.parse(item.createdAt),
      expiresAt: item.expiresAt ? Date.parse(item.expiresAt) : null,
      destroyed: false,
      attachment: (value.attachment as AttachmentRef) ?? null,
      readBy: existing ? existing.readBy : [],
      reactions: existing ? existing.reactions : {},
      replyTo: value.replyTo ? String(value.replyTo) : null,
      verified: true,
      seq: item.seq,
    };
    if (existingIndex >= 0) {
      history[existingIndex] = { ...existing, ...msg };
      this.data.history[item.roomId] = [...history];
    } else {
      this.data.history[item.roomId] = [...history, msg].slice(-HISTORY_CAP);
    }
    if (!mine && this.data.settings.readReceipts) void this.sendReceipt(item.roomId, [item.id]);
    if (!mine && this.onInbound) await this.onInbound(item, value as Record<string, unknown>);
  }

  private pushSystem(roomId: string, text: string) {
    const list = this.data.history[roomId] ?? [];
    this.data.history[roomId] = [
      ...list,
      {
        id: `sys_${randomToken(6)}`,
        roomId,
        from: "system",
        me: false,
        kind: "system" as const,
        text,
        at: Date.now(),
        expiresAt: null,
        destroyed: false,
        attachment: null,
        readBy: [],
        reactions: {},
        replyTo: null,
        verified: true,
        seq: this.data.cursor,
      },
    ].slice(-HISTORY_CAP);
  }

  /* ---------------- outbound */

  private async ensureDmSession(peerId: string): Promise<{ session: Session; prekey?: { e: B64; o?: number }; contact: Contact }> {
    const existing = this.data.sessions[peerId];
    const contact0 = this.data.contacts[peerId];
    if (existing && contact0) return { session: existing, contact: contact0 };
    const bundle = await this.fetchBundle(peerId);
    const { session, prekey } = await x3dhStart(this.data.identity!, bundle);
    const safety = await safetyNumber(this.data.identity!.ik.pub, this.data.identity!.spk.pub, bundle.ikPub, bundle.spkPub);
    const contact: Contact =
      contact0 ??
      {
        userId: bundle.userId,
        username: bundle.username,
        ikPub: bundle.ikPub,
        spkPub: bundle.spkPub,
        verified: false,
        safety,
        addedAt: Date.now(),
      };
    this.data.sessions[peerId] = session;
    return { session, prekey, contact };
  }

  async fetchBundle(userId: string, consumeOpk = true): Promise<PublicBundle> {
    const b = await req<PublicBundle>(this.token, "bundle", {
      method: "POST",
      body: JSON.stringify({ userId, consumeOpk }),
    });
    if (!(await verifyBundle(b))) throw new Error("KEY_SUBSTITUTION: signed prekey did not verify against the identity key");
    return b;
  }

  async addContact(username: string): Promise<Contact> {
    const found = await req<{ results: { userId: string; username: string; ikPub: string; spkPub: string }[] }>(
      this.token,
      `lookup?q=${encodeURIComponent(username)}`,
    );
    const hit = found.results.find((r) => r.username.toLowerCase() === username.toLowerCase());
    if (!hit) throw new Error("no such identity on this relay");
    const bundle = await this.fetchBundle(hit.userId, false);
    const roomId = await deriveRoomId(this.data.identity!.ik.pub, bundle.ikPub);
    await req(this.token, "rooms", {
      method: "POST",
      body: JSON.stringify({ roomId, type: "dm", members: [hit.userId] }),
    });
    const safety = await safetyNumber(this.data.identity!.ik.pub, this.data.identity!.spk.pub, bundle.ikPub, bundle.spkPub);
    const contact: Contact = {
      userId: bundle.userId,
      username: bundle.username,
      ikPub: bundle.ikPub,
      spkPub: bundle.spkPub,
      verified: false,
      safety,
      addedAt: Date.now(),
    };
    this.data.contacts[bundle.userId] = contact;
    this.data.rooms[roomId] = {
      id: roomId,
      type: "dm",
      peerId: bundle.userId,
      name: bundle.username,
      members: [this.userId, bundle.userId],
      ttl: this.data.settings.ttlMs || null,
      createdAt: Date.now(),
      verifiedPeer: false,
    };
    this.ledger("contact.added", `${bundle.username} · safety number computed out-of-band check pending`);
    await this.persist();
    this.notify();
    return contact;
  }

  async removeContact(userId: string) {
    const contact = this.data.contacts[userId];
    delete this.data.contacts[userId];
    for (const [rid, room] of Object.entries(this.data.rooms))
      if (room.type === "dm" && room.peerId === userId) {
        delete this.data.rooms[rid];
        delete this.data.history[rid];
      }
    delete this.data.sessions[userId];
    this.ledger("contact.removed", `${contact?.username ?? userId.slice(0, 8)} · sessions and history purged locally`);
    await this.persist();
    this.notify();
  }

  async verifyContact(userId: string, verified: boolean) {
    const c = this.data.contacts[userId];
    if (!c) return;
    c.verified = verified;
    this.ledger(verified ? "trust.onboard" : "trust.revoked", `safety number for ${c.username} marked ${verified ? "verified" : "unverified"}`);
    for (const room of Object.values(this.data.rooms)) if (room.peerId === userId) room.verifiedPeer = verified;
    await this.persist();
    this.notify();
  }

  async createRoomMessage(roomId: string, kind: string, payload: Record<string, unknown>, ttlMs: number | null, explicitId?: string) {
    const room = this.data.rooms[roomId];
    if (!room) throw new Error("unknown room");
    let wire: { header: MsgHeader; body: B64 };
    if (this.isGuest || (room.type === "group" && (!this.data.groups[roomId] || Object.keys(this.data.groups[roomId].peers).length === 0))) {
      const out = await ephemeralEncrypt(
        this.data.identity!,
        roomId,
        payload,
        (this.data.history[roomId]?.length ?? 0) + 1,
        this.roomCode,
        this.roomKey
      );
      wire = out.wire;
    } else if (room.type === "group") {
      const g = this.data.groups[roomId] ?? (await createGroupState(roomId, this.userId));
      const out = await groupEncrypt(this.data.identity!, g, payload);
      this.data.groups[roomId] = out.group;
      wire = out.wire;
    } else {
      const peer = room.peerId!;
      const { session, prekey } = await this.ensureDmSession(peer);
      const out = await ratchetEncrypt(this.data.identity!, session, payload, prekey ? { prekey } : {});
      this.data.sessions[peer] = out.session;
      wire = out.wire;
    }
    const res = await req<{ id: string; seq: number; expiresAt: string | null }>(this.token, "send", {
      method: "POST",
      body: JSON.stringify({
        id: explicitId ?? undefined,
        roomId,
        kind,
        header: JSON.stringify(wire.header),
        body: wire.body,
        ttlMs: ttlMs ?? undefined,
        anonId: this.isGuest ? this.userId : undefined,
      }),
    });
    return { res, header: wire.header };
  }

  async send(opts: { roomId: string; text: string; ttlMs?: number | null; replyTo?: string | null; file?: File | null; groupId?: string }) {
    const text = opts.text.slice(0, 12_000).trim();
    if (!text && !opts.file) throw new Error("nothing to send");
    if (this.data.settings.requireVerified) {
      const room = this.data.rooms[opts.roomId];
      if (room?.type === "dm" && !this.data.contacts[room.peerId ?? ""]?.verified)
        throw new Error("blocked by your policy: verify the safety number before sending to this contact");
    }
    let attachment: AttachmentRef | null = null;
    if (opts.file) {
      if (opts.file.size > 2_000_000) throw new Error("file too large for this relay (2 MB limit)");
      const sanitized = await stripExifMetadata(opts.file);
      const enc = await encryptAttachment(sanitized.buf, sanitized.name, sanitized.mime);
      const up = await req<{ id: string }>(this.token, "attachment", {
        method: "POST",
        body: JSON.stringify({ roomId: opts.roomId, data: enc.cipherB64, sha: enc.key.sha, ttlMs: opts.ttlMs ?? undefined }),
      });
      attachment = { ...enc.key, id: up.id };
    }
    const room = this.data.rooms[opts.roomId];
    const ttl = opts.ttlMs ?? room?.ttl ?? this.data.settings.ttlMs ?? 0;
    const payload = { t: "msg", text, at: Date.now(), replyTo: opts.replyTo ?? null, attachment };
    const localId = `m_${randomToken(16)}`;
    try {
      const { res } = await this.createRoomMessage(opts.roomId, attachment ? "file" : "msg", payload, ttl || null, localId);
      var wireId = res.id;
      var wireSeq = res.seq;
      var wireExp = res.expiresAt;
    } catch (e) {
      // relay unreachable → seal now, queue the ciphertext, drain later
      const sealed = await this.sealForOutbox(opts.roomId, payload, ttl || null);
      await outbox.enqueue({ id: localId, roomId: opts.roomId, kind: attachment ? "file" : "msg", header: sealed.header, body: sealed.body, ttlMs: ttl || null });
      this.outboxCount = await outbox.count();
      this.ledger("outbox.queued", `${(text || "attachment").slice(0, 20)}… sealed now, flushes when the relay answers`);
      await this.persist();
      this.notify();
      const queued: HistMsg = {
        id: localId,
        roomId: opts.roomId,
        from: this.userId,
        me: true,
        kind: attachment ? "file" : "msg",
        text,
        at: Date.now(),
        expiresAt: ttl ? Date.now() + ttl : null,
        destroyed: false,
        attachment,
        readBy: [],
        reactions: {},
        replyTo: opts.replyTo ?? null,
        verified: true,
        seq: 0,
      };
      this.data.history[opts.roomId] = [...(this.data.history[opts.roomId] ?? []), queued].slice(-HISTORY_CAP);
      return queued;
    }
    const msg: HistMsg = {
      id: wireId,
      roomId: opts.roomId,
      from: this.userId,
      me: true,
      kind: attachment ? "file" : "msg",
      text,
      at: Date.now(),
      expiresAt: wireExp ? Date.parse(wireExp) : null,
      destroyed: false,
      attachment,
      readBy: [],
      reactions: {},
      replyTo: opts.replyTo ?? null,
      verified: true,
      seq: wireSeq,
    };
    if (wireId) this.data.seen[wireId] = 1;
    const existingList = this.data.history[opts.roomId] ?? [];
    const idx = existingList.findIndex((m) => m.id === wireId);
    if (idx >= 0) {
      existingList[idx] = msg;
      this.data.history[opts.roomId] = [...existingList];
    } else {
      this.data.history[opts.roomId] = [...existingList, msg].slice(-HISTORY_CAP);
    }
    this.ledger("message.sealed", `${(text || attachment?.name || "file").slice(0, 24)}… → AES-256-GCM, ${ttl ? `burns in ${Math.round(ttl / 1000)}s` : "no TTL"}`);
    await this.persist();
    this.notify();
    return msg;
  }

  /** Encrypt without touching the network — used by the offline outbox. */
  private async sealForOutbox(roomId: string, payload: Record<string, unknown>, ttlMs: number | null) {
    const room = this.data.rooms[roomId];
    if (!room) throw new Error("unknown room");
    let wire: { header: MsgHeader; body: B64 };
    if (room.type === "group") {
      const g = this.data.groups[roomId] ?? (await createGroupState(roomId, this.userId));
      const out = await groupEncrypt(this.data.identity!, g, payload);
      this.data.groups[roomId] = out.group;
      wire = out.wire;
    } else {
      const { session, prekey } = await this.ensureDmSession(room.peerId!);
      const out = await ratchetEncrypt(this.data.identity!, session, payload, prekey ? { prekey } : {});
      this.data.sessions[room.peerId!] = out.session;
      wire = out.wire;
    }
    return { header: JSON.stringify(wire.header), body: wire.body };
  }

  /** Drain the offline outbox. Idempotent: ids are fixed at enqueue time. */
  async flushOutbox(): Promise<number> {
    const pending = await outbox.all();
    let sent = 0;
    for (const entry of pending) {
      if (outbox.shouldDrop(entry)) {
        await outbox.remove(entry.id);
        this.ledger("outbox.dropped", `${entry.id.slice(0, 10)} exceeded retry window`);
        continue;
      }
      try {
        const res = await req<{ id: string; seq?: number; expiresAt?: string | null }>(this.token, "send", {
          method: "POST",
          body: JSON.stringify({ id: entry.id, roomId: entry.roomId, kind: entry.kind, header: entry.header, body: entry.body, ttlMs: entry.ttlMs ?? undefined }),
        });
        await outbox.remove(entry.id);
        sent++;
        const list = this.data.history[entry.roomId] ?? [];
        const local = list.find((m) => m.id === entry.id);
        if (local) {
          local.seq = res.seq ?? 0;
          local.expiresAt = res.expiresAt ? Date.parse(res.expiresAt) : null;
        }
      } catch (e) {
        await outbox.bumpAttempt(entry, (e as Error).message);
      }
    }
    this.outboxCount = await outbox.count();
    if (sent) {
      this.ledger("outbox.flushed", `${sent} queued ciphertext row(s) delivered`);
      await this.persist();
      this.notify();
    }
    return sent;
  }

  async sendTyping(roomId: string) {
    if (!this.data.settings.typingIndicators) return;
    const stamp = this.inflight.get(`typing:${roomId}`);
    if (stamp && Date.now() - Number(stamp) < 3000) return;
    this.inflight.set(`typing:${roomId}`, String(Date.now()));
    await this.createRoomMessage(roomId, "typing", { t: "typing", at: Date.now() }, 8_000).catch(() => undefined);
  }

  async sendReceipt(roomId: string, ids: string[]) {
    await this.createRoomMessage(roomId, "receipt", { t: "receipt", ids }, null).catch(() => undefined);
  }

  async react(roomId: string, targetId: string, emoji: string) {
    const target = (this.data.history[roomId] ?? []).find((m) => m.id === targetId);
    if (!target) return;
    const cur = target.reactions[emoji] ?? [];
    target.reactions[emoji] = cur.includes(this.userId) ? cur.filter((x) => x !== this.userId) : [...cur, this.userId];
    await this.createRoomMessage(roomId, "reaction", { t: "reaction", target: targetId, emoji }, null).catch(() => undefined);
    await this.persist();
    this.notify();
  }

  async edit(roomId: string, targetId: string, text: string) {
    await this.createRoomMessage(roomId, "edit", { t: "edit", target: targetId, text: text.slice(0, 12_000) }, null);
    const target = (this.data.history[roomId] ?? []).find((m) => m.id === targetId);
    if (target) target.text = text;
    this.ledger("message.edited", `${targetId.slice(0, 10)} re-sealed with the next ratchet key`);
    await this.persist();
    this.notify();
  }

  async recall(roomId: string, targetId: string, alsoShred = true) {
    await this.createRoomMessage(roomId, "recall", { t: "recall", target: targetId }, null).catch(() => undefined);
    if (alsoShred) await req(this.token, "shred", { method: "POST", body: JSON.stringify({ ids: [targetId] }) }).catch(() => undefined);
    const target = (this.data.history[roomId] ?? []).find((m) => m.id === targetId);
    if (target) {
      target.destroyed = true;
      target.text = "";
      target.attachment = null;
    }
    this.ledger("message.recalled", `${targetId.slice(0, 10)} · shred requested on relay, local copy zeroed`);
    await this.persist();
    this.notify();
  }

  async burnRoom(roomId: string) {
    const list = this.data.history[roomId] ?? [];
    const ids = list.map((m) => m.id);
    if (ids.length) {
      await req(this.token, "shred", { method: "POST", body: JSON.stringify({ ids }) }).catch(() => undefined);
      for (const m of list) {
        m.destroyed = true;
        m.text = "";
        m.attachment = null;
      }
    }
    this.data.history[roomId] = [];
    this.ledger("room.burned", `${roomId.slice(0, 8)} · all messages incinerated and zeroed`);
    await this.persist();
    this.notify();
  }

  async setRoomTtl(roomId: string, ttlMs: number | null) {
    const room = this.data.rooms[roomId];
    if (!room) return;
    room.ttl = ttlMs;
    this.ledger("ttl.set", `${room.name ?? roomId.slice(0, 8)} · ${ttlMs ? `auto-burn after ${Math.round(ttlMs / 1000)}s` : "off"}`);
    await this.persist();
    this.notify();
  }

  async createGroup(name: string, memberIds: string[], ttlMs: number | null) {
    if (!memberIds.length) throw new Error("add at least one contact first");
    const gid = `grp_${randomToken(10)}`;
    const seeds: Record<string, { k: B64; n: number }> = {};
    for (const id of [...memberIds, this.userId]) seeds[id] = { k: b64e(rnd(32)), n: 0 };
    this.data.groups[gid] = {
      id: gid,
      self: this.userId,
      own: seeds[this.userId],
      peers: Object.fromEntries(Object.entries(seeds).filter(([k]) => k !== this.userId)),
    };
    await req(this.token, "rooms", {
      method: "POST",
      body: JSON.stringify({ roomId: gid, type: "group", members: memberIds, nameEnc: null, defaultTtl: ttlMs }),
    });
    this.data.rooms[gid] = {
      id: gid,
      type: "group",
      name,
      members: [...memberIds, this.userId],
      ttl: ttlMs,
      createdAt: Date.now(),
    };
    for (const m of memberIds) {
      await this.createRoomMessage(
        this.dmRoomIdFor(m) ?? (await this.ensureDmRoomFor(m)),
        "control",
        { t: "control", action: "group-add", groupId: gid, name, members: [...memberIds, this.userId], seeds, ttl: ttlMs },
        null,
      ).catch((e) => this.ledger("group.invite.failed", `${m.slice(0, 8)}: ${(e as Error).message}`));
    }
    this.ledger("group.created", `${name} · ${memberIds.length + 1} members, per-sender chains generated locally`);
    await this.persist();
    this.notify();
    return gid;
  }

  private dmRoomIdFor(userId: string): string | null {
    for (const r of Object.values(this.data.rooms)) if (r.type === "dm" && r.peerId === userId) return r.id;
    return null;
  }

  private async ensureDmRoomFor(userId: string): Promise<string> {
    const bundle = await this.fetchBundle(userId, false);
    const roomId = await deriveRoomId(this.data.identity!.ik.pub, bundle.ikPub);
    await req(this.token, "rooms", { method: "POST", body: JSON.stringify({ roomId, type: "dm", members: [userId] }) });
    if (!this.data.rooms[roomId])
      this.data.rooms[roomId] = {
        id: roomId,
        type: "dm",
        peerId: userId,
        name: bundle.username,
        members: [this.userId, userId],
        ttl: null,
        createdAt: Date.now(),
      };
    return roomId;
  }

  async rekeyGroup(gid: string) {
    const g = this.data.groups[gid];
    if (!g) return;
    const seeds: Record<string, { k: B64; n: number }> = {};
    for (const id of this.data.rooms[gid]?.members ?? []) seeds[id] = { k: b64e(rnd(32)), n: 0 };
    this.data.groups[gid] = { ...g, own: seeds[this.userId] ?? g.own, peers: Object.fromEntries(Object.entries(seeds).filter(([k]) => k !== this.userId)) };
    for (const m of this.data.rooms[gid].members.filter((x) => x !== this.userId)) {
      const room = this.dmRoomIdFor(m);
      if (!room) continue;
      await this.createRoomMessage(room, "control", { t: "control", action: "group-add", groupId: gid, name: this.data.rooms[gid].name, members: this.data.rooms[gid].members, seeds, ttl: this.data.rooms[gid].ttl }, null).catch(
        () => undefined,
      );
    }
    this.ledger("group.rekeyed", `${this.data.rooms[gid].name ?? gid.slice(0, 8)} · fresh sender chains (PCS for the group)`);
    await this.persist();
    this.notify();
  }

  async loadAttachment(att: AttachmentRef, roomId: string): Promise<string> {
    const hit = this.attachmentCache.get(att.id);
    if (hit) return hit;
    const res = await req<{ data: string }>(this.token, `attachment?id=${encodeURIComponent(att.id)}&room=${encodeURIComponent(roomId)}`);
    const bytes = await decryptAttachment(res.data, att);
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: att.mime }));
    this.attachmentCache.set(att.id, url);
    this.ledger("attachment.opened", `${att.name} · ${att.size}B decrypted + SHA-256 verified in-browser`);
    return url;
  }

  async rotateKeys() {
    if (!this.data.identity) throw new Error("no identity");
    const next = await createIdentity();
    this.data.identity = next;
    this.data.sessions = {};
    await req(this.token, "keychange", {
      method: "POST",
      body: JSON.stringify({ ikPub: next.ik.pub, spkPub: next.spk.pub, spkSig: next.spkSig, opkPubs: next.opks.map((k) => k.pub) }),
    });
    this.ledger("key.rotated", "new identity + signed prekey + OPK pool; existing sessions reset (safety numbers change)");
    await this.persist();
    this.notify();
  }

  async updateSettings(patch: Partial<Settings>) {
    this.data.settings = { ...this.data.settings, ...patch };
    this.ledger("settings.changed", Object.keys(patch).join(", "));
    await this.persist();
    this.notify();
  }

  async exportBackup(): Promise<string> {
    const payload = { app: "SHER Messenger", version: 1, exportedAt: new Date().toISOString(), data: this.data };
    const key = await sha256("KED-backup-v1", this.keyBytes ?? new Uint8Array(32));
    const env = await seal(key, utf8(JSON.stringify(payload)));
    return JSON.stringify({ note: "AES-256-GCM; key = SHA-256('backup' || vault key). Store offline.", ...env });
  }

  async panicWipe() {
    await req(this.token, "panic", { method: "POST", body: JSON.stringify({ confirm: "WIPE" }) }).catch(() => undefined);
    KedClient.wipeLocal(this.username);
    for (const k of Object.keys(this.data)) {
      /* fresh state below */
      void k;
    }
    this.data = emptyVault(this.username);
    this.token = null;
    this.stop();
    this.notify();
  }

  async ledgerOf(): Promise<{ event: string; detail: string | null; createdAt: string }[]> {
    return (await req<{ events: { event: string; detail: string | null; createdAt: string }[] }>(this.token, "ledger")).events;
  }

  async deviceList(): Promise<{ id: string; device: string | null; createdAt: string; expiresAt: string; current: boolean }[]> {
    const r = await req<{ devices: { id: string; device: string | null; createdAt: string; expiresAt: string; current: boolean }[] }>(this.token, "devices");
    return r.devices;
  }

  /** Profile lives inside the vault: the relay never sees name or bio in the clear. */
  async readProfile(): Promise<{ displayName: string; bio: string }> {
    const empty = { displayName: "", bio: "" };
    if (!this.data.profileEnc || !this.keyBytes) return empty;
    try {
      const env = unpackEnvelope(this.data.profileEnc, "profile");
      const plain = fromUtf8(await openAead(this.keyBytes, env));
      const o = JSON.parse(plain) as Partial<{ displayName: string; bio: string }>;
      return { displayName: o.displayName ?? "", bio: o.bio ?? "" };
    } catch {
      return empty;
    }
  }

  async setProfile(displayName: string, bio: string) {
    if (!this.keyBytes) throw new Error("vault key missing");
    const env = await seal(this.keyBytes, utf8(JSON.stringify({ displayName, bio })));
    this.data.profileEnc = packEnvelope(env);
    await req(this.token, "vault", { method: "POST", body: JSON.stringify({ vaultSalt: this.keySalt, vaultBlob: await this.encryptVault() }) }).catch(
      () => undefined,
    );
    this.ledger("profile.updated", "display name + bio encrypted with the vault key before upload");
    await this.persist();
    this.notify();
  }

  get myFingerprint(): Promise<string> {
    return import("./primitives").then(async (m) => m.fingerprint(this.data.identity?.ik.pub ?? ""));
  }
}

async function x3dhStart(id: LocalIdentity, bundle: PublicBundle) {
  const m = await import("./protocol");
  return m.x3dhAlice(id, bundle);
}

function emptyVault(username: string): VaultData {
  return {
    version: 1,
    username,
    identity: null,
    contacts: {},
    sessions: {},
    groups: {},
    rooms: {},
    history: {},
    ledger: [],
    settings: { ...DEFAULT_SETTINGS },
    cursor: 0,
    seen: {},
    profileEnc: "",
  };
}

/* ------------------------------------------------------------------ helpers for UI */

export async function computeFingerprint(pub: B64): Promise<string> {
  const m = await import("./primitives");
  return m.fingerprint(pub);
}

export async function computeSafety(mine: LocalIdentity | null, peer: Contact | null): Promise<string> {
  if (!mine || !peer) return "—";
  return safetyNumber(mine.ik.pub, mine.spk.pub, peer.ikPub, peer.spkPub);
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function countdown(expiresAt: number | null): string | null {
  if (!expiresAt) return null;
  const ms = expiresAt - Date.now();
  if (ms <= 0) return "burned";
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export const TTL_CHOICES: { label: string; ms: number }[] = [
  { label: "off", ms: 0 },
  { label: "30s", ms: 30_000 },
  { label: "2m", ms: 120_000 },
  { label: "15m", ms: 900_000 },
  { label: "1h", ms: 3_600_000 },
  { label: "1d", ms: 86_400_000 },
  { label: "7d", ms: 604_800_000 },
];

export { b64e, b64d, utf8, fromUtf8, constantTimeEqualStr, rnd };
