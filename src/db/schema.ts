import { integer, pgTable, text, bigint, index, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * SHER Messenger — relay schema.
 *
 * IMPORTANT: every column here is either public key material, ciphertext, or
 * transport metadata. The relay has no row that contains plaintext message
 * content, sender display names of participants beyond the authenticated id,
 * or device readable key material. See /plan -> "Threat model".
 */

export const users = pgTable(
  "ked_users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    createdAt: text("created_at").notNull(),
    lastSeen: text("last_seen"),
    // encrypted private-vault blob (AES-256-GCM, key = PBKDF2(passphrase))
    vaultSalt: text("vault_salt").notNull(),
    vaultBlob: text("vault_blob").notNull(),
    // server-side auth material (never usable to decrypt the vault)
    authSalt: text("auth_salt").notNull(),
    authVerifier: text("auth_verifier").notNull(),
    // public X3DH key bundle
    ikPub: text("ik_pub").notNull(),
    spkPub: text("spk_pub").notNull(),
    spkSig: text("spk_sig").notNull(),
    opkPubs: text("opk_pubs").notNull(),
    opkUsed: integer("opk_used").notNull().default(0),
    profileEnc: text("profile_enc"),
    fails: integer("fails").notNull().default(0),
    lockedUntil: text("locked_until"),
    // role = "member" | "admin" (granted only via an admin-flagged invite)
    role: text("role").notNull().default("member"),
    // soft-block: revokes sessions and refuses new ones, data stays for the user to export
    blocked: integer("blocked").notNull().default(0),
    note: text("note"),
  },
  (t) => [uniqueIndex("ked_users_username_key").on(t.username)],
);

/**
 * Invite-only signup. Anyone may hold a token; only the relay knows it was issued.
 * The token itself is stored hashed, exactly like a bearer session token.
 */
export const invites = pgTable(
  "ked_invites",
  {
    id: text("id").primaryKey(),
    codeHash: text("code_hash").notNull(),
    label: text("label"),
    createdBy: text("created_by"),
    role: text("role").notNull().default("member"),
    maxUses: integer("max_uses").notNull().default(1),
    uses: integer("uses").notNull().default(0),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at"),
    revokedAt: text("revoked_at"),
    claimedBy: text("claimed_by"),
  },
  (t) => [uniqueIndex("ked_invites_code_key").on(t.codeHash)],
);

/** Server-side plaintext notices (system banners). Explicitly NOT end-to-end encrypted. */
export const notices = pgTable("ked_notices", {
  id: text("id").primaryKey(),
  body: text("body").notNull(),
  level: text("level").notNull().default("info"),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull(),
  active: integer("active").notNull().default(1),
});

/** One line per issued relay token, so an admin can see device inventory without content. */
export const deviceLog = pgTable(
  "ked_devices",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    label: text("label"),
    createdAt: text("created_at").notNull(),
    lastSeen: text("last_seen"),
    revokedAt: text("revoked_at"),
  },
  (t) => [index("ked_devices_user_idx").on(t.userId)],
);

export const authSessions = pgTable(
  "ked_auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    device: text("device"),
    ipHash: text("ip_hash"),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (t) => [index("ked_auth_token_idx").on(t.tokenHash), index("ked_auth_user_idx").on(t.userId)],
);

export const rooms = pgTable(
  "ked_rooms",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    createdAt: text("created_at").notNull(),
    nameEnc: text("name_enc"),
    createdBy: text("created_by"),
    defaultTtl: integer("default_ttl"),
  },
);

export const roomMembers = pgTable(
  "ked_room_members",
  {
    roomId: text("room_id").notNull(),
    userId: text("user_id").notNull(),
    joinedAt: text("joined_at").notNull(),
    // per-member wrapped group sender-key seed (ciphertext, E2EE)
    wrappedKey: text("wrapped_key"),
    lastSeq: bigint("last_seq", { mode: "number" }).notNull().default(0),
  },
  (t) => [uniqueIndex("ked_room_member_key").on(t.roomId, t.userId), index("ked_room_member_user").on(t.userId)],
);

export const messages = pgTable(
  "ked_messages",
  {
    seq: bigint("seq", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    id: text("id").notNull(),
    roomId: text("room_id").notNull(),
    senderId: text("sender_id").notNull(),
    kind: text("kind").notNull(),
    header: text("header").notNull(),
    body: text("body"),
    size: integer("size").notNull().default(0),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at"),
    destroyedAt: text("destroyed_at"),
  },
  (t) => [index("ked_msg_room_seq").on(t.roomId, t.seq), index("ked_msg_expires").on(t.expiresAt)],
);

export const attachments = pgTable(
  "ked_attachments",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull(),
    uploaderId: text("uploader_id").notNull(),
    data: text("data").notNull(),
    size: integer("size").notNull(),
    sha: text("sha").notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at"),
    destroyedAt: text("destroyed_at"),
  },
  (t) => [index("ked_att_room").on(t.roomId)],
);

/** Relay-side security ledger. Content-free: only event classes + opaque ids. */
export const auditLog = pgTable(
  "ked_audit",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    event: text("event").notNull(),
    detail: text("detail"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("ked_audit_user_idx").on(t.userId)],
);

export const rateBuckets = pgTable(
  "ked_rate",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(0),
    windowStart: bigint("window_start", { mode: "number" }).notNull().default(0),
  },
);
