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

## Key lifecycle

| Key | Created | Lives | Rotated | Destroyed |
| --- | --- | --- | --- | --- |
| Vault key | at signup, `PBKDF2(pass, 16B salt, 750k)` | memory + sessionStorage (tab only) | on passphrase change | tab close, panic wipe |
| Identity (IK) | at signup, P-256 | inside encrypted vault | manual "Rotate bundle" | with vault |
| Signed prekey (SPK) | at signup | public half on relay | with rotation | old one dropped |
| One-time prekeys (OPK ×24) | at signup | public half on relay, consumed once | `keychange` republishes 24 | consumed at use |
| Root / chain keys | per conversation | inside encrypted vault | every DH ratchet step | on advance |
| Message key | per message | memory, microseconds | n/a | **immediately after use** |
| Attachment key | per file | inside the sealed message body | n/a | n/a |

## ER model

```
ked_users ─┬─< ked_auth_sessions
           ├─< ked_room_members >─ ked_rooms ─< ked_messages
           ├─< ked_devices
           ├─< ked_audit
ked_invites (code_hash, role, max_uses, uses, expires_at, revoked_at)
ked_notices (active flag; plaintext BY DESIGN, flagged "not E2EE")
ked_rate    (token buckets)
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
