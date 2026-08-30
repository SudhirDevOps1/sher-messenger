# PRIVACY POLICY

> In-app version: `/privacy` · Last updated **2026-08-29** · Changes are announced via the in-app SYSTEM NOTICE banner.

**One-line summary:** we cannot read your messages. Not because of a policy promise — because the plaintext
never reaches this server. It is encrypted in your browser before it is sent, and the keys never leave your device.

## Data inventory (matches the actual data-flow)

### (a) NEVER COLLECTED — these never touch the server
| Item | Note |
| --- | --- |
| Message plaintext | encrypted in your tab before the request exists |
| Private keys (identity, prekeys, ratchet) | generated and stored inside your encrypted vault |
| Your passphrase | never transmitted; only a PBKDF2 verifier with a *different* salt and lower cost is stored |
| Your contact graph as a social profile | contacts exist only in your encrypted vault |
| Analytics events, ad/tracker pixels, session recording | none exist in the codebase |
| Precise location, contacts, phone book | the app never requests these permissions |

### (b) STORED AS CIPHERTEXT ONLY
| Item | Encryption | Retention |
| --- | --- | --- |
| Message bodies | AES-256-GCM, per-message key (destroyed after use) | until deletion / TTL burn / purge |
| Attachment blobs | AES-256-GCM, one-time key per file; server never sees filename or MIME | 7 days default, configurable |
| Encrypted vault mirror | AES-256-GCM under your PBKDF2 key | until overwritten or account deleted |
| Encrypted profile (name/bio) | AES-256-GCM under your vault key | until you change it |

### (c) STORED IN CLEARTEXT (metadata)
| Item | Why it is unavoidable | Retention |
| --- | --- | --- |
| Handle (username) | so peers can find you and the relay can route | until account deletion |
| Opaque user id (`u_…`) | membership checks | until account deletion |
| Room id, sender id (`u_…` or `anon_xxx`) | routing + 403 enforcement; anon rooms use `anon_xxx` with no `ked_users` row | persistent: until account deletion; anon: ≤30m then purged |
| Byte size, `createdAt`, `destroyedAt` | ordering, TTL sweeps | until account deletion |
| Role (`member`/`admin`), blocked flag | RBAC, abuse control | until account deletion |
| SHA-256(bearer token), PBKDF2 verifier, device label, truncated IP hash | auth | 30 days or until revoked |
| Public keys (IK/SPK/OPK) | they are public by definition | until rotated or deleted |
| Audit rows (event class + opaque id, e.g. `msg.shredded`) | security visibility, **no content** | rolling 30 days |
| Invite `code_hash`, uses, expiry, role | invite-only signup | until revoked |
| Room code `code_hash` (6-char, `ked_room_codes`), `maxUsers`, uses, expiry | ephemeral group join without pre-sharing DMs; codes are SHA-256 hashed, never plaintext | until expiry (≤30m) or consumed / revoked; `expiresAt` enforces hard cap |
| Anon room codes — `ked_room_codes` with `createdBy = anon_xxx`, `ked_room_members` with `anon_xxx` ids | **FREE without login (Zero-Login Mode)** — 30m ephemeral rooms; `anonId` (`anon_<12>`) generated client-side in memory/session only, never in `ked_users`, never persisted | ≤30m; auto-purged on `expiresAt` or browser close; no persistent identity |
| System notice text | operational broadcast — **explicitly not E2EE** | until cleared |

> **Anon users have no persistent identity:** an `anon_xxx` id lives only in `ked_room_codes`/`ked_room_members`/`ked_messages` + the browser's memory/`sessionStorage` for the tab lifetime. No `ked_users` row, no handle, no passphrase, no vault, no PBKDF2 verifier, no contact graph, no device record. Closing the tab discards `anonId` and local history; after `ttlMs` (≤30m) the relay shreds bodies and revokes codes. A new tab = a new `anon_xxx` with no link to the previous one.

### (d) PLATFORM LOGS (not controlled by us)
| Host | They log | Their policy |
| --- | --- | --- |
| Cloudflare | IP, timestamp, URL, TLS fingerprint, ASN | developers.cloudflare.com/foundation/privacy-and-terms |
| Vercel | IP, timestamp, path, region | vercel.com/legal/privacy-policy |
| Netlify | IP, timestamp, path | netlify.com/privacy |
| Own VPS | whatever your reverse proxy logs | you control it |

These logs contain **no message content** — they cannot, because content is encrypted before it leaves your
tab. They do show that a request occurred.

## No ads, no trackers, no third-party analytics

Zero third-party analytics. Zero ad networks. Zero social pixels. Zero remote scripts and zero remote fonts.
The production client makes **no outbound request other than to your own configured relay**. System fonts keep
rendering independent of any CDN.

## Your rights

| Right | How to exercise it | Result |
| --- | --- | --- |
| Access / export | Inspector → Hardening → *Encrypted export*, or `POST /api/ked/me/export` | your vault blob + every ciphertext row addressed to you; the operator cannot open it |
| Erasure | *Panic wipe*, or `POST /api/ked/me/delete` with `{"confirm":"DELETE"}` | crypto-shredding: bodies nulled, sessions revoked, public keys dropped, irreversible |
| Rectification | edit your profile in Inspector (it is vault-encrypted) | immediate |
| Objection / restriction / profiling | not applicable | there is no profiling, no ads, no automated decision-making |
| Revocation | `/admin` → Users → revoke device | sessions die immediately |

Retention detail per data type: see **DATA-RETENTION.md**. Threat model and residual risks: **THREAT-MODEL.md**.

## What is stored encrypted on your device vs. plaintext on the relay

- **Local device (encrypted at rest):** `localStorage` key `ked.vault.v1.<username>` holds `{n: "v1", c: "<iv>.<ciphertext>", salt: "16B random b64", at: timestamp}`. The `c` is `AES-256-GCM(vaultKey, JSON.stringify(VaultData), utf8(username))` where `vaultKey = PBKDF2(passphrase, salt, 750_000)` (`src/lib/client.ts`). `VaultData` includes your private keys (IK/SPK/OPK private halves), contacts, sessions, groups, history, ledger, settings. `sessionStorage` key `ked.resume.v1 = {username, token, key: b64(vaultKey)}` lives tab-only for fast resume and is cleared on tab close.
- **On the relay (plaintext but content-free):** only routing ciphertext `body = iv.ct`, public headers (ECDH keys, signatures), opaque `roomId`/`senderId`/`userId`, `size`/`createdAt`/`destroyedAt`, `code_hash` for invites/room-codes, and SHA-256 bearer hashes. The relay never sees the vault key, passphrase, or plaintext.
- **Clear cache / Wipe:** `localStorage.removeItem(ked.vault.v1.<username>)` + `sessionStorage.clear()` + server `store.purgeUser` (bodies nulled, sessions revoked). Next open requires the passphrase to re-derive the vault key; without it the stored envelope is noise.

## Auto-delete on browser close

When you close or reload the tab, `src/app/page.tsx` `beforeunload` handler runs: `sessionStorage.clear()` (kills `ked.resume.v1` and `ked.admin.env`), and ephemeral room histories (`ttl <= 30m`) are wiped locally (`client.data.history[roomId] = []`). The page also shows a faint `repeating-linear-gradient` watermark (`src/app/globals.css:.watermark`) and blurs content while unfocused (`secret` class) so the back/forward cache reveals no plaintext. **Next open requires the full passphrase** — there is no cookie-based auto-login.

## Free 30m rooms — Zero-Login Ephemeral Rooms & 30m Auto-Burn

Anonymous users create ephemeral rooms **without any login**: `POST /api/ked/rooms/code {anonId, maxUsers, ttlMs}` and `POST /api/ked/rooms/join {code, anonId}` accept an `anonId` (`anon_<12>`, client-generated in memory/session, never in `ked_users`) as fallback when no `Authorization: Bearer` is present (`src/app/api/ked/[...slug]/route.ts:278,303`). `send` (`route.ts:322`) and `sync` (`route.ts:778`) accept the same fallback. Closing the tab discards `anonId` and wipes local history for that room.

Rooms created via `POST /api/ked/rooms/code` carry `defaultTtl <= 30m` (server enforces `Math.min(ttl, 30*60_000)` in `src/app/api/ked/[...slug]/route.ts:285`). After that window:

- Server: `store.shredExpired()` (on every `GET /sync`) sets `body=NULL, destroyedAt=now` on expired rows; subsequent `sync` returns `destroyedAt` and no body.
- Client: `KedClient.burnDue()` runs every **700ms** (`src/lib/client.ts`) and locally zeroes `HistMsg` entries whose `expiresAt <= now`. The ledger records `message.burned`.

After 30m, history is dead on **both** sides — no admin can recover it, because the per-message key was already destroyed. **Anon users leave no persistent trace:** no `ked_users` row, only ephemeral `ked_room_codes`/`ked_room_members` with `anon_xxx` that expire with the room.

## Screenshot / download friction (not a guarantee)

Extreme-privacy mode adds friction, not prevention (OS screenshots cannot be blocked with 100% reliability):

- CSS: `.no-screenshot { user-select:none; -webkit-touch-callout:none }` + `.watermark { repeating-linear-gradient(-30deg) }` (`src/app/globals.css`).
- JS: `contextmenu` prevented, `copy` blocked outside inputs, `PrintScreen` / `Ctrl+P` / `Ctrl+Shift+S` intercepted with a toast (`src/app/page.tsx:181`), `blur`/`visibilitychange` applies `filter: blur(7px)` via `.secret`.
- Ledger: any shred or burn is logged as `msg.shredded` / `message.burned` (content-free).

We **do not** claim screenshots are impossible — a camera photo of the screen still works. The goal is friction + watermark trace + immediate blur-after-download, so casual drag-copy and print-to-PDF are deterred. Full threat analysis: `THREAT-MODEL.md` and `SECURITY-HEADERS.md` (CSP).

## Eligibility
Invite-only personal messenger. Not directed at children. Not for unlawful content — see `/terms`.

## Changes
Material changes are announced with an in-app **SYSTEM NOTICE** banner (the one thing on this relay that is
deliberately *not* end-to-end encrypted, so it reaches you before you decrypt anything). The "last updated"
date above always reflects the current version.

## Contact
`OPERATOR_EMAIL` in your deployment env. Security issues: follow **SECURITY.md** — do not post publicly.
