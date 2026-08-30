# DATA RETENTION

| Data | Where | Default retention | Trigger for early deletion | Method |
| --- | --- | --- | --- | --- |
| Message ciphertext (`ked_messages.body`) | relay DB | until deleted | user delete-for-everyone, TTL burn, admin purge, account deletion | `body = NULL`, `destroyed_at = now` (**crypto-shredding**: the per-message key was destroyed at send time, so the row was already unreadable — the row itself becomes a tombstone) |
| Message tombstone (`seq`, `kind`, `size`, `created_at`) | relay DB | until account deletion | account deletion / admin purge | row kept for ordering, content gone |
| Attachment ciphertext | relay row (today) or R2/B2 | 7 days default, configurable per send (`ttlMs`) | TTL sweep on every `/sync` | blob emptied, `destroyed_at` set |
| Ephemeral code-room messages (`ked_messages` with `defaultTtl <=30m`) | relay DB + local history | **≤30m hard cap** (`30*60_000`) | `shredExpired()` on every `/sync` + client `burnDue()` every 700ms | server: `body=NULL`; client: `HistMsg` zeroed locally; no recovery |
| Room codes (`ked_room_codes`: `code_hash`, `max_users`, `uses`, `expires_at`) | relay DB | until `expiresAt` (≤30m) or full / revoked | TTL, `revokeRoomCode`, `deleteRoom`, or room auto-delete | `revoked_at` set; only `code_hash` (SHA-256 of 6-char) stored, never plaintext; `created_by` may be `anon_xxx` (no `ked_users` FK) |
| Anon 30m rooms — **FREE without login** (`anon_xxx` ids) | relay DB (`ked_room_codes` + `ked_room_members` + `ked_rooms` + `ked_messages` with `anon_xxx`) + browser memory/`sessionStorage` only | **≤30m** or until browser close | `expiresAt` shred (`shredExpired`/`burnDue`), `beforeunload` wipe, room auto-delete | **no `ked_users` row**; only ephemeral `ked_room_codes`/`ked_room_members` with `anon_xxx` (`anonId` generated client-side, stored in memory/session only, never in `ked_users`); purged at `expiresAt` or on browser close — a new tab = new `anon_xxx` |
| Vault mirror (`vault_blob`) | `ked_users` | until overwritten or account deleted | panic wipe, account deletion | overwritten with `''` + salt blanked |
| Local vault envelope (`ked.vault.v1.<username>` in `localStorage`) | browser `localStorage` | until Clear cache / Wipe / browser clear | `ls.del()` + `ss.clear()` + panic wipe | envelope `{n,c,salt,at}` where `c = AES-GCM(vaultKey, JSON.stringify(VaultData), utf8(username))`, `vaultKey = PBKDF2(passphrase, 16B random salt, 750k)` (`src/lib/client.ts`); plaintext on relay is only ciphertext+opaque ids |
| Tab resume key (`ked.resume.v1` in `sessionStorage`) | browser `sessionStorage` (tab-only) | tab lifetime | `beforeunload` → `sessionStorage.clear()`, panic wipe | raw `vaultKey` b64 dies with tab; next open requires passphrase |
| Public key bundle (IK/SPK/OPK) | `ked_users` | until rotated or deleted | key rotation, purge | overwritten; OPK counter reset |
| One-time prekeys (consumed) | relay, in-use pointer | consumed immediately, never re-served | n/a | the *private* half never existed server-side |
| Auth sessions (`ked_auth_sessions`) | relay DB | 30 days | logout, device revoke, block, purge | `revoked_at` set; rows pruned on the 30-day boundary |
| Invites (`ked_invites`) | relay DB | until revoked or expiry | admin revoke | `revoked_at` set; only `code_hash` is stored, never the code |
| Audit log (`ked_audit`) | relay DB | **rolling 30 days** | age | event class + opaque id only; no content, no IPs |
| Rate buckets (`ked_rate`) | relay DB | window length (60s–10min) | window rollover | overwritten in place |
| System notices (`ked_notices`) | relay DB | until cleared | admin "clear notice" | `active = 0` |
| Local decrypted history | your browser `localStorage` (inside vault envelope) + `history` in vault | until panic wipe / TTL burn / browser clear / tab close (ephemeral) | panic wipe, `beforeunload` (ephemeral ≤30m), `Clear site data` | overwritten with empty vault; ephemeral rooms wiped on `beforeunload` |
| Offline outbox | your browser IndexedDB | until flush, or 8 failed attempts, or 7 days | successful flush / expiry | row deleted |
| Hosting-provider request logs | Cloudflare/Vercel/Netlify | provider-controlled | n/a (not ours) | see provider policy links in `/privacy` §5 |

## Deletion rights

* **Self-service:** Inspector → Hardening → *Panic wipe* (self), or `POST /api/ked/me/delete` with `{"confirm":"DELETE"}`.
* **Operator:** `/admin` → Users → *purge* (blocks the identity first, then shreds every room it was in).
* **Export first:** `POST /api/ked/me/export` returns your vault blob + every ciphertext row addressed to you.
  It is ciphertext; without your passphrase it is noise — and the operator cannot open it either.

## Crypto-shredding, precisely

Deleting a row is not the interesting part. The interesting part is that **the message key used to encrypt
each body was derived from a hash chain and destroyed immediately after use, on both ends**. A database dump
taken a millisecond after delivery therefore contains ciphertext whose key no longer exists anywhere in the
universe. `body = NULL` is housekeeping, not the security boundary.

## Free 30m rooms — no login (anon ephemerals) & 30m auto-burn (code-rooms)

- **Free without login (bina login ke):** `POST /api/ked/rooms/code` (`route.ts:278`) and `rooms/join` (`route.ts:303`) accept `{anonId, …}` with **no Bearer required** (`userId = auth?.user.id ?? anonId ?? auto anon_xxx`). `send` (`route.ts:322`) + `sync` (`route.ts:778`) accept the same fallback. `anonId` (`anon_<12 hex>`) is generated client-side in memory/`sessionStorage` only, never in `ked_users`; the relay only stores opaque `anon_xxx` in `ked_room_codes.created_by`, `ked_room_members`, and `ked_messages.sender_id`. Close tab → `anonId` discarded.
- **Creation:** `POST /api/ked/rooms/code` sets `ked_rooms.default_ttl = ttlMs` where `60_000 <= ttlMs <= 30*60_000` (hard cap in `src/app/api/ked/[...slug]/route.ts:285`). `ked_room_codes` row carries the same `expiresAt = now + ttlMs`. For anon rooms, **no `ked_users` row** is created — only `ked_room_codes` + `ked_room_members` (`anon_xxx`) + `ked_rooms`.
- **Server burn:** every `GET /api/ked/sync` calls `store.shredExpired()` which nulls `body` / sets `destroyedAt` for all `expires_at < now`. Client receives `destroyedAt` and drops the body.
- **Client burn:** `KedClient.burnDue()` runs every **700 ms** (`src/lib/client.ts`) and locally destroys `HistMsg` entries with `expiresAt <= now` (`destroyed=true, text="", attachment=null`), then `persist()`s the vault.
- **Result:** after `30m`, history is dead on **both** sides — no export, no admin purge reversal. The room's `ked_room_codes` entry is expired/revoked and `deleteRoom` will zero the whole room on next cleanup. **Anon rooms leave no persistent identity:** after `30m` or browser close, only tombstoned `anon_xxx` rows remain until purged; a new tab generates a new `anon_xxx` with no link to the prior one. Persistent DM/group rooms still require a `ked_users` account and Double Ratchet sessions.

## Auto-delete on browser close

- `src/app/page.tsx` (`beforeunload`) does `sessionStorage.clear()` → kills `ked.resume.v1` (tab vault key), `ked.admin.env`, and any `anonId` (`anon_xxx`). For ephemeral rooms (`ttl <= 30*60_000`) — including **anon 30m rooms with no login** — it also sets `client.data.history[roomId] = []` locally and discards the in-memory `anonId`; the next tab gets a fresh `anon_xxx`.
- `globals.css` applies `.watermark` (`repeating-linear-gradient(-30deg)` at 4% opacity) and `.secret` (`filter: blur(7px)`) while unfocused, so the back/forward cache shows no plaintext.
- **Next open requires the passphrase** to re-derive `vaultKey = PBKDF2(passphrase, salt, 750k)` and `openAead` the `ked.vault.v1.<username>` envelope. No cookie or disk key survives the close. **Anon users have nothing to re-derive** — their `anonId` lived only in `sessionStorage`/memory and is gone; anonymous rooms are not recoverable after close (only the 30m relay tombstones remain until `shredExpired`).

## Local vault at rest & Clear cache / Wipe

- **Store:** `localStorage` key `ked.vault.v1.<username>` → `{n: "v1", c: "v1.<iv>.<ciphertext>", salt: "<16B b64>", at: <ts>}`. `c` is `seal(vaultKey, JSON.stringify(VaultData), utf8(username))` (`src/lib/client.ts:229`). VaultData holds private keys, contacts, sessions, history, ledger — never plaintext on disk.
- **What's plaintext on the relay:** only ciphertext `body = iv.ct`, public headers, opaque ids (`u_…`, `r_…`), `size`/`createdAt`, and `code_hash` hashes. The relay cannot derive the vault key from the stored PBKDF2 verifier (different salt + lower cost).
- **Clear cache / Wipe:** user clicks Clear cache or Panic wipe → `ls.del(vaultKeyFor(username))` + `ss.clear()` + `POST /api/ked/me/delete {confirm:"DELETE"}` or `POST /api/ked/panic {confirm:"WIPE"}` → server `purgeUser` does `body=NULL, destroyed_at=now`, revokes sessions, blanks `vault_salt/vault_blob/ik_pub/opk_pubs`. Without the passphrase the remaining ciphertext is permanent noise.
