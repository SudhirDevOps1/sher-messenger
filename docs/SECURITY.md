# SECURITY POLICY

> **Status: NOT professionally audited.** This is honest, not modest. WebCrypto primitives are
> audited implementations; the *composition* (X3DH-lite variant, ratchet details, group sender keys)
> is my own implementation of published designs and has not had a third-party review. Treat it as a
> strong personal project, not as a fully audited production messenger.

## Supported versions

| Version | Supported |
| --- | --- |
| `main` (HEAD) | ✅ security fixes only, no SLA |
| tagged releases | latest tag only |
| anything older | ❌ upgrade |

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

1. Email the address in `OPERATOR_EMAIL` (or the contact in `.env.example`).
2. Include: affected route/file, reproduction steps, and your assessment of impact.
3. You will get an acknowledgement within **72 hours** and a status update every 7 days until resolution.
4. Once fixed, you will be credited in `CHANGELOG.md` unless you prefer otherwise.

### Safe harbour

If you make a good-faith effort to avoid privacy violations, data destruction, and service degradation,
and you only test against accounts you own or have explicit permission to test, I will consider your
research authorised, will not pursue legal action, and will not invoke the Terms' abuse clause against you.

### Out of scope

* volumetric DoS / resource-exhaustion of a free-tier deployment
* social engineering of the operator or users
* physical access to an unlocked device
* missing security headers on third-party hosting pages that this project does not control
* reports from automated scanners without a working proof-of-concept

## Cryptographic parameters (pinned)

| Purpose | Algorithm | Size | Notes |
| --- | --- | --- | --- |
| Key agreement | ECDH P-256 (WebCrypto) | 256-bit | X25519 is the planned swap; P-256 chosen for universal WebCrypto support |
| Signatures | ECDSA P-256, SHA-256 | 256-bit | signs `SHA-256(header ‖ iv.ct)` |
| AEAD | AES-256-GCM | 256-bit key, 96-bit IV, 128-bit tag | header is AAD |
| KDF | HKDF-SHA-256 | 32/64-byte out | domain-separated info strings |
| Passphrase KDF | PBKDF2-SHA-256 | 750 000 (vault) / 210 000 (verifier) | Argon2id-via-WASM is the upgrade path |
| Fingerprint | SHA-256 | 40 hex | identity key |
| Safety number | SHA-256 → 60 digits | — | symmetric over both IK+SPK |
| Token storage | SHA-256 | 64 hex | bearer tokens never stored raw |

**No hand-rolled primitives.** Every operation above calls a browser/Node WebCrypto function.

## Public web, hidden admin (dual gate)

- **Web is public** — `GET /` needs no auth, so anyone can open the shell and check the build. No admin link is rendered in nav.
- **Admin is hidden + dual-gated** — every `/api/ked/admin/*` handler checks `isAdmin` bearer role (`src/app/api/ked/[...slug]/route.ts:522`), and the UI adds a first gate: `POST /api/ked/admin/env-auth` (`route.ts:464`) compares `ADMIN_EMAIL`/`ADMIN_PASSWORD` (or `SHER_ADMIN_*`) from env against the typed values with `timingSafe()`. Both `ADMIN_EMAIL` **and** `ADMIN_PASSWORD` must be set as encrypted Secrets (Cloudflare `wrangler secret put …`, Vercel Env Secrets, Render Secrets); without them the endpoint returns `500 admin env not configured`. The flag `ked.admin.env` lives only in `sessionStorage` and is cleared on tab close. Rate-limited via `admin-env` token bucket.

## Ephemeral rooms & screenshot friction

- **Room codes:** `POST /api/ked/rooms/code` / `consumeRoomCode` checks `maxUsers` (2-30) + `expiresAt` (≤30m) + `uses < maxUsers` + `members < maxUsers` before `joinRoom`. Codes are 6-char, stored as `SHA-256` only (`ked_room_codes` in `src/server/store.ts`).
- **30m auto-burn:** server `shredExpired()` nulls `body` on expiry; client `burnDue()` (700ms) zeroes local `HistMsg`. After the window, no admin or forensics can reconstitute plaintext.
- **Screenshot/download friction:** CSS `.no-screenshot` (`user-select:none`, `-webkit-touch-callout:none`), `.watermark` (`repeating-linear-gradient(-30deg)`), `contextmenu`/`copy` block, key intercept for `PrintScreen`/`Ctrl+P`/`Ctrl+Shift+S` with toast, blur while unfocused (`secret` class) — detailed in `THREAT-MODEL.md` and `PRIVACY_POLICY.md`. This is friction + watermark + blur-after-download, not a 100% guarantee (OS screenshot cannot be fully blocked).

## Hardening checklist (verified)

- [x] CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP, `X-Frame-Options` on every response (see `SECURITY-HEADERS.md` for the `no-screenshot` / watermark CSP notes)
- [x] HSTS (via `netlify.toml` / `public/_headers` / Caddyfile)
- [x] no `eval`, no `dangerouslySetInnerHTML` on user content, no remote scripts
- [x] per-route token buckets (`admin-env`, `rooms`, `register`, `login`, `send`, `sync`, `attach`, `shred`) + 6-strike 15-minute lockout
- [x] invite codes hashed at rest, single-use default, expiry, admin-only minting; room codes likewise hashed, 6-char, `maxUsers` capped
- [x] bearer tokens SHA-256 hashed at rest, 30-day expiry, per-device revocation
- [x] relay never returns HTML on error (`/api/ked/__crash-test` proves it)
- [x] secrets only via env; `.env` gitignored, `.env.example` has placeholders (`ADMIN_EMAIL`/`ADMIN_PASSWORD` documented)
- [x] WebSocket/realtime origin pinning documented for the WS adapter
- [x] `beforeunload` auto-delete: `sessionStorage.clear()` + ephemeral history wipe; `blur`/`secret` + watermark
- [x] local vault `ked.vault.v1.<username>` at rest = `AES-256-GCM(vaultKey, JSON.stringify(VaultData), utf8(username))` where `vaultKey = PBKDF2(passphrase, 16B random salt, 750k)` (`src/lib/client.ts`)
- [x] Zero-dependency AWS SigV4 storage adapter for Backblaze B2 / AWS S3 with automatic shredding
- [x] Automated 13-test cryptographic tamper resistance, AEAD validation, and memory zeroization test suite (`npm test`)
- [ ] TOTP second factor on `/admin` (roadmap)
- [ ] third-party audit (roadmap)
