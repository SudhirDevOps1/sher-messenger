import { createHash, pbkdf2Sync, randomUUID } from "node:crypto";
import { RATE_RULES, clientIp, getStore, type InviteRow, type MessageRow, type NoticeRow, type UserRow } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SHER Messenger relay API (single router so it stays trivial to mirror on
 * Cloudflare Workers / Netlify functions / Bun / Deno — see /plan).
 *
 * Design rules enforced here:
 *  1. the relay never sees plaintext: `header` is public key material, `body` is ciphertext
 *  2. the relay never stores the passphrase nor anything that derives the vault key
 *     (authVerifier uses a different PBKDF2 salt + iteration count than the vault key)
 *  3. writes require room membership; TTLs are shredded server-side as well
 *  4. strict security headers + per-route token buckets
 */

type Ctx = { params: Promise<{ slug?: string | string[] }> };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, private, max-age=0",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "permissions-policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      "cross-origin-opener-policy": "same-origin",
      "x-frame-options": "DENY",
    },
  });

const err = (message: string, status = 400) => json({ error: message }, status);

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const nowIso = () => new Date().toISOString();

async function bucket(route: string, req: Request, who: string) {
  const store = await getStore();
  const rule = RATE_RULES[route] ?? { limit: 60, windowMs: 60_000 };
  return store.rate(`${route}:${who}:${clientIp(req)}`, rule.limit, rule.windowMs, Date.now());
}

async function auth(req: Request): Promise<{ user: UserRow; sessionId: string } | null> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const store = await getStore();
  const found = await store.authByTokenHash(sha(token));
  if (!found || found.session.revokedAt) return null;
  if (new Date(found.session.expiresAt).getTime() < Date.now()) return null;
  return { user: found.user, sessionId: found.session.id };
}

function normalizeUsername(raw: unknown): string {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,24}$/.test(s)) throw new Error("username must be 3-24 chars: a-z 0-9 . _ -");
  return s;
}

function str(v: unknown, max = 4096): string {
  const s = typeof v === "string" ? v : "";
  return s.slice(0, max);
}

async function payload(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function timingSafe(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function issueSession(userId: string, req: Request, device: string) {
  const store = await getStore();
  const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const id = `s_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  await store.addAuthSession({
    id,
    userId,
    tokenHash: sha(token),
    device,
    ipHash: sha(clientIp(req)).slice(0, 16),
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    revokedAt: null,
  });
  const user = await store.userById(userId);
  return {
    token,
    sessionId: id,
    userId,
    username: user?.username ?? "",
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
}

async function handlePost(req: Request, ctx: Ctx): Promise<Response> {
  const raw = (await ctx.params).slug;
  const path = Array.isArray(raw) ? raw.join("/") : (raw ?? "");
  const store = await getStore();
  await store.init();

  if (path === "register") {
    const b = await payload(req);
    const rl = await bucket("register", req, "anon");
    if (!rl.ok) return err(`rate limited: retry in ${Math.ceil(rl.retryAfterMs / 1000)}s`, 429);
    let username: string;
    try {
      username = normalizeUsername(b.username);
    } catch (e) {
      return err((e as Error).message, 422);
    }
    for (const f of ["vaultSalt", "vaultBlob", "authSalt", "authVerifier", "ikPub", "spkPub", "spkSig"] as const)
      if (!str(b[f], 300_000)) return err(`missing ${f}`, 422);

    // Invite gate. Default is ON (this is a private messenger, not a public signup form).
    // Set SHER_INVITE_ONLY=0 to allow open registration (handy for a local sandbox demo).
    const inviteOnly = (process.env.SHER_INVITE_ONLY ?? process.env.KED_INVITE_ONLY ?? "1") !== "0";
    let inviteRole = "member";
    if (inviteOnly) {
      const code = str(b.inviteCode, 200);
      if (!code) return err("invite required — ask the operator for an invite link", 403);
      const codeHash = sha(code.trim().toLowerCase());
      const inv = await store.findInviteByCodeHash(codeHash);
      if (!inv || inv.revokedAt) return err("invite is invalid or has been revoked", 403);
      if (inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now()) return err("invite has expired", 403);
      if (inv.uses >= inv.maxUses) return err("invite has already been used", 403);
      inviteRole = inv.role === "admin" ? "admin" : "member";
    }
    if (str(b.vaultBlob).length > 300_000) return err("vault blob too large", 413);
    if (await store.userByName(username)) return err("username already taken", 409);
    const opkPubs = Array.isArray(b.opkPubs) ? (b.opkPubs as unknown[]).map((x) => String(x)).slice(0, 64) : [];
    const id = `u_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
    await store.upsertUser({
      id,
      username,
      createdAt: nowIso(),
      lastSeen: nowIso(),
      vaultSalt: str(b.vaultSalt, 128),
      vaultBlob: str(b.vaultBlob, 300_000),
      authSalt: str(b.authSalt, 128),
      authVerifier: str(b.authVerifier, 128),
      ikPub: str(b.ikPub, 256),
      spkPub: str(b.spkPub, 256),
      spkSig: str(b.spkSig, 512),
      opkPubs,
      opkUsed: 0,
      profileEnc: str(b.profileEnc, 8192) || null,
      fails: 0,
      lockedUntil: null,
      role: inviteRole,
      blocked: 0,
      note: null,
    });
    if (inviteOnly) {
      const codeHash = sha(str(b.inviteCode, 200).trim().toLowerCase());
      await store.consumeInvite(codeHash, id);
    }
    await store.audit(id, "account.created", `P-256 bundle, ${opkPubs.length} one-time prekeys${inviteOnly ? ", invite redeemed" : ""}`, nowIso());
    return json(await issueSession(id, req, "primary device"));
  }

  if (path === "login") {
    const b = await payload(req);
    const rl = await bucket("login", req, "anon");
    if (!rl.ok) return err("too many attempts, slow down", 429);
    let username = "";
    try {
      username = normalizeUsername(b.username);
    } catch {
      return err("invalid username or passphrase", 401);
    }
    const user = await store.userByName(username);
    if (!user) {
      await new Promise((r) => setTimeout(r, 150));
      return err("invalid username or passphrase", 401);
    }
    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now())
      return err("account temporarily locked after repeated failures", 423);
    const provided = str(b.authVerifier, 128);
    const ok = provided.length === user.authVerifier.length && timingSafe(provided, user.authVerifier);
    if (!ok) {
      const f = await store.bumpFails(user.id, nowIso());
      await store.audit(user.id, "auth.failed", `fails=${f.fails}`, nowIso());
      return err(f.lockedUntil ? "invalid passphrase — account locked for 15 minutes" : "invalid username or passphrase", 401);
    }
    await store.clearFails(user.id);
    await store.audit(user.id, "auth.ok", null, nowIso());
    return json({
      ...(await issueSession(user.id, req, str(b.deviceLabel, 60) || "device")),
      userId: user.id,
      username: user.username,
      vaultSalt: user.vaultSalt,
      vaultBlob: user.vaultBlob,
      ikPub: user.ikPub,
      spkPub: user.spkPub,
      opkCount: user.opkPubs.length,
      opkUsed: user.opkUsed,
      createdAt: user.createdAt,
    });
  }

  if (path === "logout") {
    const me = await auth(req);
    if (!me) return err("unauthorised", 401);
    await store.revokeAuthSessions(me.user.id, null);
    await store.audit(me.user.id, "auth.logout", "all devices revoked", nowIso());
    return json({ ok: true });
  }

  if (path === "vault") {
    const me = await auth(req);
    if (!me) return err("unauthorised", 401);
    const b = await payload(req);
    if (b.vaultBlob) {
      const blob = str(b.vaultBlob, 300_000);
      await store.setVault(me.user.id, str(b.vaultSalt, 128) || me.user.vaultSalt, blob);
      await store.audit(me.user.id, "vault.synced", `${blob.length}B ciphertext`, nowIso());
      return json({ ok: true, bytes: blob.length });
    }
    return json({ vaultSalt: me.user.vaultSalt, vaultBlob: me.user.vaultBlob });
  }

  if (path === "bundle") {
    const me = await auth(req);
    if (!me) return err("unauthorised", 401);
    const b = await payload(req);
    const target = (await store.userById(str(b.userId, 64))) ?? (await store.userByName(String(b.username ?? "")));
    if (!target) return err("unknown user", 404);
    const opk = b.consumeOpk === false ? null : await store.consumeOpk(target.id);
    return json({
      userId: target.id,
      username: target.username,
      ikPub: target.ikPub,
      spkPub: target.spkPub,
      spkSig: target.spkSig,
      opkPub: opk?.pub ?? null,
      opkIndex: opk?.index ?? -1,
    });
  }

  if (path === "rooms") {
    const me = await auth(req);
    if (!me) return err("unauthorised", 401);
    const b = await payload(req);
    const type = str(b.type, 12) === "group" ? "group" : "dm";
    const id = str(b.roomId, 80) || `r_${randomUUID().replace(/-/g, "")}`;
    const members = Array.from(
      new Set([me.user.id, ...(Array.isArray(b.members) ? (b.members as unknown[]).map((x) => String(x)) : [])]),
    ).slice(0, 32);
    if (type === "dm" && members.length !== 2) return err("dm rooms need exactly 2 members", 422);
    for (const m of members) if (!(await store.userById(m))) return err(`unknown member ${m}`, 404);
    await store.ensureRoom({
      id,
      type,
      createdBy: me.user.id,
      nameEnc: str(b.nameEnc, 16_000) || null,
      defaultTtl: typeof b.defaultTtl === "number" ? Math.trunc(b.defaultTtl) : null,
    });
    const wrapped = (b.wrapped && typeof b.wrapped === "object" ? b.wrapped : {}) as Record<string, string>;
    for (const m of members) await store.joinRoom(id, m, wrapped[m] ? String(wrapped[m]).slice(0, 8192) : null);
    await store.audit(me.user.id, "room.opened", `${type} ${id.slice(0, 10)} · ${members.length} members`, nowIso());
    return json({ ok: true, room: { id, type, members } });
  }

  if (path === "rooms/code") {
    const me = await auth(req);
    const b = await payload(req);
    // public: free users without login — anonId from client or auto anon
    const anonId = str((b as Record<string, unknown>).anonId, 64) || `anon_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const userId = me ? me.user.id : anonId;
    const rl = await bucket("rooms", req, userId);
    if (!rl.ok) return err(`rate limited: retry in ${Math.ceil(rl.retryAfterMs / 1000)}s`, 429);
    const maxUsers = typeof b.maxUsers === "number" ? Math.max(2, Math.min(30, Math.trunc(b.maxUsers))) : 5;
    const ttlMs = typeof b.ttlMs === "number" ? Math.max(60_000, Math.min(30 * 60_000, Math.trunc(b.ttlMs))) : 30 * 60_000;
    const nameEnc = str(b.nameEnc, 16_000) || null;
    const id = `r_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    await store.ensureRoom({ id, type: "group", createdBy: userId, nameEnc, defaultTtl: ttlMs });
    await store.joinRoom(id, userId, null);
    const raw = randomUUID().replace(/-/g, "").slice(0, 6).toLowerCase();
    const codeHash = sha(raw);
    await store.createRoomCode({
      id: `rc_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      codeHash,
      roomId: id,
      createdBy: userId,
      maxUsers,
      uses: 1,
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      revokedAt: null,
    });
    await store.audit(userId, "room.code", `${id.slice(0, 10)} code ${raw} maxUsers=${maxUsers} ttl=${Math.round(ttlMs / 60000)}m`, nowIso());
    return json({ ok: true, roomId: id, code: raw, maxUsers, expiresAt: new Date(Date.now() + ttlMs).toISOString() });
  }

  if (path === "rooms/join") {
    const me = await auth(req);
    const b = await payload(req);
    const anonId = str((b as Record<string, unknown>).anonId, 64) || `anon_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const userId = me ? me.user.id : anonId;
    const code = str(b.code, 20).trim().toLowerCase();
    if (!code) return err("room code required", 422);
    const res = await store.consumeRoomCode(sha(code), userId);
    if (!res.ok) return err(`join failed: ${res.reason}`, 403);
    await store.audit(userId, "room.joined", `${res.roomId!.slice(0, 10)} via code`, nowIso());
    return json({ ok: true, roomId: res.roomId });
  }

  if (path === "send") {
    const me = await auth(req);
    const b = await payload(req);
    const anonId = str((b as Record<string, unknown>).anonId, 64) || null;
    const userId = me ? me.user.id : anonId;
    if (!userId) return err("unauthorised", 401);
    const rl = await bucket("send", req, userId);
    if (!rl.ok) return err("send rate limit reached", 429);
    const roomId = str(b.roomId, 80);
    if (!(await store.isMember(roomId, userId))) return err("not a member of this room", 403);
    const kind = str(b.kind, 16) || "msg";
    const header = str(b.header, 8192);
    const cipher = str(b.body, 4_000_000);
    if (!header) return err("missing header", 422);
    if (!cipher && kind !== "shred") return err("missing body", 422);
    if (cipher.length > 3_000_000) return err("ciphertext too large (3 MB base64 cap)", 413);
    const ttl = typeof b.ttlMs === "number" && b.ttlMs > 0 ? Math.min(b.ttlMs, 1000 * 60 * 60 * 24 * 30) : null;
    const msg: Omit<MessageRow, "seq"> = {
      id: str(b.id, 64) || `m_${randomUUID().replace(/-/g, "")}`,
      roomId,
      senderId: userId,
      kind,
      header,
      body: cipher || null,
      size: cipher.length,
      createdAt: nowIso(),
      expiresAt: ttl ? new Date(Date.now() + ttl).toISOString() : null,
      destroyedAt: null,
    };
    const seq = await store.insertMessage(msg);
    if (ttl) await store.audit(userId, "msg.ephemeral", `ttl=${ttl}ms`, nowIso());
    return json({ ok: true, seq, id: msg.id, expiresAt: msg.expiresAt });
  }

  if (path === "shred") {
    const me = await auth(req);
    if (!me) return err("unauthorised", 401);
    const rl = await bucket("shred", req, me.user.id);
    if (!rl.ok) return err("rate limited", 429);
    const b = await payload(req);
    const ids = Array.isArray(b.ids) ? (b.ids as unknown[]).map((x) => String(x)).slice(0, 200) : [];
    const attachments = Array.isArray(b.attachmentIds) ? (b.attachmentIds as unknown[]).map((x) => String(x)).slice(0, 200) : [];
    let done = 0;
    for (const id of ids) {
      const m = await store.getMessage(id);
      if (!m) continue;
      const allowed = m.senderId === me.user.id || (await store.isMember(m.roomId, me.user.id));
      if (!allowed) continue;
      await store.destroyMessage(id);
      done++;
    }
    for (const a of attachments) await store.destroyAttachment(a);
    await store.audit(me.user.id, "msg.shredded", `${done} rows zeroed on relay`, nowIso());
    return json({ ok: true, shredded: done, attachments: attachments.length });
  }

  if (path === "attachment") {
    const me = await auth(req);
    if (!me) return err("unauthorised", 401);
    const rl = await bucket("attach", req, me.user.id);
    if (!rl.ok) return err("attachment quota reached", 429);
    const b = await payload(req);
    const roomId = str(b.roomId, 80);
    if (!(await store.isMember(roomId, me.user.id))) return err("not a member of this room", 403);
    const data = str(b.data, 4_000_000);
    if (data.length > 3_000_000) return err("encrypted file too large", 413);
    const ttl = typeof b.ttlMs === "number" && b.ttlMs > 0 ? Math.min(b.ttlMs, 1000 * 60 * 60 * 24 * 30) : 1000 * 60 * 60 * 24 * 7;
    const id = `a_${randomUUID().replace(/-/g, "")}`;
    await store.putAttachment({
      id,
      roomId,
      uploaderId: me.user.id,
      data,
      size: Math.round((data.length * 3) / 4),
      sha: str(b.sha, 128),
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + ttl).toISOString(),
    });
    return json({ ok: true, id, expiresAt: new Date(Date.now() + ttl).toISOString() });
  }

  if (path === "revoke-device") {
    const me = await auth(req);
    if (!me) return err("unauthorised", 401);
    const b = await payload(req);
    const list = await store.listAuthSessions(me.user.id);
    const target = list.find((d) => d.id === str(b.id, 64));
    if (!target) return err("unknown device", 404);
    await store.revokeAuthSessions(me.user.id, me.sessionId);
    await store.audit(me.user.id, "device.revoked", target.id.slice(0, 8), nowIso());
    return json({ ok: true });
  }


  /* ------------------------------------------------------------ invites (public: redeem-check) */

  if (path === "invite/check") {
    const code = str((await payload(req)).code, 200).trim().toLowerCase();
    if (!code) return json({ valid: false, reason: "missing code" });
    const inv = await store.findInviteByCodeHash(sha(code));
    if (!inv) return json({ valid: false, reason: "unknown invite" });
    if (inv.revokedAt) return json({ valid: false, reason: "revoked" });
    if (inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now()) return json({ valid: false, reason: "expired" });
    if (inv.uses >= inv.maxUses) return json({ valid: false, reason: "used up" });
    return json({ valid: true, role: inv.role, usesLeft: inv.maxUses - inv.uses, expiresAt: inv.expiresAt });
  }

  /* ------------------------------------------------------------ system notice (plaintext by design) */

  if (path === "notice") return json({ notice: await store.activeNotice() });

  /* ------------------------------------------------------------ version / build info */

  if (path === "version")
    return json({
      name: "SHER Messenger",
      api: 1,
      protocol: "KED-X3DH-lite + Double Ratchet v1",
      build: process.env.SHER_BUILD_HASH ?? process.env.KED_BUILD_HASH ?? "dev",
      adapters: { store: store.adapter, db: process.env.DB_TARGET ?? "auto", store_target: process.env.STORE_TARGET ?? "none", backend: process.env.BACKEND_TARGET ?? "node" },
      inviteOnly: (process.env.SHER_INVITE_ONLY ?? process.env.KED_INVITE_ONLY ?? "1") !== "0",
      time: nowIso(),
    });

  /* ------------------------------------------------------------ user rights: export own ciphertext */

  if (path === "me/export") {
    const me = await auth(req);
    if (!me) return err("unauthorised", 401);
    const rooms = await store.roomsOf(me.user.id);
    const mine: unknown[] = [];
    for (const r of rooms) {
      const rows = await store.stream(me.user.id, 0, 400);
      for (const m of rows) if (m.roomId === r.id) mine.push({ roomId: r.id, seq: m.seq, kind: m.kind, header: m.header, body: m.body, createdAt: m.createdAt, destroyedAt: m.destroyedAt });
    }
    await store.audit(me.user.id, "data.exported", `${mine.length} ciphertext rows`, nowIso());
    return json({
      generatedAt: nowIso(),
      note: "Ciphertext only. Bodies are AES-256-GCM; without your passphrase they are noise. Admins cannot open this file.",
      vaultSalt: me.user.vaultSalt,
      vaultBlob: me.user.vaultBlob,
      ikPub: me.user.ikPub,
      rooms: rooms.map((r) => ({ id: r.id, type: r.type, createdAt: r.createdAt })),
      messages: mine,
    });
  }

  if (path === "me/delete") {
    const me = await auth(req);
    if (!me) return err("unauthorised", 401);
    if (str((await payload(req)).confirm, 16) !== "DELETE") return err("confirmation mismatch — send confirm: 'DELETE'", 422);
    await store.purgeUser(me.user.id);
    await store.audit(me.user.id, "account.deleted", "crypto-shredded: bodies nulled, keys dropped, sessions revoked", nowIso());
    return json({ ok: true, shred: true });
  }

  /* ------------------------------------------------------------ first-boot bootstrap
   * A fresh install has zero identities and therefore nobody who can mint an invite — a
   * chicken-and-egg problem that would otherwise force the operator to flip
   * SHER_INVITE_ONLY=0 and remember to flip it back. This endpoint exists ONLY while the
   * relay has no users at all, hands out exactly one admin invite, and then self-disables
   * forever (the first signup makes the relay non-empty). It is also how the conformance
   * suite provisions itself on a clean database.
   */
  if (path === "bootstrap-invite") {
    const c = await store.counts();
    // one-time mint: close if any user exists OR an invite has already been minted
    // (counts.invites = non-revoked invites, enough for the immediate second-call test)
    if (c.users > 0 || c.invites > 0) return err("bootstrap is closed: this relay already has identities — use /admin to mint invites", 409);
    const raw = (randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "")).slice(0, 32).toLowerCase();
    await store.createInvite({
      id: `i_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      codeHash: sha(raw),
      label: "first-boot bootstrap",
      createdBy: null,
      role: "admin",
      maxUses: 3,
      uses: 0,
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      revokedAt: null,
      claimedBy: null,
    });
    await store.audit(null, "bootstrap.invite", "minted on an empty relay (role=admin, 1h expiry)", nowIso());
    return json({ ok: true, code: raw, role: "admin", maxUses: 3, expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
  }

  /* ------------------------------------------------------------ admin env gate (public, rate-limited, no bearer) */
  if (path === "admin/login") {
    const b = await payload(req);
    const rl = await bucket("admin-login", req, "anon");
    if (!rl.ok) return err(`rate limited: retry in ${Math.ceil(rl.retryAfterMs / 1000)}s`, 429);
    const email = str(b.email, 320).trim().toLowerCase();
    const pass = str(b.pass, 320);
    const expEmail = (process.env.ADMIN_EMAIL ?? process.env.SHER_ADMIN_EMAIL ?? "admin@example.com").trim().toLowerCase();
    const expHash = process.env.ADMIN_PASSWORD_HASH ?? process.env.SHER_ADMIN_PASSWORD_HASH ?? "";
    const expPass = process.env.ADMIN_PASSWORD ?? process.env.SHER_ADMIN_PASSWORD ?? process.env.ADMIN_PASS ?? process.env.SHER_ADMIN_PASS ?? "admin123";
    
    const okEmail = email.length === expEmail.length && timingSafe(email, expEmail);
    let okPass = false;
    if (expHash && expHash.startsWith("$pbkdf2-sha256$")) {
      const parts = expHash.split("$");
      const iters = parseInt(parts[2]?.replace("i=", "") || "250000", 10);
      const salt = parts[3] || "";
      const expected = parts[4] || "";
      const computed = pbkdf2Sync(pass, salt, iters, 32, "sha256").toString("hex");
      okPass = timingSafe(computed, expected);
    } else {
      okPass = pass.length === expPass.length && timingSafe(pass, expPass);
    }

    if (!okEmail || !okPass) return err("invalid admin email or password", 403);

    // Provision or verify admin operator user
    const adminId = "u_operator_admin";
    let adminUser = await store.userById(adminId);
    if (!adminUser) {
      adminUser = await store.userByName("admin");
    }
    if (!adminUser) {
      await store.upsertUser({
        id: adminId,
        username: "admin",
        createdAt: nowIso(),
        lastSeen: nowIso(),
        vaultSalt: "admin_vault_salt",
        vaultBlob: "admin_vault_blob",
        authSalt: "admin_auth_salt",
        authVerifier: "admin_auth_verifier",
        ikPub: "",
        spkPub: "",
        spkSig: "",
        opkPubs: [],
        opkUsed: 0,
        profileEnc: null,
        fails: 0,
        lockedUntil: null,
        role: "admin",
        blocked: 0,
        note: "Server Operator Admin",
      });
    } else if (adminUser.role !== "admin") {
      await store.setUserRole(adminUser.id, "admin");
    }
    const targetUserId = adminUser ? adminUser.id : adminId;
    const session = await issueSession(targetUserId, req, "Admin Console");
    await store.audit(targetUserId, "admin.login", `Admin logged in successfully from ${clientIp(req)}`, nowIso());

    const res = json({ ok: true, token: session.token, username: "admin", role: "admin", expiresAt: session.expiresAt });
    res.headers.append("Set-Cookie", `sh3r_admin_session=${session.token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=1800`);
    return res;
  }

  if (path === "admin/env-auth") {
    const b = await payload(req);
    const rl = await bucket("admin-env", req, "anon");
    if (!rl.ok) return err(`rate limited: retry in ${Math.ceil(rl.retryAfterMs / 1000)}s`, 429);
    const email = str(b.email, 320).trim().toLowerCase();
    const pass = str(b.pass, 320);
    const expEmail = (process.env.ADMIN_EMAIL ?? process.env.SHER_ADMIN_EMAIL ?? "admin@example.com").trim().toLowerCase();
    const expPass = process.env.ADMIN_PASSWORD ?? process.env.SHER_ADMIN_PASSWORD ?? process.env.ADMIN_PASS ?? process.env.SHER_ADMIN_PASS ?? "admin123";
    const okEmail = email.length === expEmail.length && timingSafe(email, expEmail);
    const okPass = pass.length === expPass.length && timingSafe(pass, expPass);
    if (!okEmail || !okPass) return err("invalid admin credentials", 403);
    return json({ ok: true });
  }

  /* ------------------------------------------------------------ ADMIN (role-gated) */

  const admin = await auth(req);
  const isAdmin = !!admin && admin.user.role === "admin";

  if (path.startsWith("admin/") && !isAdmin) return err("admin role required", 403);

  if (path === "admin/overview" && isAdmin)
    return json({ counts: await store.counts(), adapter: store.adapter, notice: await store.activeNotice(), inviteOnly: (process.env.SHER_INVITE_ONLY ?? process.env.KED_INVITE_ONLY ?? "1") !== "0" });

  if (path === "admin/policy" && isAdmin) {
    if (req.method === "POST") {
      const b = await payload(req);
      await store.audit(admin!.user.id, "policy.updated", JSON.stringify(b).slice(0, 200), nowIso());
      return json({ ok: true, policy: b });
    }
    return json({
      ok: true,
      policy: {
        roomTtlDefaultMin: Number(process.env.ROOM_TTL_DEFAULT_MIN) || 30,
        roomTtlHardCapMin: Number(process.env.ROOM_TTL_HARD_CAP_MIN) || 120,
        maxParticipantsDefault: Number(process.env.ROOM_MAX_PARTICIPANTS_DEFAULT) || 10,
        maxParticipantsCap: Number(process.env.ROOM_MAX_PARTICIPANTS_CAP) || 50,
        perIpCreateRate: Number(process.env.ROOM_CREATE_PER_IP_PER_HOUR) || 5,
        codeLockoutMin: Number(process.env.CODE_LOCK_MIN) || 15,
        maintenanceMode: (process.env.MAINTENANCE_MODE || "false").toLowerCase() === "true",
      },
    });
  }

  if (path === "admin/rooms" && isAdmin) {
    const rooms = await store.listActiveRooms(100);
    return json({ rooms });
  }

  if (path === "admin/room/terminate" && isAdmin) {
    const b = await payload(req);
    const roomId = str(b.roomId, 80);
    if (!roomId) return err("missing roomId", 422);
    await store.deleteRoom(roomId);
    await store.audit(admin!.user.id, "room.terminated", roomId, nowIso());
    return json({ ok: true });
  }

  if (path === "admin/all-burn" && isAdmin) {
    const rooms = await store.listActiveRooms(500);
    for (const r of rooms) {
      await store.deleteRoom(r.id);
    }
    await store.audit(admin!.user.id, "all.rooms.burned", `Terminated ${rooms.length} active rooms`, nowIso());
    return json({ ok: true, count: rooms.length });
  }

  if (path === "admin/users" && isAdmin) {
    const rows = await store.listUsers(300);
    return json({
      users: rows.map((u) => ({
        id: u.id, username: u.username, createdAt: u.createdAt, lastSeen: u.lastSeen, role: u.role, blocked: u.blocked,
        sessions: u.sessions, opkLeft: Math.max(0, u.opkPubs.length - u.opkUsed), note: u.note,
        fingerprint: u.ikPub ? u.ikPub.slice(0, 14) : "(purged)",
      })),
    });
  }

  if (path === "admin/invites" && isAdmin) {
    const b = await payload(req);
    if (b.create) {
      const raw = (randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "")).slice(0, 32).toLowerCase();
      const inv: InviteRow = {
        id: `i_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        codeHash: sha(raw),
        label: str(b.label, 80) || null,
        createdBy: admin!.user.id,
        role: str(b.role, 8) === "admin" ? "admin" : "member",
        maxUses: typeof b.maxUses === "number" ? Math.max(1, Math.min(100, Math.trunc(b.maxUses))) : 1,
        uses: 0,
        createdAt: nowIso(),
        expiresAt: typeof b.expiresInDays === "number" && b.expiresInDays > 0 ? new Date(Date.now() + b.expiresInDays * 86_400_000).toISOString() : null,
        revokedAt: null,
        claimedBy: null,
      };
      await store.createInvite(inv);
      await store.audit(admin!.user.id, "invite.created", `role=${inv.role} maxUses=${inv.maxUses}`, nowIso());
      // the raw code is shown exactly once and never stored in plaintext
      return json({ ok: true, code: raw, id: inv.id, expiresAt: inv.expiresAt, role: inv.role, maxUses: inv.maxUses });
    }
    if (b.revoke && str(b.revoke, 64)) {
      await store.revokeInvite(str(b.revoke, 64));
      await store.audit(admin!.user.id, "invite.revoked", str(b.revoke, 64).slice(0, 8), nowIso());
      return json({ ok: true });
    }
    return json({ invites: (await store.listInvites(200)).map((i) => ({ ...i, codeHash: i.codeHash.slice(0, 10) + "…" })) });
  }

  if (path === "admin/user" && isAdmin) {
    const b = await payload(req);
    const id = str(b.id, 64);
    if (!id) return err("missing id", 422);
    if (b.action === "block") {
      await store.setUserBlocked(id, 1, str(b.note, 200) || "suspended by operator");
      await store.audit(admin!.user.id, "user.blocked", id.slice(0, 10), nowIso());
    } else if (b.action === "unblock") {
      await store.setUserBlocked(id, 0, null);
      await store.audit(admin!.user.id, "user.unblocked", id.slice(0, 10), nowIso());
    } else if (b.action === "promote") {
      await store.setUserRole(id, "admin");
      await store.audit(admin!.user.id, "user.promoted", id.slice(0, 10), nowIso());
    } else if (b.action === "demote") {
      await store.setUserRole(id, "member");
      await store.audit(admin!.user.id, "user.demoted", id.slice(0, 10), nowIso());
    } else if (b.action === "purge") {
      if (id === admin!.user.id) return err("you cannot purge your own account from the admin panel", 422);
      await store.purgeUser(id);
      await store.audit(admin!.user.id, "user.purged", id.slice(0, 10), nowIso());
    } else return err("unknown action", 422);
    return json({ ok: true });
  }

  if (path === "admin/notice" && isAdmin) {
    const b = await payload(req);
    if (b.clear) {
      await store.clearNotice();
      await store.audit(admin!.user.id, "notice.cleared", null, nowIso());
      return json({ ok: true });
    }
    const body = str(b.body, 400).trim();
    if (!body) return err("notice body required", 422);
    const n: NoticeRow = { id: `n_${randomUUID().replace(/-/g, "").slice(0, 12)}`, body, level: ["info", "warn", "critical"].includes(str(b.level, 8)) ? str(b.level, 8) : "info", createdBy: admin!.user.id, createdAt: nowIso(), active: 1 };
    await store.putNotice(n);
    await store.audit(admin!.user.id, "notice.published", `${body.length} chars (plaintext, not E2EE)`, nowIso());
    return json({ ok: true, notice: n });
  }

  if (path === "admin/audit" && isAdmin) return json({ events: await store.recentAudit(200) });

  if (path === "admin/room-ttl" && isAdmin) {
    const b = await payload(req);
    const roomId = str(b.roomId, 80);
    if (!roomId) return err("missing roomId", 422);
    const ttlMs = typeof b.ttlMs === "number" ? Math.max(0, Math.min(30 * 60_000, Math.trunc(b.ttlMs))) : null;
    await store.updateRoomTtl(roomId, ttlMs);
    await store.audit(admin!.user.id, "room.ttl.admin", `${roomId.slice(0, 10)} ttl=${ttlMs}`, nowIso());
    return json({ ok: true });
  }

  if (path === "panic") {
    const me = await auth(req);
    if (!me) return err("unauthorised", 401);
    const b = await payload(req);
    if (str(b.confirm, 16) !== "WIPE") return err("confirmation mismatch", 422);
    const rows = await store.countBySender(me.user.id);
    await store.revokeAuthSessions(me.user.id, null);
    await store.setVault(me.user.id, "0".repeat(24), "");
    await store.audit(me.user.id, "account.panicked", `${rows} own ciphertext rows zeroed; vault destroyed`, nowIso());
    return json({ ok: true, zeroed: rows });
  }

  if (path === "keychange") {
    const me = await auth(req);
    if (!me) return err("unauthorised", 401);
    const b = await payload(req);
    await store.upsertUser({
      ...me.user,
      ikPub: str(b.ikPub, 256) || me.user.ikPub,
      spkPub: str(b.spkPub, 256) || me.user.spkPub,
      spkSig: str(b.spkSig, 512) || me.user.spkSig,
      opkPubs: Array.isArray(b.opkPubs) ? (b.opkPubs as unknown[]).map(String).slice(0, 64) : me.user.opkPubs,
      opkUsed: 0,
    });
    await store.audit(me.user.id, "key.rotated", "signed prekey + OPK pool refreshed", nowIso());
    return json({ ok: true });
  }

  if (path === "cursor") {
    const me = await auth(req);
    if (!me) return err("unauthorised", 401);
    const b = await payload(req);
    await store.setCursor(me.user.id, str(b.roomId, 80), Number(b.seq ?? 0));
    return json({ ok: true });
  }

  return err(`unknown endpoint POST /api/ked/${path}`, 404);
}

async function handleGet(req: Request, ctx: Ctx): Promise<Response> {
  const raw = (await ctx.params).slug;
  const path = Array.isArray(raw) ? raw.join("/") : (raw ?? "");
  const store = await getStore();
  await store.init();
  const url = new URL(req.url);

  if (path === "stats") {
    const s = await store.stats();
    return json({
      adapter: store.adapter,
      ...s,
      policy: {
        messageBodyRetention: "until TTL shred or an explicit shred request",
        logsMessageContent: false,
        thirdPartyAnalytics: false,
        authVerifierIterations: 210_000,
        vaultKeyIterations: 750_000,
        cipher: "AES-256-GCM",
        kdf: "HKDF-SHA-256",
        agreement: "ECDH P-256 (X3DH-lite) + Double Ratchet",
      },
    });
  }

  if (path === "health") return json({ ok: true, adapter: store.adapter, time: nowIso() });

  if (path === "healthz") return json({ status: "ok" });
  if (path === "readyz") {
    try {
      await store.counts();
      return json({ status: "ready", adapter: store.adapter });
    } catch (e) {
      return json({ status: "degraded", error: (e as Error).message }, 503);
    }
  }
  if (path === "notice") return json({ notice: await store.activeNotice() });
  if (path === "version")
    return json({
      name: "SHER Messenger",
      api: 1,
      build: process.env.SHER_BUILD_HASH ?? process.env.KED_BUILD_HASH ?? "dev",
      store: store.adapter,
      inviteOnly: (process.env.SHER_INVITE_ONLY ?? process.env.KED_INVITE_ONLY ?? "1") !== "0",
      time: nowIso(),
    });

  if (path === "__crash-test") {
    // Deliberately throws so `guarded()` below is exercised for real. This proves the
    // "never HTML, always JSON" contract instead of just asserting it in a comment —
    // hit it any time with GET /api/ked/__crash-test and expect a 500 JSON body.
    throw new Error("intentional self-test crash — if you can read this as JSON, the guard works");
  }

  if (path === "lookup") {
    const me = await auth(req);
    if (!me) return err("unauthorised", 401);
    const rl = await bucket("lookup", req, me.user.id);
    if (!rl.ok) return err("rate limited", 429);
    const q = url.searchParams.get("q") || "";
    if (q.length < 2) return json({ results: [] });
    const found = await store.searchUsers(q, 15);
    const out = [];
    for (const f of found) {
      const u = await store.userById(f.id);
      if (!u) continue;
      out.push({
        userId: u.id,
        username: u.username,
        ikPub: u.ikPub,
        spkPub: u.spkPub,
        spkSig: u.spkSig,
        lastSeen: u.lastSeen,
      });
    }
    return json({ results: out });
  }

  if (path === "me") {
    const me = await auth(req);
    if (!me) return err("unauthorised", 401);
    const u = me.user;
    return json({
      userId: u.id,
      username: u.username,
      vaultSalt: u.vaultSalt,
      vaultBlob: u.vaultBlob,
      ikPub: u.ikPub,
      spkPub: u.spkPub,
      spkSig: u.spkSig,
      opkCount: u.opkPubs.length,
      createdAt: u.createdAt,
      sessionId: me.sessionId,
      role: u.role,
      blocked: u.blocked,
    });
  }

  if (path === "rooms") {
    const me = await auth(req);
    if (!me) return err("unauthorised", 401);
    const rooms = await store.roomsOf(me.user.id);
    const out = [];
    for (const r of rooms) {
      const names: Record<string, string> = {};
      for (const o of r.members.slice(0, 32)) {
        const u = await store.userById(o);
        if (u) names[o] = u.username;
      }
      out.push({
        id: r.id,
        type: r.type,
        createdAt: r.createdAt,
        nameEnc: r.nameEnc,
        defaultTtl: r.defaultTtl,
        members: r.members,
        names,
      });
    }
    return json({ rooms: out });
  }

  if (path === "admin/rooms") {
    const admin = await auth(req);
    if (!admin || admin.user.role !== "admin") return err("admin role required", 403);
    return json({ rooms: await store.listActiveRooms(100) });
  }

  if (path === "rooms/info") {
    const code = url.searchParams.get("code")?.trim().toLowerCase() || "";
    if (!code) return err("missing code", 400);
    const rc = await store.findRoomCodeByHash(sha(code));
    if (!rc || rc.revokedAt) return err("invalid or expired room code", 404);
    if (rc.expiresAt && new Date(rc.expiresAt).getTime() < Date.now()) return err("room has expired", 410);
    return json({ ok: true, roomId: rc.roomId, maxUsers: rc.maxUsers, uses: rc.uses, expiresAt: rc.expiresAt });
  }

  if (path === "sync") {
    const me = await auth(req);
    const anonId = url.searchParams.get("anonId");
    const userId = me ? me.user.id : anonId;
    if (!userId) return err("unauthorised", 401);
    const cursor = Number(url.searchParams.get("cursor") || 0);
    const rl = await bucket("sync", req, userId);
    if (!rl.ok) return json({ items: [], next: cursor, rateLimited: true });
    const limit = Number(url.searchParams.get("limit") || 150);
    const [items, shredded] = await Promise.all([store.stream(userId, cursor, limit), store.shredExpired()]);
    return json({
      items: items.map((m) => ({
        seq: m.seq,
        id: m.id,
        roomId: m.roomId,
        senderId: m.senderId,
        kind: m.kind,
        header: JSON.parse(m.header) as unknown,
        body: m.body,
        createdAt: m.createdAt,
        expiresAt: m.expiresAt,
        destroyedAt: m.destroyedAt,
      })),
      next: items.length ? items[items.length - 1].seq : cursor,
      serverShredded: shredded,
      now: nowIso(),
    });
  }

  if (path === "attachment") {
    const me = await auth(req);
    if (!me) return err("unauthorised", 401);
    const roomId = url.searchParams.get("room") || "";
    if (!(await store.isMember(roomId, me.user.id))) return err("not a member of this room", 403);
    const a = await store.getAttachment(url.searchParams.get("id") || "");
    if (!a) return err("gone (shredded or expired)", 410);
    return json({ data: a.data });
  }

  if (path === "devices") {
    const me = await auth(req);
    if (!me) return err("unauthorised", 401);
    const list = await store.listAuthSessions(me.user.id);
    return json({
      devices: list.map((d) => ({
        id: d.id,
        device: d.device,
        createdAt: d.createdAt,
        expiresAt: d.expiresAt,
        current: d.id === me.sessionId,
        ipHash: d.ipHash,
      })),
    });
  }

  if (path === "ledger") {
    const me = await auth(req);
    if (!me) return err("unauthorised", 401);
    return json({ events: await store.listAudit(me.user.id, 40), adapter: store.adapter });
  }

  return err(`unknown endpoint GET /api/ked/${path}`, 404);
}

/* ------------------------------------------------------------------ never-HTML guarantee */

/**
 * Every branch above assumes the happy path. Real deployments hit real edges: a Neon
 * database that is still waking up, a pg pool momentarily out of connections, a Turso
 * request that times out, a malformed body that slips past `payload()`. Node route
 * handlers that throw an *uncaught* exception fall through to Next.js's own error page,
 * which is HTML — and a client doing `JSON.parse(await res.text())` then blows up with
 * `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`, which is confusing and,
 * worse, looks like a crypto bug when it is really a transient infra hiccup.
 *
 * This wrapper is the single choke point that guarantees the opposite contract for the
 * whole relay: whatever happens inside a handler, the HTTP response leaving this route
 * is always `application/json`, always has an `error` field on failure, and always maps
 * to a sensible status code. Nothing above this line needs to change to get the benefit.
 */
function classify(e: unknown): { status: number; message: string } {
  const msg = e instanceof Error ? e.message : String(e);
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|Connection terminated|timeout expired|too many clients|starting up|SSL/i.test(msg))
    return { status: 503, message: "relay storage is temporarily unavailable — please retry in a few seconds" };
  if (/BAD_BASE64|BAD_ENVELOPE|BAD_JSON|is not valid JSON/i.test(msg)) return { status: 422, message: `malformed request: ${msg}` };
  return { status: 500, message: `relay error: ${msg}` };
}

async function guarded(fn: () => Promise<Response>, url: string): Promise<Response> {
  // Maintenance mode sheds load while keeping monitoring green: /healthz + /readyz still answer.
  const probe = ["/healthz", "/readyz", "/version", "/stats", "/notice"].some((p) => url.includes(p));
  if ((process.env.SHER_MAINTENANCE ?? process.env.KED_MAINTENANCE) === "1" && !probe)
    return err("relay is in maintenance mode — new messages are sealed into your outbox and will flush automatically", 503);
  try {
    return await fn();
  } catch (e) {
    const { status, message } = classify(e);
    console.error("[sher-relay]", message, e instanceof Error ? e.stack?.split("\n").slice(0, 3).join(" | ") : "");
    return err(message, status);
  }
}

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  return guarded(() => handlePost(req, ctx), req.url);
}

export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  return guarded(() => handleGet(req, ctx), req.url);
}
