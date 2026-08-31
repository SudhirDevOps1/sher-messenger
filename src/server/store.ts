/**
 * SHER Messenger relay storage.
 *
 * One interface, four interchangeable backends chosen from env at boot:
 *   postgres     -> DATABASE_URL / POSTGRES_URL / NEON_DATABASE_URL   (Neon, Supabase, RDS, local)
 *   turso        -> TURSO_URL + TURSO_TOKEN                           (libSQL HTTP pipeline)
 *   sqlite-file  -> SHER_SQLITE_PATH                                   (node:sqlite, VPS / Docker)
 *   memory       -> default when nothing is configured                (edge / serverless demo)
 *
 * Adapters that must work on edge runtimes (Cloudflare Workers, Vercel Edge,
 * Netlify Edge) cannot open TCP sockets, so they use `turso` (HTTP) or `memory`.
 *
 * Nothing stored here is plaintext: bodies are AES-256-GCM ciphertext, private
 * keys live only in the client's PBKDF2-encrypted vault blob.
 */

import {
  isExternalStorageEnabled,
  uploadToExternalStorage,
  downloadFromExternalStorage,
  deleteFromExternalStorage,
} from "./storage";

export type Row = Record<string, unknown>;

export interface UserRow {
  id: string;
  username: string;
  createdAt: string;
  lastSeen: string | null;
  vaultSalt: string;
  vaultBlob: string;
  authSalt: string;
  authVerifier: string;
  ikPub: string;
  spkPub: string;
  spkSig: string;
  opkPubs: string[];
  opkUsed: number;
  profileEnc: string | null;
  fails: number;
  lockedUntil: string | null;
  role: string;
  blocked: number;
  note: string | null;
}

export interface InviteRow {
  id: string;
  codeHash: string;
  label: string | null;
  createdBy: string | null;
  role: string;
  maxUses: number;
  uses: number;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  claimedBy: string | null;
}

export interface NoticeRow {
  id: string;
  body: string;
  level: string;
  createdBy: string | null;
  createdAt: string;
  active: number;
}

export interface AuthSessionRow {
  id: string;
  userId: string;
  tokenHash: string;
  device: string | null;
  ipHash: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface MessageRow {
  seq: number;
  id: string;
  roomId: string;
  senderId: string;
  kind: string;
  header: string;
  body: string | null;
  size: number;
  createdAt: string;
  expiresAt: string | null;
  destroyedAt: string | null;
}

export interface RoomRow {
  id: string;
  type: string;
  createdAt: string;
  nameEnc: string | null;
  createdBy: string | null;
  defaultTtl: number | null;
  members: string[];
}

export interface RoomCodeRow {
  id: string;
  codeHash: string;
  roomId: string;
  createdBy: string;
  maxUsers: number;
  uses: number;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface Store {
  readonly adapter: string;
  init(): Promise<void>;
  upsertUser(u: UserRow): Promise<void>;
  userByName(username: string): Promise<UserRow | null>;
  userById(id: string): Promise<UserRow | null>;
  searchUsers(q: string, limit: number): Promise<{ id: string; username: string; ikPub: string }[]>;
  setVault(id: string, vaultSalt: string, vaultBlob: string): Promise<void>;
  bumpFails(id: string, at: string): Promise<{ fails: number; lockedUntil: string | null }>;
  clearFails(id: string): Promise<void>;
  consumeOpk(id: string): Promise<{ index: number; pub: string } | null>;

  addAuthSession(s: AuthSessionRow): Promise<void>;
  authByTokenHash(tokenHash: string): Promise<{ session: AuthSessionRow; user: UserRow } | null>;
  revokeAuthSessions(id: string, except?: string | null): Promise<number>;
  listAuthSessions(id: string): Promise<AuthSessionRow[]>;

  ensureRoom(r: { id: string; type: string; createdBy: string | null; nameEnc?: string | null; defaultTtl?: number | null }): Promise<void>;
  updateRoomTtl(roomId: string, ttlMs: number | null): Promise<void>;
  joinRoom(roomId: string, userId: string, wrappedKey: string | null): Promise<void>;
  roomsOf(userId: string): Promise<RoomRow[]>;
  isMember(roomId: string, userId: string): Promise<boolean>;
  roomMembers(roomId: string): Promise<string[]>;
  setCursor(userId: string, roomId: string, seq: number): Promise<void>;

  insertMessage(m: Omit<MessageRow, "seq">): Promise<number>;
  stream(userId: string, cursor: number, limit: number): Promise<MessageRow[]>;
  getMessage(id: string): Promise<MessageRow | null>;
  destroyMessage(id: string): Promise<void>;
  shredExpired(): Promise<number>;
  countBySender(userId: string): Promise<number>;

  putAttachment(a: { id: string; roomId: string; uploaderId: string; data: string; size: number; sha: string; createdAt: string; expiresAt: string | null }): Promise<void>;
  getAttachment(id: string): Promise<{ data: string; roomId: string; expiresAt: string | null } | null>;
  destroyAttachment(id: string): Promise<void>;

  /* ---- invites / admin / user-rights ---- */
  createInvite(i: InviteRow): Promise<void>;
  listInvites(limit: number): Promise<InviteRow[]>;
  findInviteByCodeHash(codeHash: string): Promise<InviteRow | null>;
  consumeInvite(codeHash: string, userId: string): Promise<InviteRow | null>;
  revokeInvite(id: string): Promise<void>;

  /* ---- room codes (ephemeral) ---- */
  createRoomCode(r: RoomCodeRow): Promise<void>;
  findRoomCodeByHash(codeHash: string): Promise<RoomCodeRow | null>;
  consumeRoomCode(codeHash: string, userId: string): Promise<{ ok: boolean; reason?: string; roomId?: string }>;
  listRoomCodes(roomId: string): Promise<RoomCodeRow[]>;
  revokeRoomCode(id: string): Promise<void>;
  deleteRoom(roomId: string): Promise<void>;
  listActiveRooms(limit: number): Promise<{ id: string; type: string; createdAt: string; defaultTtl: number | null; membersCount: number; expiresAt: string | null; uses: number; maxUsers: number }[]>;

  listUsers(limit: number): Promise<(UserRow & { sessions: number })[]>;
  setUserRole(id: string, role: string): Promise<void>;
  setUserBlocked(id: string, blocked: number, note: string | null): Promise<void>;
  purgeUser(id: string): Promise<void>;
  counts(): Promise<{ users: number; blocked: number; rooms: number; ciphertextRows: number; invites: number; activeSessions: number }>;
  recentAudit(limit: number): Promise<{ userId: string | null; event: string; detail: string | null; createdAt: string }[]>;

  putNotice(n: NoticeRow): Promise<void>;
  activeNotice(): Promise<NoticeRow | null>;
  clearNotice(): Promise<void>;

  audit(userId: string | null, event: string, detail: string | null, at: string): Promise<void>;
  listAudit(userId: string, limit: number): Promise<{ event: string; detail: string | null; createdAt: string }[]>;

  rate(key: string, limit: number, windowMs: number, now: number): Promise<{ ok: boolean; remaining: number; retryAfterMs: number }>;
  stats(): Promise<Record<string, unknown>>;
}

/* ------------------------------------------------------------------ sql backend */

const DDL_PG = `
CREATE TABLE IF NOT EXISTS ked_users (
  id text PRIMARY KEY, username text UNIQUE NOT NULL, created_at text NOT NULL, last_seen text,
  vault_salt text NOT NULL, vault_blob text NOT NULL, auth_salt text NOT NULL, auth_verifier text NOT NULL,
  ik_pub text NOT NULL, spk_pub text NOT NULL, spk_sig text NOT NULL, opk_pubs text NOT NULL,
  opk_used integer NOT NULL DEFAULT 0, profile_enc text, fails integer NOT NULL DEFAULT 0, locked_until text);
CREATE UNIQUE INDEX IF NOT EXISTS ked_users_username_key ON ked_users (username);
CREATE TABLE IF NOT EXISTS ked_auth_sessions (
  id text PRIMARY KEY, user_id text NOT NULL, token_hash text NOT NULL, device text, ip_hash text,
  created_at text NOT NULL, expires_at text NOT NULL, revoked_at text);
CREATE INDEX IF NOT EXISTS ked_auth_token_idx ON ked_auth_sessions (token_hash);
CREATE TABLE IF NOT EXISTS ked_rooms (
  id text PRIMARY KEY, type text NOT NULL, created_at text NOT NULL, name_enc text, created_by text, default_ttl integer);
CREATE TABLE IF NOT EXISTS ked_room_members (
  room_id text NOT NULL, user_id text NOT NULL, joined_at text NOT NULL, wrapped_key text, last_seq integer NOT NULL DEFAULT 0,
  PRIMARY KEY (room_id, user_id));
CREATE INDEX IF NOT EXISTS ked_room_member_user ON ked_room_members (user_id);
CREATE TABLE IF NOT EXISTS ked_messages (
  seq bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, id text NOT NULL, room_id text NOT NULL, sender_id text NOT NULL, kind text NOT NULL,
  header text NOT NULL, body text, size integer NOT NULL DEFAULT 0, created_at text NOT NULL,
  expires_at text, destroyed_at text);
CREATE INDEX IF NOT EXISTS ked_msg_room_seq ON ked_messages (room_id, seq);
CREATE TABLE IF NOT EXISTS ked_attachments (
  id text PRIMARY KEY, room_id text NOT NULL, uploader_id text NOT NULL, data text NOT NULL,
  size integer NOT NULL, sha text NOT NULL, created_at text NOT NULL, expires_at text, destroyed_at text);
CREATE TABLE IF NOT EXISTS ked_audit (
  id text PRIMARY KEY, user_id text, event text NOT NULL, detail text, created_at text NOT NULL);
CREATE TABLE IF NOT EXISTS ked_rate (key text PRIMARY KEY, count integer NOT NULL DEFAULT 0, window_start bigint NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS ked_invites (
  id text PRIMARY KEY, code_hash text UNIQUE NOT NULL, label text, created_by text, role text NOT NULL DEFAULT 'member',
  max_uses integer NOT NULL DEFAULT 1, uses integer NOT NULL DEFAULT 0, created_at text NOT NULL,
  expires_at text, revoked_at text, claimed_by text);
CREATE TABLE IF NOT EXISTS ked_notices (
  id text PRIMARY KEY, body text NOT NULL, level text NOT NULL DEFAULT 'info', created_by text,
  created_at text NOT NULL, active integer NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS ked_devices (
  id text PRIMARY KEY, user_id text NOT NULL, label text, created_at text NOT NULL, last_seen text, revoked_at text);
CREATE INDEX IF NOT EXISTS ked_devices_user_idx ON ked_devices (user_id);
CREATE TABLE IF NOT EXISTS ked_room_codes (
  id text PRIMARY KEY, code_hash text UNIQUE NOT NULL, room_id text NOT NULL, created_by text NOT NULL,
  max_users integer NOT NULL DEFAULT 5, uses integer NOT NULL DEFAULT 1, created_at text NOT NULL,
  expires_at text, revoked_at text);
CREATE INDEX IF NOT EXISTS ked_room_codes_hash_idx ON ked_room_codes (code_hash);
CREATE INDEX IF NOT EXISTS ked_room_codes_room_idx ON ked_room_codes (room_id);
ALTER TABLE ked_users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member';
ALTER TABLE ked_users ADD COLUMN IF NOT EXISTS blocked integer NOT NULL DEFAULT 0;
ALTER TABLE ked_users ADD COLUMN IF NOT EXISTS note text;
`;

const DDL_LITE = `
CREATE TABLE IF NOT EXISTS ked_users (
  id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL, last_seen TEXT,
  vault_salt TEXT NOT NULL, vault_blob TEXT NOT NULL, auth_salt TEXT NOT NULL, auth_verifier TEXT NOT NULL,
  ik_pub TEXT NOT NULL, spk_pub TEXT NOT NULL, spk_sig TEXT NOT NULL, opk_pubs TEXT NOT NULL,
  opk_used INTEGER NOT NULL DEFAULT 0, profile_enc TEXT, fails INTEGER NOT NULL DEFAULT 0, locked_until TEXT);
CREATE TABLE IF NOT EXISTS ked_auth_sessions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL, device TEXT, ip_hash TEXT,
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT);
CREATE INDEX IF NOT EXISTS ked_auth_token_idx ON ked_auth_sessions (token_hash);
CREATE TABLE IF NOT EXISTS ked_rooms (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, created_at TEXT NOT NULL, name_enc TEXT, created_by TEXT, default_ttl INTEGER);
CREATE TABLE IF NOT EXISTS ked_room_members (
  room_id TEXT NOT NULL, user_id TEXT NOT NULL, joined_at TEXT NOT NULL, wrapped_key TEXT, last_seq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (room_id, user_id));
CREATE INDEX IF NOT EXISTS ked_room_member_user ON ked_room_members (user_id);
CREATE TABLE IF NOT EXISTS ked_messages (
  seq INTEGER PRIMARY KEY, id TEXT NOT NULL, room_id TEXT NOT NULL, sender_id TEXT NOT NULL, kind TEXT NOT NULL,
  header TEXT NOT NULL, body TEXT, size INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
  expires_at TEXT, destroyed_at TEXT);
CREATE INDEX IF NOT EXISTS ked_msg_room_seq ON ked_messages (room_id, seq);
CREATE TABLE IF NOT EXISTS ked_attachments (
  id TEXT PRIMARY KEY, room_id TEXT NOT NULL, uploader_id TEXT NOT NULL, data TEXT NOT NULL,
  size INTEGER NOT NULL, sha TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT, destroyed_at TEXT);
CREATE TABLE IF NOT EXISTS ked_audit (
  id TEXT PRIMARY KEY, user_id TEXT, event TEXT, detail TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ked_rate (key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, window_start INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS ked_invites (
  id TEXT PRIMARY KEY, code_hash TEXT UNIQUE NOT NULL, label TEXT, created_by TEXT, role TEXT NOT NULL DEFAULT 'member',
  max_uses INTEGER NOT NULL DEFAULT 1, uses INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
  expires_at TEXT, revoked_at TEXT, claimed_by TEXT);
CREATE TABLE IF NOT EXISTS ked_notices (
  id TEXT PRIMARY KEY, body TEXT NOT NULL, level TEXT NOT NULL DEFAULT 'info', created_by TEXT,
  created_at TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS ked_devices (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, label TEXT, created_at TEXT NOT NULL, last_seen TEXT, revoked_at TEXT);
CREATE INDEX IF NOT EXISTS ked_devices_user_idx ON ked_devices (user_id);
CREATE TABLE IF NOT EXISTS ked_room_codes (
  id TEXT PRIMARY KEY, code_hash TEXT UNIQUE NOT NULL, room_id TEXT NOT NULL, created_by TEXT NOT NULL,
  max_users INTEGER NOT NULL DEFAULT 5, uses INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
  expires_at TEXT, revoked_at TEXT);
CREATE INDEX IF NOT EXISTS ked_room_codes_hash_idx ON ked_room_codes (code_hash);
CREATE INDEX IF NOT EXISTS ked_room_codes_room_idx ON ked_room_codes (room_id);
`;

/** Executor contract so one query set can serve pg, libSQL/HTTP and node:sqlite. */
export interface Executor {
  name: string;
  lite: boolean;
  exec(sql: string, params: unknown[]): Promise<Row[]>;
}



const NUM = (lite: boolean, v: unknown): unknown => {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return lite ? (v ? 1 : 0) : v;
  if (Array.isArray(v)) return JSON.stringify(v);
  return v;
};



export class SqlStore implements Store {
  readonly adapter: string;
  private ready: Promise<void> | null = null;
  private seq = 0;

  constructor(
    private ex: Executor,
    adapterName: string,
  ) {
    this.adapter = adapterName;
  }

  /**
   * One query text, two placeholder dialects. For the lite backends every `$n`
   * becomes `?` *and* the parameter list is reordered to match, so a query may
   * reference $2 before $1 without corrupting the binding.
   */
  private async run(sql: string, params: unknown[] = []): Promise<Row[]> {
    const mapped = params.map((p) => NUM(this.ex.lite, p));
    const text = sql.replace(/\s+/g, " ").trim();
    if (!this.ex.lite) return this.ex.exec(text, mapped);
    const order: number[] = [];
    const out = text.replace(/\$(\d+)/g, (_m, d) => {
      order.push(Number(d) - 1);
      return "?";
    });
    return this.ex.exec(out, order.map((i) => mapped[i] ?? null));
  }

  async init(): Promise<void> {
    this.ready ??= (async () => {
      const ddl = this.ex.lite ? DDL_LITE : DDL_PG;
      for (const stmt of ddl.split(";").map((s) => s.trim()).filter(Boolean)) await this.run(stmt);
      if (!this.ex.lite) {
        // CREATE TABLE IF NOT EXISTS cannot add columns to a pre-existing table; do it defensively
        for (const col of [`role text NOT NULL DEFAULT 'member'`, `blocked integer NOT NULL DEFAULT 0`, `note text`])
          await this.run(`ALTER TABLE ked_users ADD COLUMN IF NOT EXISTS ${col}`).catch(() => undefined);
      } else {
        const cols = await this.run(`PRAGMA table_info(ked_users)`);
        const have = new Set(cols.map((c) => String(c.name)));
        if (!have.has("role")) await this.run(`ALTER TABLE ked_users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'`).catch(() => undefined);
        if (!have.has("blocked")) await this.run(`ALTER TABLE ked_users ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0`).catch(() => undefined);
        if (!have.has("note")) await this.run(`ALTER TABLE ked_users ADD COLUMN note TEXT`).catch(() => undefined);
      }
    })();
    return this.ready;
  }

  private nextSeq(): number {
    this.seq = Math.max(Date.now(), this.seq + 1);
    return this.seq;
  }

  async upsertUser(u: UserRow): Promise<void> {
    if (this.ex.lite) {
      const rows = await this.run(`SELECT id FROM ked_users WHERE id = $1`, [u.id]);
      if (rows.length) {
        await this.run(
          `UPDATE ked_users SET last_seen=$2, vault_salt=$3, vault_blob=$4, ik_pub=$5, spk_pub=$6, spk_sig=$7, opk_pubs=$8, opk_used=$9, profile_enc=$10 WHERE id=$1`,
          [u.id, u.lastSeen, u.vaultSalt, u.vaultBlob, u.ikPub, u.spkPub, u.spkSig, u.opkPubs, u.opkUsed, u.profileEnc],
        );
        return;
      }
      await this.run(
        `INSERT INTO ked_users (id, username, created_at, last_seen, vault_salt, vault_blob, auth_salt, auth_verifier, ik_pub, spk_pub, spk_sig, opk_pubs, opk_used, profile_enc, fails, locked_until)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [u.id, u.username, u.createdAt, u.lastSeen, u.vaultSalt, u.vaultBlob, u.authSalt, u.authVerifier, u.ikPub, u.spkPub, u.spkSig, u.opkPubs, u.opkUsed, u.profileEnc, u.fails, u.lockedUntil, u.role ?? "member", u.blocked ?? 0, u.note ?? null],
      );
      return;
    }
    await this.run(
      `INSERT INTO ked_users (id, username, created_at, last_seen, vault_salt, vault_blob, auth_salt, auth_verifier, ik_pub, spk_pub, spk_sig, opk_pubs, opk_used, profile_enc, fails, locked_until, role, blocked, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (id) DO UPDATE SET last_seen=EXCLUDED.last_seen, vault_blob=EXCLUDED.vault_blob, vault_salt=EXCLUDED.vault_salt,
         ik_pub=EXCLUDED.ik_pub, spk_pub=EXCLUDED.spk_pub, spk_sig=EXCLUDED.spk_sig, opk_pubs=EXCLUDED.opk_pubs,
         profile_enc=EXCLUDED.profile_enc, role=EXCLUDED.role, blocked=EXCLUDED.blocked, note=EXCLUDED.note`,
      [u.id, u.username, u.createdAt, u.lastSeen, u.vaultSalt, u.vaultBlob, u.authSalt, u.authVerifier, u.ikPub, u.spkPub, u.spkSig, u.opkPubs, u.opkUsed, u.profileEnc, u.fails, u.lockedUntil, u.role ?? "member", u.blocked ?? 0, u.note ?? null],
    );
  }

  private mapUser(r: Row): UserRow {
    return {
      id: String(r.id),
      username: String(r.username),
      createdAt: String(r.created_at),
      lastSeen: (r.last_seen as string) ?? null,
      vaultSalt: String(r.vault_salt),
      vaultBlob: String(r.vault_blob),
      authSalt: String(r.auth_salt),
      authVerifier: String(r.auth_verifier),
      ikPub: String(r.ik_pub),
      spkPub: String(r.spk_pub),
      spkSig: String(r.spk_sig),
      opkPubs: typeof r.opk_pubs === "string" ? (JSON.parse(r.opk_pubs) as string[]) : (r.opk_pubs as string[]),
      opkUsed: Number(r.opk_used ?? 0),
      profileEnc: (r.profile_enc as string) ?? null,
      fails: Number(r.fails ?? 0),
      lockedUntil: (r.locked_until as string) ?? null,
      role: r.role === undefined || r.role === null ? "member" : String(r.role),
      blocked: Number(r.blocked ?? 0),
      note: (r.note as string) ?? null,
    };
  }

  private USER_COLS = `id, username, created_at, last_seen, vault_salt, vault_blob, auth_salt, auth_verifier, ik_pub, spk_pub, spk_sig, opk_pubs, opk_used, profile_enc, fails, locked_until, role, blocked, note`;

  async userByName(username: string): Promise<UserRow | null> {
    const rows = await this.run(
      `SELECT ${this.USER_COLS} FROM ked_users WHERE lower(username) = lower($1) LIMIT 1`,
      [username],
    );
    return rows.length ? this.mapUser(rows[0]) : null;
  }

  async userById(id: string): Promise<UserRow | null> {
    const rows = await this.run(`SELECT ${this.USER_COLS} FROM ked_users WHERE id = $1 LIMIT 1`, [id]);
    return rows.length ? this.mapUser(rows[0]) : null;
  }

  async searchUsers(query: string, limit: number): Promise<{ id: string; username: string; ikPub: string }[]> {
    const rows = await this.run(
      `SELECT id, username, ik_pub FROM ked_users WHERE username ILIKE $1 ORDER BY username LIMIT ${Math.max(1, Math.min(25, limit))}`,
      [`%${query}%`],
    ).catch(async () =>
      this.run(
        `SELECT id, username, ik_pub FROM ked_users WHERE username LIKE $1 ORDER BY username LIMIT ${Math.max(1, Math.min(25, limit))}`,
        [`%${query}%`],
      ),
    );
    return rows.map((r) => ({ id: String(r.id), username: String(r.username), ikPub: String(r.ik_pub) }));
  }

  async setVault(id: string, vaultSalt: string, vaultBlob: string): Promise<void> {
    await this.run(`UPDATE ked_users SET vault_salt=$2, vault_blob=$3 WHERE id=$1`, [id, vaultSalt, vaultBlob]);
  }

  async bumpFails(id: string, at: string): Promise<{ fails: number; lockedUntil: string | null }> {
    const rows = await this.run(`SELECT fails FROM ked_users WHERE id=$1`, [id]);
    const fails = Number(rows[0]?.fails ?? 0) + 1;
    const locked = fails >= 6 ? new Date(Date.now() + 15 * 60_000).toISOString() : null;
    await this.run(`UPDATE ked_users SET fails=$2, locked_until=$3 WHERE id=$1`, [id, fails, locked]);
    return { fails, lockedUntil: locked };
  }

  async clearFails(id: string): Promise<void> {
    await this.run(`UPDATE ked_users SET fails=0, locked_until=NULL WHERE id=$1`, [id]);
  }

  async consumeOpk(id: string): Promise<{ index: number; pub: string } | null> {
    const rows = await this.run(`SELECT opk_pubs, opk_used FROM ked_users WHERE id=$1`, [id]);
    if (!rows.length) return null;
    const pubs = typeof rows[0].opk_pubs === "string" ? (JSON.parse(rows[0].opk_pubs as string) as string[]) : (rows[0].opk_pubs as string[]);
    const used = Number(rows[0].opk_used ?? 0);
    if (used >= pubs.length) return null;
    await this.run(`UPDATE ked_users SET opk_used=$2 WHERE id=$1`, [id, used + 1]);
    return { index: used, pub: pubs[used] };
  }

  async addAuthSession(s: AuthSessionRow): Promise<void> {
    await this.run(
      `INSERT INTO ked_auth_sessions (id, user_id, token_hash, device, ip_hash, created_at, expires_at, revoked_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [s.id, s.userId, s.tokenHash, s.device, s.ipHash, s.createdAt, s.expiresAt, s.revokedAt],
    );
  }

  async authByTokenHash(tokenHash: string): Promise<{ session: AuthSessionRow; user: UserRow } | null> {
    const rows = await this.run(
      `SELECT s.id, s.user_id, s.token_hash, s.device, s.ip_hash, s.created_at, s.expires_at, s.revoked_at,
              ${this.USER_COLS.split(", ").map((c) => `u.${c}`).join(", ")}
       FROM ked_auth_sessions s JOIN ked_users u ON u.id = s.user_id WHERE s.token_hash = $1 LIMIT 1`,
      [tokenHash],
    );
    if (!rows.length) return null;
    const r = rows[0];
    const prefixed: Row = {};
    for (const k of Object.keys(r)) prefixed[k.startsWith("u.") ? k.slice(2) : k] = r[k];
    return {
      session: {
        id: String(r.id),
        userId: String(r.user_id),
        tokenHash: String(r.token_hash),
        device: (r.device as string) ?? null,
        ipHash: (r.ip_hash as string) ?? null,
        createdAt: String(r.created_at),
        expiresAt: String(r.expires_at),
        revokedAt: (r.revoked_at as string) ?? null,
      },
      user: this.mapUser(prefixed),
    };
  }

  async revokeAuthSessions(id: string, except: string | null = null): Promise<number> {
    const rows = except
      ? await this.run(`UPDATE ked_auth_sessions SET revoked_at=$3 WHERE user_id=$1 AND id<>$2 RETURNING id`, [id, except, new Date().toISOString()])
      : await this.run(`UPDATE ked_auth_sessions SET revoked_at=$2 WHERE user_id=$1 RETURNING id`, [id, new Date().toISOString()]);
    if (rows.length) return rows.length;
    const all = await this.run(`SELECT id FROM ked_auth_sessions WHERE user_id=$1 AND revoked_at IS NULL`, [id]);
    return all.length;
  }

  async listAuthSessions(id: string): Promise<AuthSessionRow[]> {
    const rows = await this.run(
      `SELECT id, user_id, token_hash, device, ip_hash, created_at, expires_at, revoked_at FROM ked_auth_sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20`,
      [id],
    );
    return rows.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      tokenHash: String(r.token_hash),
      device: (r.device as string) ?? null,
      ipHash: (r.ip_hash as string) ?? null,
      createdAt: String(r.created_at),
      expiresAt: String(r.expires_at),
      revokedAt: (r.revoked_at as string) ?? null,
    }));
  }

  async ensureRoom(r: { id: string; type: string; createdBy: string | null; nameEnc?: string | null; defaultTtl?: number | null }): Promise<void> {
    const existing = await this.run(`SELECT id FROM ked_rooms WHERE id=$1`, [r.id]);
    if (existing.length) return;
    await this.run(
      `INSERT INTO ked_rooms (id, type, created_at, name_enc, created_by, default_ttl) VALUES ($1,$2,$3,$4,$5,$6)`,
      [r.id, r.type, new Date().toISOString(), r.nameEnc ?? null, r.createdBy, r.defaultTtl ?? null],
    );
  }

  async updateRoomTtl(roomId: string, ttlMs: number | null): Promise<void> {
    await this.run(`UPDATE ked_rooms SET default_ttl=$2 WHERE id=$1`, [roomId, ttlMs]);
  }

  async joinRoom(roomId: string, userId: string, wrappedKey: string | null): Promise<void> {
    const rows = await this.run(`SELECT user_id FROM ked_room_members WHERE room_id=$1 AND user_id=$2`, [roomId, userId]);
    if (rows.length) {
      if (wrappedKey) await this.run(`UPDATE ked_room_members SET wrapped_key=$3 WHERE room_id=$1 AND user_id=$2`, [roomId, userId, wrappedKey]);
      return;
    }
    await this.run(`INSERT INTO ked_room_members (room_id, user_id, joined_at, wrapped_key, last_seq) VALUES ($1,$2,$3,$4,0)`, [
      roomId,
      userId,
      new Date().toISOString(),
      wrappedKey,
    ]);
  }

  async roomsOf(userId: string): Promise<RoomRow[]> {
    const rows = await this.run(
      `SELECT r.id, r.type, r.created_at, r.name_enc, r.created_by, r.default_ttl,
              COALESCE(string_agg(m.user_id, ','), '') AS member_list
       FROM ked_rooms r JOIN ked_room_members m ON m.room_id = r.id
       WHERE r.id IN (SELECT room_id FROM ked_room_members WHERE user_id=$1)
       GROUP BY r.id, r.type, r.created_at, r.name_enc, r.created_by, r.default_ttl`,
      [userId],
    );
    if (rows.length) {
      return rows.map((r) => ({
        id: String(r.id),
        type: String(r.type),
        createdAt: String(r.created_at),
        nameEnc: (r.name_enc as string) ?? null,
        createdBy: (r.created_by as string) ?? null,
        defaultTtl: r.default_ttl === null || r.default_ttl === undefined ? null : Number(r.default_ttl),
        members: String(r.member_list || "").split(",").filter(Boolean),
      }));
    }
    // libSQL/HTTP has no string_agg path here -> second query
    const mine = await this.run(`SELECT room_id FROM ked_room_members WHERE user_id=$1`, [userId]);
    const out: RoomRow[] = [];
    for (const m of mine) {
      const id = String(m.room_id);
      const roomRows = await this.run(`SELECT id, type, created_at, name_enc, created_by, default_ttl FROM ked_rooms WHERE id=$1`, [id]);
      if (!roomRows.length) continue;
      const memberRows = await this.run(`SELECT user_id FROM ked_room_members WHERE room_id=$1`, [id]);
      const rr = roomRows[0];
      out.push({
        id,
        type: String(rr.type),
        createdAt: String(rr.created_at),
        nameEnc: (rr.name_enc as string) ?? null,
        createdBy: (rr.created_by as string) ?? null,
        defaultTtl: rr.default_ttl == null ? null : Number(rr.default_ttl),
        members: memberRows.map((x) => String(x.user_id)),
      });
    }
    return out;
  }

  async isMember(roomId: string, userId: string): Promise<boolean> {
    const rows = await this.run(`SELECT user_id FROM ked_room_members WHERE room_id=$1 AND user_id=$2`, [roomId, userId]);
    return rows.length > 0;
  }

  async roomMembers(roomId: string): Promise<string[]> {
    const rows = await this.run(`SELECT user_id FROM ked_room_members WHERE room_id=$1`, [roomId]);
    return rows.map((r) => String(r.user_id));
  }

  async setCursor(userId: string, roomId: string, seq: number): Promise<void> {
    const rows = await this.run(`SELECT user_id FROM ked_room_members WHERE room_id=$1 AND user_id=$2`, [roomId, userId]);
    if (!rows.length) return;
    await this.run(`UPDATE ked_room_members SET last_seq=$3 WHERE room_id=$1 AND user_id=$2`, [roomId, userId, Math.trunc(seq)]);
  }

  async insertMessage(m: Omit<MessageRow, "seq">): Promise<number> {
    if (this.ex.lite) {
      // no AUTOINCREMENT column in the shared schema: clock-ordered monotonic seq
      const max = await this.run(`SELECT COALESCE(MAX(seq), 0) AS top FROM ked_messages`);
      const seq = Math.max(this.nextSeq(), Number(max[0]?.top ?? 0) + 1);
      await this.run(
        `INSERT INTO ked_messages (seq, id, room_id, sender_id, kind, header, body, size, created_at, expires_at, destroyed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [seq, m.id, m.roomId, m.senderId, m.kind, m.header, m.body, m.size, m.createdAt, m.expiresAt, m.destroyedAt],
      );
      return seq;
    }
    const row = await this.run(
      `INSERT INTO ked_messages (id, room_id, sender_id, kind, header, body, size, created_at, expires_at, destroyed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING seq`,
      [m.id, m.roomId, m.senderId, m.kind, m.header, m.body, m.size, m.createdAt, m.expiresAt, m.destroyedAt],
    );
    return Number(row[0]?.seq ?? 0);
  }

  private mapMsg(r: Row): MessageRow {
    return {
      seq: Number(r.seq),
      id: String(r.id),
      roomId: String(r.room_id),
      senderId: String(r.sender_id),
      kind: String(r.kind),
      header: String(r.header),
      body: (r.body as string) ?? null,
      size: Number(r.size ?? 0),
      createdAt: String(r.created_at),
      expiresAt: (r.expires_at as string) ?? null,
      destroyedAt: (r.destroyed_at as string) ?? null,
    };
  }

  async stream(userId: string, cursor: number, limit: number): Promise<MessageRow[]> {
    const rows = await this.run(
      `SELECT seq, id, room_id, sender_id, kind, header, body, size, created_at, expires_at, destroyed_at
       FROM ked_messages
       WHERE seq > $2 AND room_id IN (SELECT room_id FROM ked_room_members WHERE user_id = $1)
       ORDER BY seq ASC LIMIT ${Math.max(1, Math.min(400, limit))}`,
      [userId, Math.trunc(cursor)],
    );
    return rows.map((r) => this.mapMsg(r));
  }

  async getMessage(id: string): Promise<MessageRow | null> {
    const rows = await this.run(
      `SELECT seq, id, room_id, sender_id, kind, header, body, size, created_at, expires_at, destroyed_at FROM ked_messages WHERE id=$1`,
      [id],
    );
    return rows.length ? this.mapMsg(rows[0]) : null;
  }

  async destroyMessage(id: string): Promise<void> {
    await this.run(`DELETE FROM ked_messages WHERE id=$1`, [id]);
  }

  async shredExpired(): Promise<number> {
    const now = new Date().toISOString();
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Hard-delete expired and destroyed attachments immediately to reclaim heavy DB storage
    await this.run(`DELETE FROM ked_attachments WHERE (expires_at IS NOT NULL AND expires_at < $1) OR destroyed_at IS NOT NULL OR data=''`, [now]);

    // 2. Hard-delete expired messages and destroyed tombstones
    const due = await this.run(`SELECT id FROM ked_messages WHERE (expires_at IS NOT NULL AND expires_at < $1) OR (destroyed_at IS NOT NULL AND destroyed_at < $2)`, [now, tenMinAgo]);
    if (due.length) {
      await this.run(`DELETE FROM ked_messages WHERE (expires_at IS NOT NULL AND expires_at < $1) OR (destroyed_at IS NOT NULL AND destroyed_at < $2)`, [now, tenMinAgo]);
    }

    // 3. Hard-delete expired ephemeral room codes and corresponding rooms
    const expiredCodes = await this.run(`SELECT room_id FROM ked_room_codes WHERE (expires_at IS NOT NULL AND expires_at < $1) OR revoked_at IS NOT NULL`, [now]);
    for (const ec of expiredCodes) {
      if (ec.room_id) {
        const rid = String(ec.room_id);
        await this.run(`DELETE FROM ked_messages WHERE room_id=$1`, [rid]);
        await this.run(`DELETE FROM ked_attachments WHERE room_id=$1`, [rid]);
        await this.run(`DELETE FROM ked_room_members WHERE room_id=$1`, [rid]);
        await this.run(`DELETE FROM ked_rooms WHERE id=$1`, [rid]);
      }
    }
    await this.run(`DELETE FROM ked_room_codes WHERE (expires_at IS NOT NULL AND expires_at < $1) OR revoked_at IS NOT NULL`, [now]);

    // 4. Hard-delete expired auth sessions & revoked sessions
    await this.run(`DELETE FROM ked_auth_sessions WHERE (expires_at IS NOT NULL AND expires_at < $1) OR revoked_at IS NOT NULL`, [now]);

    // 5. Hard-delete stale rate limit buckets older than 1 hour
    await this.run(`DELETE FROM ked_rate WHERE window_start < $1`, [Date.now() - 3600_000]);

    // 6. Hard-delete old audit log entries older than 7 days
    await this.run(`DELETE FROM ked_audit WHERE created_at < $1`, [sevenDaysAgo]);

    return due.length;
  }

  async countBySender(userId: string): Promise<number> {
    const rows = await this.run(`SELECT COUNT(*) AS c FROM ked_messages WHERE sender_id=$1`, [userId]);
    return Number(rows[0]?.c ?? 0);
  }

  async putAttachment(a: { id: string; roomId: string; uploaderId: string; data: string; size: number; sha: string; createdAt: string; expiresAt: string | null }): Promise<void> {
    let storedData = a.data;
    if (isExternalStorageEnabled()) {
      const s3Key = `attachments/${a.id}.enc`;
      const ok = await uploadToExternalStorage(s3Key, a.data);
      if (ok) {
        storedData = `b2://${s3Key}`;
      }
    }
    await this.run(
      `INSERT INTO ked_attachments (id, room_id, uploader_id, data, size, sha, created_at, expires_at, destroyed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL)`,
      [a.id, a.roomId, a.uploaderId, storedData, a.size, a.sha, a.createdAt, a.expiresAt],
    );
  }

  async getAttachment(id: string): Promise<{ data: string; roomId: string; expiresAt: string | null } | null> {
    const rows = await this.run(`SELECT data, room_id, expires_at FROM ked_attachments WHERE id=$1`, [id]);
    if (!rows.length) return null;
    const rawData = String(rows[0].data);
    let payload = rawData;
    if (rawData.startsWith("b2://") || rawData.startsWith("s3://")) {
      const key = rawData.replace(/^(b2|s3):\/\//, "");
      const ext = await downloadFromExternalStorage(key);
      if (ext) {
        payload = ext;
      }
    }
    return { data: payload, roomId: String(rows[0].room_id), expiresAt: (rows[0].expires_at as string) ?? null };
  }

  async destroyAttachment(id: string): Promise<void> {
    try {
      const rows = await this.run(`SELECT data FROM ked_attachments WHERE id=$1`, [id]);
      if (rows.length && (String(rows[0].data).startsWith("b2://") || String(rows[0].data).startsWith("s3://"))) {
        const key = String(rows[0].data).replace(/^(b2|s3):\/\//, "");
        void deleteFromExternalStorage(key);
      }
    } catch {}
    await this.run(`DELETE FROM ked_attachments WHERE id=$1`, [id]);
  }


  /* ---------------------------------------------------------------- invites / admin */

  private mapInvite(r: Row): InviteRow {
    return {
      id: String(r.id),
      codeHash: String(r.code_hash),
      label: (r.label as string) ?? null,
      createdBy: (r.created_by as string) ?? null,
      role: String(r.role ?? "member"),
      maxUses: Number(r.max_uses ?? 1),
      uses: Number(r.uses ?? 0),
      createdAt: String(r.created_at),
      expiresAt: (r.expires_at as string) ?? null,
      revokedAt: (r.revoked_at as string) ?? null,
      claimedBy: (r.claimed_by as string) ?? null,
    };
  }

  async createInvite(i: InviteRow): Promise<void> {
    await this.run(
      `INSERT INTO ked_invites (id, code_hash, label, created_by, role, max_uses, uses, created_at, expires_at, revoked_at, claimed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [i.id, i.codeHash, i.label, i.createdBy, i.role, i.maxUses, i.uses, i.createdAt, i.expiresAt, i.revokedAt, i.claimedBy],
    );
  }

  async listInvites(limit: number): Promise<InviteRow[]> {
    const rows = await this.run(
      `SELECT id, code_hash, label, created_by, role, max_uses, uses, created_at, expires_at, revoked_at, claimed_by
       FROM ked_invites ORDER BY created_at DESC LIMIT ${Math.max(1, Math.min(200, limit))}`,
    );
    return rows.map((r) => this.mapInvite(r));
  }

  async findInviteByCodeHash(codeHash: string): Promise<InviteRow | null> {
    const rows = await this.run(`SELECT id, code_hash, label, created_by, role, max_uses, uses, created_at, expires_at, revoked_at, claimed_by FROM ked_invites WHERE code_hash=$1`, [codeHash]);
    return rows.length ? this.mapInvite(rows[0]) : null;
  }

  async consumeInvite(codeHash: string, userId: string): Promise<InviteRow | null> {
    const inv = await this.findInviteByCodeHash(codeHash);
    if (!inv || inv.revokedAt) return null;
    if (inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now()) return null;
    if (inv.uses >= inv.maxUses) return null;
    await this.run(`UPDATE ked_invites SET uses=$2, claimed_by=$3 WHERE id=$1`, [inv.id, inv.uses + 1, userId]);
    return { ...inv, uses: inv.uses + 1, claimedBy: userId };
  }

  async revokeInvite(id: string): Promise<void> {
    await this.run(`UPDATE ked_invites SET revoked_at=$2 WHERE id=$1`, [id, new Date().toISOString()]);
  }

  /* ---- room codes ---- */
  private mapRoomCode(r: Row): RoomCodeRow {
    return {
      id: String(r.id),
      codeHash: String(r.code_hash),
      roomId: String(r.room_id),
      createdBy: String(r.created_by),
      maxUsers: Number(r.max_users ?? 5),
      uses: Number(r.uses ?? 0),
      createdAt: String(r.created_at),
      expiresAt: (r.expires_at as string) ?? null,
      revokedAt: (r.revoked_at as string) ?? null,
    };
  }
  async createRoomCode(r: RoomCodeRow): Promise<void> {
    await this.run(
      `INSERT INTO ked_room_codes (id, code_hash, room_id, created_by, max_users, uses, created_at, expires_at, revoked_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [r.id, r.codeHash, r.roomId, r.createdBy, r.maxUsers, r.uses, r.createdAt, r.expiresAt, r.revokedAt],
    );
  }
  async findRoomCodeByHash(codeHash: string): Promise<RoomCodeRow | null> {
    const rows = await this.run(`SELECT id, code_hash, room_id, created_by, max_users, uses, created_at, expires_at, revoked_at FROM ked_room_codes WHERE code_hash=$1`, [codeHash]);
    return rows.length ? this.mapRoomCode(rows[0]) : null;
  }
  async consumeRoomCode(codeHash: string, userId: string): Promise<{ ok: boolean; reason?: string; roomId?: string }> {
    const rc = await this.findRoomCodeByHash(codeHash);
    if (!rc) return { ok: false, reason: "unknown code" };
    if (rc.revokedAt) return { ok: false, reason: "revoked" };
    if (rc.expiresAt && new Date(rc.expiresAt).getTime() < Date.now()) return { ok: false, reason: "expired" };
    if (rc.uses >= rc.maxUsers) return { ok: false, reason: "full" };
    if (await this.isMember(rc.roomId, userId)) return { ok: true, roomId: rc.roomId };
    const members = await this.roomMembers(rc.roomId);
    if (members.length >= rc.maxUsers) return { ok: false, reason: "full" };
    await this.run(`UPDATE ked_room_codes SET uses=$2 WHERE id=$1`, [rc.id, rc.uses + 1]);
    await this.joinRoom(rc.roomId, userId, null);
    return { ok: true, roomId: rc.roomId };
  }
  async listRoomCodes(roomId: string): Promise<RoomCodeRow[]> {
    const rows = await this.run(`SELECT id, code_hash, room_id, created_by, max_users, uses, created_at, expires_at, revoked_at FROM ked_room_codes WHERE room_id=$1 ORDER BY created_at DESC`, [roomId]);
    return rows.map((r) => this.mapRoomCode(r));
  }
  async revokeRoomCode(id: string): Promise<void> {
    await this.run(`UPDATE ked_room_codes SET revoked_at=$2 WHERE id=$1`, [id, new Date().toISOString()]);
  }
  async deleteRoom(roomId: string): Promise<void> {
    await this.run(`DELETE FROM ked_messages WHERE room_id=$1`, [roomId]);
    await this.run(`DELETE FROM ked_attachments WHERE room_id=$1`, [roomId]);
    await this.run(`DELETE FROM ked_room_members WHERE room_id=$1`, [roomId]);
    await this.run(`DELETE FROM ked_room_codes WHERE room_id=$1`, [roomId]);
    await this.run(`DELETE FROM ked_rooms WHERE id=$1`, [roomId]);
  }

  async listActiveRooms(limit: number): Promise<{ id: string; type: string; createdAt: string; defaultTtl: number | null; membersCount: number; expiresAt: string | null; uses: number; maxUsers: number }[]> {
    const now = new Date().toISOString();
    const rooms = await this.run(
      `SELECT r.id, r.type, r.created_at, r.default_ttl,
              (SELECT COUNT(*) FROM ked_room_members m WHERE m.room_id = r.id) as members_count,
              rc.expires_at, rc.uses, rc.max_users
       FROM ked_rooms r
       LEFT JOIN ked_room_codes rc ON rc.room_id = r.id
       WHERE rc.id IS NULL OR (rc.expires_at > '${now}' AND rc.revoked_at IS NULL)
       ORDER BY r.created_at DESC LIMIT ${Math.max(1, Math.min(100, limit))}`
    );
    return rooms.map((r) => ({
      id: String(r.id),
      type: String(r.type),
      createdAt: String(r.created_at),
      defaultTtl: r.default_ttl != null ? Number(r.default_ttl) : null,
      membersCount: Number(r.members_count ?? 0),
      expiresAt: (r.expires_at as string) ?? null,
      uses: Number(r.uses ?? 0),
      maxUsers: Number(r.max_users ?? 0),
    }));
  }

  async listUsers(limit: number): Promise<(UserRow & { sessions: number })[]> {
    const rows = await this.run(
      `SELECT ${this.USER_COLS},
              (SELECT COUNT(*) FROM ked_auth_sessions s WHERE s.user_id = ked_users.id AND s.revoked_at IS NULL) AS sessions
       FROM ked_users ORDER BY created_at DESC LIMIT ${Math.max(1, Math.min(500, limit))}`,
    );
    return rows.map((r) => ({ ...this.mapUser(r), sessions: Number(r.sessions ?? 0) }));
  }

  async setUserRole(id: string, role: string): Promise<void> {
    await this.run(`UPDATE ked_users SET role=$2 WHERE id=$1`, [id, role === "admin" ? "admin" : "member"]);
  }

  async setUserBlocked(id: string, blocked: number, note: string | null): Promise<void> {
    await this.run(`UPDATE ked_users SET blocked=$2, note=$3 WHERE id=$1`, [id, blocked ? 1 : 0, note]);
    if (blocked) await this.revokeAuthSessions(id, null);
  }

  async purgeUser(id: string): Promise<void> {
    const rooms = await this.run(`SELECT room_id FROM ked_room_members WHERE user_id=$1`, [id]);
    for (const r of rooms) {
      const rid = String(r.room_id);
      await this.deleteRoom(rid);
    }
    await this.run(`DELETE FROM ked_messages WHERE sender_id=$1`, [id]);
    await this.run(`DELETE FROM ked_attachments WHERE uploader_id=$1`, [id]);
    await this.run(`DELETE FROM ked_auth_sessions WHERE user_id=$1`, [id]);
    await this.run(`UPDATE ked_users SET vault_blob='', vault_salt='', ik_pub='', spk_pub='', spk_sig='[]', opk_pubs='[]', blocked=1, note='purged' WHERE id=$1`, [id]);
  }

  async counts(): Promise<{ users: number; blocked: number; rooms: number; ciphertextRows: number; invites: number; activeSessions: number }> {
    const one = async (sql: string) => Number((await this.run(sql))[0]?.c ?? 0);
    const now = new Date().toISOString();
    return {
      users: await one(`SELECT COUNT(*) AS c FROM ked_users`),
      blocked: await one(`SELECT COUNT(*) AS c FROM ked_users WHERE blocked=1`),
      rooms: await one(`SELECT COUNT(*) AS c FROM ked_rooms r LEFT JOIN ked_room_codes rc ON rc.room_id = r.id WHERE rc.id IS NULL OR (rc.expires_at > '${now}' AND rc.revoked_at IS NULL)`),
      ciphertextRows: await one(`SELECT COUNT(*) AS c FROM ked_messages WHERE (expires_at IS NULL OR expires_at > '${now}') AND destroyed_at IS NULL AND body IS NOT NULL AND body != ''`),
      invites: await one(`SELECT COUNT(*) AS c FROM ked_invites WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > '${now}')`),
      activeSessions: await one(`SELECT COUNT(*) AS c FROM ked_auth_sessions WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > '${now}')`),
    };
  }

  async recentAudit(limit: number): Promise<{ userId: string | null; event: string; detail: string | null; createdAt: string }[]> {
    const rows = await this.run(`SELECT user_id, event, detail, created_at FROM ked_audit ORDER BY created_at DESC LIMIT ${Math.max(1, Math.min(300, limit))}`);
    return rows.map((r) => ({ userId: (r.user_id as string) ?? null, event: String(r.event), detail: (r.detail as string) ?? null, createdAt: String(r.created_at) }));
  }

  async putNotice(n: NoticeRow): Promise<void> {
    await this.run(`UPDATE ked_notices SET active=0`);
    await this.run(`INSERT INTO ked_notices (id, body, level, created_by, created_at, active) VALUES ($1,$2,$3,$4,$5,1)`, [n.id, n.body, n.level, n.createdBy, n.createdAt]);
  }

  async activeNotice(): Promise<NoticeRow | null> {
    const rows = await this.run(`SELECT id, body, level, created_by, created_at, active FROM ked_notices WHERE active=1 ORDER BY created_at DESC LIMIT 1`);
    if (!rows.length) return null;
    const r = rows[0];
    return { id: String(r.id), body: String(r.body), level: String(r.level), createdBy: (r.created_by as string) ?? null, createdAt: String(r.created_at), active: Number(r.active) };
  }

  async clearNotice(): Promise<void> {
    await this.run(`UPDATE ked_notices SET active=0`);
  }

  async audit(userId: string | null, event: string, detail: string | null, at: string): Promise<void> {
    const id = `au_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    await this.run(`INSERT INTO ked_audit (id, user_id, event, detail, created_at) VALUES ($1,$2,$3,$4,$5)`, [id, userId, event, detail, at]).catch(() => undefined);
  }

  async listAudit(userId: string, limit: number): Promise<{ event: string; detail: string | null; createdAt: string }[]> {
    const rows = await this.run(`SELECT event, detail, created_at FROM ked_audit WHERE user_id=$1 ORDER BY created_at DESC LIMIT ${Math.max(1, Math.min(100, limit))}`, [userId]);
    return rows.map((r) => ({ event: String(r.event), detail: (r.detail as string) ?? null, createdAt: String(r.created_at) }));
  }

  async rate(key: string, limit: number, windowMs: number, now: number): Promise<{ ok: boolean; remaining: number; retryAfterMs: number }> {
    if (RATE_LIMITS_ENABLED === false) return { ok: true, remaining: limit, retryAfterMs: 0 };
    const window = Math.floor(now / windowMs) * windowMs;
    const rows = await this.run(`SELECT count, window_start FROM ked_rate WHERE key=$1`, [key]);
    const prev = rows.length ? { count: Number(rows[0].count), window: Number(rows[0].window_start) } : { count: 0, window };
    const count = prev.window === window ? prev.count + 1 : 1;
    if (rows.length) await this.run(`UPDATE ked_rate SET count=$2, window_start=$3 WHERE key=$1`, [key, count, window]);
    else await this.run(`INSERT INTO ked_rate (key, count, window_start) VALUES ($1,$2,$3)`, [key, count, window]);
    const ok = count <= limit;
    return { ok, remaining: Math.max(0, limit - count), retryAfterMs: ok ? 0 : window + windowMs - now };
  }

  async stats(): Promise<Record<string, unknown>> {
    const u = await this.run(`SELECT COUNT(*) AS c FROM ked_users`);
    const m = await this.run(`SELECT COUNT(*) AS c FROM ked_messages`);
    const a = await this.run(`SELECT COUNT(*) AS c FROM ked_attachments`);
    const b = await this.run(`SELECT COALESCE(SUM(LENGTH(COALESCE(body,''))),0) AS bytes FROM ked_messages`);
    return {
      users: Number(u[0]?.c ?? 0),
      ciphertextRows: Number(m[0]?.c ?? 0),
      attachments: Number(a[0]?.c ?? 0),
      storedCiphertextBytes: Number(b[0]?.bytes ?? 0),
      plaintextRowsOnServer: 0,
    };
  }
}

/* ------------------------------------------------------------------ memory backend */

class MemoryStore implements Store {
  readonly adapter = "memory (volatile, opt-in SHER_DB=memory)";
  private users = new Map<string, UserRow>();
  private byName = new Map<string, string>();
  private sessions = new Map<string, AuthSessionRow>();
  private rooms = new Map<string, RoomRow>();
  private membership = new Map<string, Set<string>>();
  private msgs: MessageRow[] = [];
  private atts = new Map<string, { data: string; roomId: string; expiresAt: string | null }>();
  private auditLog: { userId: string | null; event: string; detail: string | null; createdAt: string }[] = [];
  private buckets = new Map<string, { count: number; window: number }>();
  private seq = 0;

  async init() {}
  async upsertUser(u: UserRow) {
    this.users.set(u.id, { ...u });
    this.byName.set(u.username.toLowerCase(), u.id);
  }
  async userByName(username: string) {
    const id = this.byName.get(username.toLowerCase());
    return id ? this.users.get(id) ?? null : null;
  }
  async userById(id: string) {
    return this.users.get(id) ?? null;
  }
  async searchUsers(qstr: string, limit: number) {
    const needle = qstr.toLowerCase();
    return [...this.users.values()]
      .filter((u) => u.username.toLowerCase().includes(needle))
      .slice(0, limit)
      .map((u) => ({ id: u.id, username: u.username, ikPub: u.ikPub }));
  }
  async setVault(id: string, vaultSalt: string, vaultBlob: string) {
    const u = this.users.get(id);
    if (u) this.users.set(id, { ...u, vaultSalt, vaultBlob });
  }
  async bumpFails(id: string, at: string) {
    const u = this.users.get(id);
    const fails = (u?.fails ?? 0) + 1;
    const lockedUntil = fails >= 6 ? new Date(Date.now() + 15 * 60_000).toISOString() : null;
    if (u) this.users.set(id, { ...u, fails, lockedUntil });
    void at;
    return { fails, lockedUntil };
  }
  async clearFails(id: string) {
    const u = this.users.get(id);
    if (u) this.users.set(id, { ...u, fails: 0, lockedUntil: null });
  }
  async consumeOpk(id: string) {
    const u = this.users.get(id);
    if (!u) return null;
    const idx = u.opkUsed;
    if (idx >= u.opkPubs.length) return null;
    this.users.set(id, { ...u, opkUsed: idx + 1 });
    return { index: idx, pub: u.opkPubs[idx] };
  }
  async addAuthSession(s: AuthSessionRow) {
    this.sessions.set(s.id, s);
  }
  async authByTokenHash(tokenHash: string) {
    for (const s of this.sessions.values()) {
      if (s.tokenHash === tokenHash && !s.revokedAt) {
        const user = this.users.get(s.userId);
        if (user) return { session: s, user };
      }
    }
    return null;
  }
  async revokeAuthSessions(id: string, except: string | null = null) {
    let n = 0;
    for (const [k, s] of this.sessions) {
      if (s.userId === id && s.id !== except && !s.revokedAt) {
        this.sessions.set(k, { ...s, revokedAt: new Date().toISOString() });
        n++;
      }
    }
    return n;
  }
  async listAuthSessions(id: string) {
    return [...this.sessions.values()].filter((s) => s.userId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
  }
  async ensureRoom(r: { id: string; type: string; createdBy: string | null; nameEnc?: string | null; defaultTtl?: number | null }) {
    if (!this.rooms.has(r.id))
      this.rooms.set(r.id, {
        id: r.id,
        type: r.type,
        createdAt: new Date().toISOString(),
        nameEnc: r.nameEnc ?? null,
        createdBy: r.createdBy ?? null,
        defaultTtl: r.defaultTtl ?? null,
        members: [],
      });
  }
  async updateRoomTtl(roomId: string, ttlMs: number | null) {
    const r = this.rooms.get(roomId);
    if (r) this.rooms.set(roomId, { ...r, defaultTtl: ttlMs });
  }
  async joinRoom(roomId: string, userId: string, wrappedKey: string | null) {
    const set = this.membership.get(roomId) ?? new Set<string>();
    set.add(userId);
    this.membership.set(roomId, set);
    const room = this.rooms.get(roomId);
    if (room && !room.members.includes(userId)) this.rooms.set(roomId, { ...room, members: [...room.members, userId] });
    void wrappedKey;
  }
  async roomsOf(userId: string) {
    return [...this.rooms.values()].filter((r) => (this.membership.get(r.id)?.has(userId) ?? false));
  }
  async isMember(roomId: string, userId: string) {
    return this.membership.get(roomId)?.has(userId) ?? this.rooms.get(roomId)?.members.includes(userId) ?? false;
  }
  async roomMembers(roomId: string) {
    return [...(this.membership.get(roomId) ?? new Set<string>())];
  }
  async setCursor() {}
  async insertMessage(m: Omit<MessageRow, "seq">) {
    const seq = ++this.seq;
    this.msgs.push({ ...m, seq });
    if (this.msgs.length > 20000) this.msgs.splice(0, this.msgs.length - 20000);
    return seq;
  }
  async stream(userId: string, cursor: number, limit: number) {
    const rooms = new Set((await this.roomsOf(userId)).map((r) => r.id));
    return this.msgs.filter((m) => m.seq > cursor && rooms.has(m.roomId)).sort((a, b) => a.seq - b.seq).slice(0, limit);
  }
  async getMessage(id: string) {
    return this.msgs.find((m) => m.id === id) ?? null;
  }
  async destroyMessage(id: string) {
    const idx = this.msgs.findIndex((x) => x.id === id);
    if (idx >= 0) this.msgs.splice(idx, 1);
  }
  async shredExpired() {
    const now = new Date().toISOString();
    const before = this.msgs.length;
    this.msgs = this.msgs.filter((m) => (!m.expiresAt || m.expiresAt >= now) && !m.destroyedAt);
    for (const [id, a] of this.atts.entries()) {
      if (a.expiresAt && a.expiresAt < now) this.atts.delete(id);
    }
    for (const [codeId, rc] of this.roomCodesMem.entries()) {
      if ((rc.expiresAt && rc.expiresAt < now) || rc.revokedAt) {
        await this.deleteRoom(rc.roomId);
        this.roomCodesMem.delete(codeId);
      }
    }
    for (const [sessionId, s] of this.sessions.entries()) {
      if ((s.expiresAt && s.expiresAt < now) || s.revokedAt) {
        this.sessions.delete(sessionId);
      }
    }
    return before - this.msgs.length;
  }
  async countBySender(userId: string) {
    return this.msgs.filter((m) => m.senderId === userId).length;
  }
  async putAttachment(a: { id: string; roomId: string; data: string; expiresAt: string | null }) {
    this.atts.set(a.id, { data: a.data, roomId: a.roomId, expiresAt: a.expiresAt });
  }
  async getAttachment(id: string) {
    return this.atts.get(id) ?? null;
  }
  async destroyAttachment(id: string) {
    this.atts.delete(id);
  }

  /* ---------------------------------------------------------------- invites / admin (memory) */

  private invitesMem = new Map<string, InviteRow>();
  private noticesMem: NoticeRow[] = [];

  async createInvite(i: InviteRow) {
    this.invitesMem.set(i.id, { ...i });
  }
  async listInvites(limit: number) {
    return [...this.invitesMem.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
  async findInviteByCodeHash(codeHash: string) {
    return [...this.invitesMem.values()].find((i) => i.codeHash === codeHash) ?? null;
  }
  async consumeInvite(codeHash: string, userId: string) {
    const inv = await this.findInviteByCodeHash(codeHash);
    if (!inv || inv.revokedAt || inv.uses >= inv.maxUses) return null;
    if (inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now()) return null;
    const next = { ...inv, uses: inv.uses + 1, claimedBy: userId };
    this.invitesMem.set(inv.id, next);
    return next;
  }
  async revokeInvite(id: string) {
    const i = this.invitesMem.get(id);
    if (i) this.invitesMem.set(id, { ...i, revokedAt: new Date().toISOString() });
  }
  private roomCodesMem = new Map<string, RoomCodeRow>();
  async createRoomCode(r: RoomCodeRow) {
    this.roomCodesMem.set(r.id, { ...r });
  }
  async findRoomCodeByHash(codeHash: string) {
    return [...this.roomCodesMem.values()].find((x) => x.codeHash === codeHash) ?? null;
  }
  async consumeRoomCode(codeHash: string, userId: string) {
    const rc = await this.findRoomCodeByHash(codeHash);
    if (!rc) return { ok: false, reason: "unknown code" };
    if (rc.revokedAt) return { ok: false, reason: "revoked" };
    if (rc.expiresAt && new Date(rc.expiresAt).getTime() < Date.now()) return { ok: false, reason: "expired" };
    if (rc.uses >= rc.maxUsers) return { ok: false, reason: "full" };
    if (await this.isMember(rc.roomId, userId)) return { ok: true, roomId: rc.roomId };
    const members = await this.roomMembers(rc.roomId);
    if (members.length >= rc.maxUsers) return { ok: false, reason: "full" };
    const next = { ...rc, uses: rc.uses + 1 };
    this.roomCodesMem.set(rc.id, next);
    await this.joinRoom(rc.roomId, userId, null);
    return { ok: true, roomId: rc.roomId };
  }
  async listRoomCodes(roomId: string) {
    return [...this.roomCodesMem.values()].filter((x) => x.roomId === roomId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async revokeRoomCode(id: string) {
    const r = this.roomCodesMem.get(id);
    if (r) this.roomCodesMem.set(id, { ...r, revokedAt: new Date().toISOString() });
  }
  async deleteRoom(roomId: string) {
    this.msgs = this.msgs.filter((m) => m.roomId !== roomId);
    for (const [id, a] of this.atts.entries()) {
      if (a.roomId === roomId) this.atts.delete(id);
    }
    this.membership.delete(roomId);
    this.rooms.delete(roomId);
    for (const [k, v] of [...this.roomCodesMem.entries()]) {
      if (v.roomId === roomId) this.roomCodesMem.delete(k);
    }
  }

  async listActiveRooms(limit: number) {
    const now = new Date().toISOString();
    const out: { id: string; type: string; createdAt: string; defaultTtl: number | null; membersCount: number; expiresAt: string | null; uses: number; maxUsers: number }[] = [];
    const roomsList = Array.from(this.rooms.values())
      .filter((r) => {
        const rc = Array.from(this.roomCodesMem.values()).find((c) => c.roomId === r.id);
        if (!rc) return true;
        return !rc.revokedAt && (!rc.expiresAt || rc.expiresAt > now);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
    for (const r of roomsList) {
      const rc = Array.from(this.roomCodesMem.values()).find((c) => c.roomId === r.id && !c.revokedAt);
      const members = this.membership.get(r.id);
      out.push({
        id: r.id,
        type: r.type,
        createdAt: r.createdAt,
        defaultTtl: r.defaultTtl ?? null,
        membersCount: members ? members.size : 0,
        expiresAt: rc?.expiresAt ?? null,
        uses: rc?.uses ?? 0,
        maxUsers: rc?.maxUsers ?? 0,
      });
    }
    return out;
  }
  async listUsers(limit: number) {
    return [...this.users.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((u) => ({ ...u, sessions: [...this.sessions.values()].filter((s) => s.userId === u.id && !s.revokedAt).length }));
  }
  async setUserRole(id: string, role: string) {
    const u = this.users.get(id);
    if (u) this.users.set(id, { ...u, role: role === "admin" ? "admin" : "member" });
  }
  async setUserBlocked(id: string, blocked: number, note: string | null) {
    const u = this.users.get(id);
    if (u) this.users.set(id, { ...u, blocked: blocked ? 1 : 0, note });
    if (blocked) await this.revokeAuthSessions(id, null);
  }
  async purgeUser(id: string) {
    const u = this.users.get(id);
    if (!u) return;
    for (const [rid, room] of [...this.rooms.entries()])
      if (room.createdBy === id || (this.membership.get(rid)?.has(id) ?? false)) {
        await this.deleteRoom(rid);
      }
    this.msgs = this.msgs.filter((m) => m.senderId !== id);
    for (const [k, s] of [...this.sessions.entries()]) if (s.userId === id) this.sessions.delete(k);
    this.users.set(id, { ...u, vaultBlob: "", vaultSalt: "", blocked: 1, note: "purged", ikPub: "", spkPub: "", spkSig: "", opkPubs: [] });
  }
  async counts() {
    const now = new Date().toISOString();
    const activeRooms = [...this.rooms.values()].filter((r) => {
      const rc = [...this.roomCodesMem.values()].find((c) => c.roomId === r.id);
      if (!rc) return true;
      return !rc.revokedAt && (!rc.expiresAt || rc.expiresAt > now);
    });
    return {
      users: this.users.size,
      blocked: [...this.users.values()].filter((u) => u.blocked).length,
      rooms: activeRooms.length,
      ciphertextRows: this.msgs.filter((m) => (!m.expiresAt || m.expiresAt > now) && !m.destroyedAt && m.body).length,
      invites: [...this.invitesMem.values()].filter((i) => !i.revokedAt && (!i.expiresAt || i.expiresAt > now)).length,
      activeSessions: [...this.sessions.values()].filter((s) => !s.revokedAt && (!s.expiresAt || s.expiresAt > now)).length,
    };
  }
  async recentAudit(limit: number) {
    return this.auditLog.slice(-limit).reverse().map((a) => ({ userId: a.userId, event: a.event, detail: a.detail, createdAt: a.createdAt }));
  }
  async putNotice(n: NoticeRow) {
    this.noticesMem = this.noticesMem.map((x) => ({ ...x, active: 0 }));
    this.noticesMem.push({ ...n });
  }
  async activeNotice() {
    return [...this.noticesMem].reverse().find((n) => n.active) ?? null;
  }
  async clearNotice() {
    this.noticesMem = this.noticesMem.map((x) => ({ ...x, active: 0 }));
  }

  async audit(userId: string | null, event: string, detail: string | null, createdAt: string) {
    this.auditLog.push({ userId, event, detail, createdAt });
    if (this.auditLog.length > 5000) this.auditLog.splice(0, this.auditLog.length - 5000);
  }
  async listAudit(userId: string, limit: number) {
    return this.auditLog
      .filter((a) => a.userId === userId)
      .slice(-limit)
      .reverse()
      .map((a) => ({ event: a.event, detail: a.detail, createdAt: a.createdAt }));
  }
  async rate(key: string, limit: number, windowMs: number, now: number) {
    if (RATE_LIMITS_ENABLED === false) return { ok: true, remaining: limit, retryAfterMs: 0 };
    const window = Math.floor(now / windowMs) * windowMs;
    const prev = this.buckets.get(key);
    const count = prev && prev.window === window ? prev.count + 1 : 1;
    this.buckets.set(key, { count, window });
    const ok = count <= limit;
    return { ok, remaining: Math.max(0, limit - count), retryAfterMs: ok ? 0 : window + windowMs - now };
  }
  async stats() {
    return {
      users: this.users.size,
      ciphertextRows: this.msgs.length,
      attachments: this.atts.size,
      storedCiphertextBytes: this.msgs.reduce((n, m) => n + (m.body?.length ?? 0), 0),
      plaintextRowsOnServer: 0,
      note: "Volatile in-memory relay: nothing survives a cold start and nothing is ever written to disk.",
    };
  }
}

/* ------------------------------------------------------------------ factory */

let cached: Store | null = null;
let cachedKey = "";

async function buildStore(): Promise<Store> {
  const env = process.env;
  const want = (env.SHER_DB || env.KED_DB || "").toLowerCase();
  const pgUrl = env.DATABASE_URL || env.POSTGRES_URL || env.NEON_DATABASE_URL || env.POSTGRES_NON_POOLER_URL;
  const sqlitePath = env.SHER_SQLITE_PATH || env.SHER_SQLITE_PATH;

  const key = `${want}|${pgUrl ? "pg" : ""}|${env.TURSO_URL ? "turso" : ""}|${sqlitePath ? "lite" : ""}`;
  if (cached && cachedKey === key) return cached;
  cachedKey = key;

  if (want !== "memory" && sqlitePath && (want === "sqlite" || !pgUrl)) {
    try {
      const { DatabaseSync } = await import("node:sqlite");
      const handle = new DatabaseSync(sqlitePath);
      const store = new SqlStore(
        {
          name: "node:sqlite",
          lite: true,
          async exec(sql: string, params: unknown[]) {
            const stmt = handle.prepare(sql);
            const args = params.map((p) => (typeof p === "number" || typeof p === "string" || p === null || p === undefined ? (p as string | number | null) : String(p)));
            if (/^\s*(select|with)/i.test(sql)) return (stmt.all(...args) as Row[]) ?? [];
            stmt.run(...args);
            return [];
          },
        },
        "sqlite (node:sqlite, file)",
      );
      await store.init();
      cached = store;
      return store;
    } catch (e) {
      console.warn("SQLite init error, falling back:", (e as Error).message);
    }
  }

  if (want !== "memory" && (env.TURSO_URL || env.LIBSQL_URL) && (want === "turso" || !pgUrl)) {
    try {
      const base = (env.TURSO_URL || env.LIBSQL_URL)!.replace(/^libsql:\/\//, "https://").replace(/\/$/, "");
      const token = env.TURSO_TOKEN || env.LIBSQL_TOKEN || "";
      const store = new SqlStore(
        {
          name: "libSQL/HTTP",
          lite: true,
          async exec(sql: string, params: unknown[]) {
            const res = await fetch(`${base}/transaction?wait=1`, {
              method: "POST",
              headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
              body: JSON.stringify({
                statements: [
                  {
                    stmt: sql,
                    args: params.map((p) => ({
                      type: typeof p === "number" ? "integer" : "string",
                      value: p === null || p === undefined ? null : typeof p === "number" ? String(Math.trunc(p)) : String(p),
                    })),
                  },
                ],
              }),
            });
            if (!res.ok) throw new Error(`turso ${res.status}: ${(await res.text()).slice(0, 300)}`);
            const json = (await res.json()) as { results?: { rows?: unknown[][] }[] };
            const result = json.results?.[0];
            const cols = (result as { cols?: { name: string }[] } | undefined)?.cols ?? [];
            return (result?.rows ?? []).map((row) => {
              const o: Row = {};
              cols.forEach((c, i) => (o[c.name] = (row as unknown[])[i]));
              if (!cols.length) (row as unknown[]).forEach((v, i) => (o[String(i)] = v));
              return o;
            });
          },
        },
        "turso (libSQL over HTTP)",
      );
      await store.init();
      cached = store;
      return store;
    } catch (e) {
      console.warn("Turso init error, falling back:", (e as Error).message);
    }
  }

  if (want !== "memory" && pgUrl && /neon\.tech/.test(pgUrl)) {
    try {
      const u = new URL(pgUrl.replace(/mode=pool(&|$)/, ""));
      const host = u.host;
      const cleanPgUrl = pgUrl.replace(/mode=pool(&|$)/, "");
      const store = new SqlStore(
        {
          name: "neon/http",
          lite: false,
          async exec(sql: string, params: unknown[]) {
            const res = await fetch(`https://${host}/sql`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "Neon-Connection-String": cleanPgUrl,
              },
              body: JSON.stringify({ query: sql, params }),
            });
            if (!res.ok) {
              const text = await res.text();
              throw new Error(`neon http ${res.status}: ${text.slice(0, 300)}`);
            }
            const data = (await res.json()) as { rows?: Row[] };
            return data.rows ?? [];
          },
        },
        "postgres (Neon serverless over HTTP)",
      );
      await store.init();
      cached = store;
      return store;
    } catch (e) {
      console.warn("Neon HTTP init error, trying TCP fallback:", (e as Error).message);
    }
  }

  if (want !== "memory" && pgUrl) {
    try {
      const { Pool } = await import("pg");
      const needsSsl = /sslmode=require|neon\.tech|supabase\./.test(pgUrl) && !/127\.0\.0\.1|localhost/.test(pgUrl);
      const pool = new Pool({
        connectionString: pgUrl.replace(/mode=pool(&|$)/, ""),
        ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
        max: 5,
        connectionTimeoutMillis: 3000,
      });
      await pool.query("SELECT 1");
      const store = new SqlStore(
        {
          name: "postgres",
          lite: false,
          async exec(sql: string, params: unknown[]) {
            const res = await pool.query(sql, params as never[]);
            return (res.rows as Row[]) ?? [];
          },
        },
        "postgres (Neon / Supabase / RDS / local, via pg)",
      );
      await store.init();
      cached = store;
      return store;
    } catch (e) {
      console.warn("Postgres init error, falling back to in-memory relay:", (e as Error).message);
    }
  }

  const mem = new MemoryStore();
  await mem.init();
  cached = mem;
  return mem;
}

export async function getStore(): Promise<Store> {
  return buildStore();
}

/**
 * Per-route token buckets. Set SHER_RATE_LIMIT=off to disable (CI / load-testing only —
 * never in production, these buckets are the brute-force and spam defence).
 */
export const RATE_LIMITS_ENABLED = (process.env.SHER_RATE_LIMIT ?? process.env.KED_RATE_LIMIT ?? "on").toLowerCase() !== "off";

export const RATE_RULES: Record<string, { limit: number; windowMs: number }> = {
  register: { limit: 6, windowMs: 10 * 60_000 },
  login: { limit: 10, windowMs: 10 * 60_000 },
  send: { limit: 90, windowMs: 60_000 },
  sync: { limit: 240, windowMs: 60_000 },
  lookup: { limit: 40, windowMs: 60_000 },
  attach: { limit: 20, windowMs: 5 * 60_000 },
  shred: { limit: 120, windowMs: 60_000 },
};

export function clientIp(req: Request): string {
  const h = req.headers;
  const raw =
    h.get("x-forwarded-for") || h.get("x-forwarded-for") || h.get("cf-connecting-ip") || h.get("x-real-ip") || "local";
  return (raw || "local").split(",")[0].trim();
}
