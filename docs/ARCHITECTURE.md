# ARCHITECTURE

## Adapters

Everything provider-specific sits behind one of three env-driven interfaces, so switching a vendor is a config change, not a rewrite.

| Interface | Env | Implementations |
| --- | --- | --- |
| `Store` (relay persistence) | `DATABASE_URL` / `TURSO_URL` / `SHER_SQLITE_PATH` / `SHER_DB=memory` | Postgres (`pg`) · libSQL over HTTP (`/transaction`) · `node:sqlite` file · in-memory |
| `BACKEND_TARGET` | `node` \| `workers` \| `netlify` | selects how the relay router is hosted; handler signature is `Request -> Promise<Response>` everywhere |
| `STORE_TARGET` (attachments) | `r2` \| `b2` \| `inline` | R2/B2 adapters take the same `put(id, cipherB64, ttl)` shape; `inline` keeps the base64 in the row (today's default) |

Selection order for storage: `SHER_DB` override → `SHER_SQLITE_PATH` → `TURSO_URL` → `DATABASE_URL` → memory.

## Data flow: one message

```
sender tab                        relay (blind)                     receiver tab
──────────────────────────────────────────────────────────────────────────────────
1. payload = {t:'msg',text,at,replyTo,attachment}
2. mk, nextChain = HKDF2(sendChain, root, "KED-DR-step-v1")
3. aad      = JSON(header)                       ← binds routing to ciphertext
4. ct       = AES-256-GCM(mk, payload, aad)
5. sig      = ECDSA_IK(SHA256(header ‖ iv.ct))
6. POST /api/ked/send {roomId, header, body:"iv.ct", ttlMs}
                                  │
                                  ├─ 403 unless room member
                                  ├─ INSERT row: id, room_id, sender_id,
                                  │              kind, header(public), body(ct),
                                  │              size, created_at, expires_at
                                  └─ TTL? Cron/sweep sets body=NULL
                                                                    7. GET /sync?cursor=seq
                                                                    8. verify sig(header.s, sig, body)
                                                                       mismatch → "integrity.violation", drop
                                                                    9. header.r new? → DH ratchet step (ECDH)
                                                                   10. advance recv chain (≤64 skipped keys)
                                                                   11. open() → mk destroyed immediately
```

### Data flow: room code (ephemeral group, 30m)

```
creator tab                              relay                          joiner tab
─────────                                ─────                          ──────────
POST /api/ked/rooms/code {maxUsers 2-30, ttlMs 1-30m}
                         ──► ensureRoom(r_<id>, type=group, defaultTtl=ttlMs)
                             joinRoom(creator)
                             INSERT ked_room_codes {codeHash=SHA256(6-char), roomId, maxUsers, expiresAt=now+ttlMs, uses=1}
                         ◄── {roomId, code: "a1b2c3", maxUsers, expiresAt}

share code o.o.b. (link, QR, voice)

                                         POST /api/ked/rooms/join {code}
                                         ──► findRoomCodeByHash(SHA(code))
                                             checks: !revoked, !expired, uses < maxUsers, members < maxUsers
                                             UPDATE uses+=1; joinRoom(joiner)
                                         ◄── {roomId}

both members now sync via GET /sync and speak via POST /send (same blind flow above)
after ttlMs: server shredExpired nulls body; client burnDue (700ms) zeroes local history
```

## Key lifecycle

| Key | Created | Lives | Rotated | Destroyed |
| --- | --- | --- | --- | --- |
| Vault key | at signup, `PBKDF2(pass, 16B salt, 750k)` | memory + sessionStorage `ked.resume.v1` (tab only) | on passphrase change | tab close (`beforeunload` clears sessionStorage), panic wipe |
| Identity (IK) | at signup, P-256 | inside encrypted vault (`ked.vault.v1.<username>`) | manual "Rotate bundle" | with vault |
| Signed prekey (SPK) | at signup | public half on relay | with rotation | old one dropped |
| One-time prekeys (OPK ×24) | at signup | public half on relay, consumed once | `keychange` republishes 24 | consumed at use |
| Root / chain keys | per conversation | inside encrypted vault | every DH ratchet step | on advance |
| Message key | per message | memory, microseconds | n/a | **immediately after use** |
| Attachment key | per file | inside the sealed message body | n/a | n/a |

### Local vault encryption at rest (extreme privacy)

- **PBKDF2:** `vaultKey = PBKDF2(passphrase, 16B random salt, 750 000)` (`src/lib/client.ts` → `deriveVaultKey`). 750k rounds, SHA-256, per-account random salt (stored alongside the envelope so it can be re-derived on unlock). A *different* salt (`ked-auth-v1:<username>`) and lower cost (210k) derives the auth verifier — so the stored verifier never reveals the vault key.
- **Envelope:** `seal(vaultKey, JSON.stringify(VaultData), utf8(username))` → AES-256-GCM with the username as AAD → stored as `v1.<iv>.<ciphertext>` plus `{salt, at}` under `localStorage` key `ked.vault.v1.<username>` (`src/lib/client.ts:229`, `ls.set` in `encryptVault`). `sessionStorage` key `ked.resume.v1 = {username, token, key:b64(vaultKey)}` keeps the tab fast; it dies with the tab.
- **What's plaintext on the relay:** only `header` (ECDH/ECDSA public material), `body` = `iv.ct` ciphertext, `size`, `roomId`/`senderId` opaque ids, public keys, SHA-256(token). No vault key, no passphrase, no plaintext.
- **Clear cache / Wipe:** `ls.del(vaultKey)` + `ss.clear()` + `store.purgeUser` → `body=NULL`, sessions revoked, public keys blanked. Next open must re-derive via passphrase; without it the ciphertext is noise.

### Public web, hidden admin

- Web is public (no auth for `/`). `/admin` is never linked in nav; `src/app/admin/page.tsx` requires `sessionStorage ked.admin.env == "1"` (set only after `POST /api/ked/admin/env-auth` with both `ADMIN_EMAIL` + `ADMIN_PASSWORD` from env). Backend double-checks `isAdmin` on every `admin/*` handler (`route.ts:522`). Env vars are read via `process.env.ADMIN_EMAIL ?? SHER_ADMIN_EMAIL` and `ADMIN_PASSWORD ?? SHER_ADMIN_PASSWORD` (`route.ts:510`).

### Public room codes (ephemeral, 30m)

**Purpose:** frictionless group creation without pre-sharing DMs — creator sets `maxUsers` 2-30 and `ttlMs` 1-30m (cap `30*60_000`).

- `POST /api/ked/rooms/code` (`route.ts:278`) — auth required, rate-limited (`rooms`). Validates `maxUsers`/`ttlMs`, creates `r_<16>` group room with `defaultTtl = ttlMs`, `joinRoom(creator)`, mints `6`-char `code` (`randomUUID` slice), stores `ked_room_codes {id: rc_…, codeHash: SHA-256(code), roomId, createdBy, maxUsers, uses:1, expiresAt: now+ttlMs}`. Returns `{roomId, code, maxUsers, expiresAt}`.
- `POST /api/ked/rooms/join` (`route.ts:307`) — auth required, validates code, calls `store.consumeRoomCode(SHA(code), userId)` which checks `revokedAt`, `expiresAt`, `uses < maxUsers`, and `roomMembers < maxUsers` before `joinRoom`. Returns `{roomId}`.

Both paths use `src/server/store.ts` `RoomCodeRow` + `SqlStore`/`MemoryStore`. Rate buckets prevent enumeration.

### Ephemeral rooms & 30m auto-burn

- **Server TTL:** `shredExpired()` runs on every `GET /sync` (and any re-poll). It does `UPDATE ked_messages SET body=NULL, destroyedAt=now WHERE expiresAt < now AND body IS NOT NULL` and similarly empties `ked_attachments`. Rows become tombstones but ordering is kept.
- **Client TTL:** `KedClient.burnDue()` (`src/lib/client.ts`) runs every **700 ms**. It iterates `history[roomId]` and zeroes any `expiresAt <= now` entry (`destroyed=true`, `text=""`, `attachment=null`) and writes a ledger `message.burned`.
- **DefaultTtl:** code-rooms set `ked_rooms.default_ttl = ttlMs`; legacy groups use `settings.ttlMs`. Either way the per-message `expiresAt` is derived from `room.ttl ?? settings.ttlMs` at send time (`client.ts:865`).

After `30m`, **history is dead on both sides** — `body` is gone from the relay and the local `HistMsg` array is cleared on next open via the `beforeunload` path (`src/app/page.tsx:156`). See `DATA-RETENTION.md`.

## ER model

```
ked_users ─┬─< ked_auth_sessions
           ├─< ked_room_members >─ ked_rooms ─< ked_messages
           ├─< ked_devices
           ├─< ked_audit
ked_invites    (code_hash, role, max_uses, uses, expires_at, revoked_at)
ked_room_codes (code_hash, room_id, created_by, max_users, uses, expires_at, revoked_at) — 6-char ephemeral codes, SHA-256 hashed
ked_notices    (active flag; plaintext BY DESIGN, flagged "not E2EE")
ked_rate       (token buckets)
ked_attachments (id, room_id, data=ciphertext, expires_at, destroyed_at)
```

Every table is created with `CREATE TABLE IF NOT EXISTS` on first boot; the same DDL exists in a
Postgres and a SQLite dialect, plus a Drizzle schema (`src/db/schema.ts`) for `drizzle-kit push`.

## Realtime protocol

Cursor-based by design so it degrades to SSE or plain polling without a protocol change.

```
GET /api/ked/sync?cursor=<seq>&limit=150
  → { items:[{seq,id,roomId,senderId,kind,header,body,createdAt,expiresAt,destroyedAt}], next, serverShredded }
```

* `next` is monotonic per user; the client stores it inside the encrypted vault.
* `serverShredded` reports how many expired rows were nulled during this read (free cron).
* WebSocket shape (Cloudflare DO / Ably) is `{"op":"delta","since":seq}` on the same payload —
  `BACKEND_TARGET=workers` swaps the transport, not the messages. On CF free plan, WS upgrade costs
  1 request and in-flight WS messages are not billed per-request (20:1 incoming multiplier), so a
  DO per room is the cheapest realtime primitive available; polling is kept as the universal fallback.
* **Types:** `msg`, `file`, `reaction`, `edit`, `recall`, `receipt`, `typing`, `control` (group-add).

## Failure modes

| Failure | Behaviour | Recovery |
| --- | --- | --- |
| Relay unreachable | message already sealed → queued in IndexedDB outbox, red banner + count | auto-flush on next successful poll, or "flush now" |
| Relay returns non-JSON (proxy page) | client detects, raises a readable error instead of crashing | retry; `guarded()` on the relay makes this near-impossible now |
| Signed-prekey verification fails | `KEY_SUBSTITUTION` error, session refused | re-fetch bundle; treat as active MITM |
| Signature mismatch on receive | `integrity.violation` in the ledger, message dropped | check safety numbers out-of-band |
| Out-of-order delivery | ≤64 skipped keys buffered, then late messages still open | none needed |
| DB cold start (Neon) | `503` JSON from `guarded()`, client keeps outbox | automatic on next poll |
| Vault blob lost + passphrase forgotten | nothing recoverable, by design | restore from encrypted export |
