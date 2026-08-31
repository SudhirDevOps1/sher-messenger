# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is SemVer.

## [0.2.0](https://github.com/SudhirDevOps1/sher-messenger/compare/v0.1.3...v0.2.0) (2026-08-31)


### Features

* add DuckDuckGo fire burn animation, persistent room link chat, feedback modal & analytics ([b73de9e](https://github.com/SudhirDevOps1/sher-messenger/commit/b73de9e7c72c63f58b7f4025951332b3110c6ae9))
* add PWA 1-click install, WebRTC audio/video calls, in-chat search, pinned messages, round video notes, and stealth calculator decoy mode ([b45d6e4](https://github.com/SudhirDevOps1/sher-messenger/commit/b45d6e42f5f356881c5e8727eecc81826ef49b73))
* **chat:** add encrypted voice notes recording, waveform player, floating emoji reactions, and media lightbox ([ff883e0](https://github.com/SudhirDevOps1/sher-messenger/commit/ff883e01d368832f4a6b98bc507858973e0eb726))
* complete SHER-MESSENGER v2 architecture, 1-click deploy, hardcore e2ee, and screenshot alerts ([f164f5c](https://github.com/SudhirDevOps1/sher-messenger/commit/f164f5c8ebdf6a02231a9a5ba0ce476184992728))
* complete UI space expansion, admin endpoints fix, zero-telemetry by default, and docs update ([8fc573f](https://github.com/SudhirDevOps1/sher-messenger/commit/8fc573faa481f67166ef95004b1ef7b0db841601))
* enhance deploy-setup with automatic wrangler D1/KV bindings injection and validation ([bc14ece](https://github.com/SudhirDevOps1/sher-messenger/commit/bc14ecee6eb5ea593d9ddf6f8a318d4cd37379b5))
* **i18n:** strictly eliminate all Hinglish with clean pure English and Hindi across UI, guide, and docs ([29efe77](https://github.com/SudhirDevOps1/sher-messenger/commit/29efe77b9013ba84e3a0dbac7cf7b5d6dc2d0d6b))
* place instant ephemeral chat directly in hero with clear UX, add quick switch on vault auth & full copyright notice ([25aed8f](https://github.com/SudhirDevOps1/sher-messenger/commit/25aed8f4b68591808e8e3186fe0132cf0b315892))
* **release:** v0.1.5 - E2EE group calls with live ringing, zero vulnerabilities, and hardened outbox ([3baaa47](https://github.com/SudhirDevOps1/sher-messenger/commit/3baaa47579a82fa10dfd91cefac88c64d8234ece))
* **security:** add automatic image EXIF metadata stripping, instant panic wipe button, and strict link protections ([da8f1c6](https://github.com/SudhirDevOps1/sher-messenger/commit/da8f1c6d7dd49b3f322741e5c95682a63af5d423))
* **ui:** add live GitHub stars badge, enhanced screenshot & screen snip alert banner, and anti-snoop privacy shield ([f26570c](https://github.com/SudhirDevOps1/sher-messenger/commit/f26570c663a534cce8e6eadd040a921767ef89d4))
* **ui:** complete mobile-first responsive redesign across all views and devices ([c734a24](https://github.com/SudhirDevOps1/sher-messenger/commit/c734a24e8e725cd73a3583efce0a2cf019a89820))
* **ui:** enable anti-snoop privacy shield by default with localStorage persistence ([c071987](https://github.com/SudhirDevOps1/sher-messenger/commit/c071987a6e7543efd0891fc2895f9dd24fac906e))
* zero-login 30m ephemeral rooms, pure English/Hindi i18n, direct admin portal & anti-screenshot protections ([76c2b75](https://github.com/SudhirDevOps1/sher-messenger/commit/76c2b7590a196350ae0632c380261bbfe6d04ce0))


### Bug Fixes

* **attachments:** resolve unauthorized error in guest rooms, add 5MB configurable limit and Backblaze B2 storage support ([831662e](https://github.com/SudhirDevOps1/sher-messenger/commit/831662e39355a67b1beb19eb6e6058e70753c0fe))
* **calling,attachments:** enable selective group call joining and fix PDF/file viewing and downloading ([0e5102a](https://github.com/SudhirDevOps1/sher-messenger/commit/0e5102a852abc56c57a81fc5fcb75bc959fd133c))
* **chat:** eliminate duplicate message bubbles on send and sync ([6aed6a5](https://github.com/SudhirDevOps1/sher-messenger/commit/6aed6a53b45367b6fa56b7b473b94d0820022a62))
* **ci:** patch CycloneDX SBOM flags and add server-level HSTS & CSP headers to next.config.ts ([88b0c67](https://github.com/SudhirDevOps1/sher-messenger/commit/88b0c67e866a2409deffca93cc284a94998c39da))
* **cloudflare:** preserve dashboard env across deploys, fix translation keys and CSP headers ([1622ce1](https://github.com/SudhirDevOps1/sher-messenger/commit/1622ce120c7a61a73846f5663e1e05a681147c05))
* **db:** add Neon HTTP fetch driver for edge/Cloudflare to eliminate connection timeout ([844cb50](https://github.com/SudhirDevOps1/sher-messenger/commit/844cb50e547672a27cce6f83186c0306aa89cec5))
* **db:** hard delete expired ephemeral rooms and filter active rooms and sessions in overview counts ([50dd4f0](https://github.com/SudhirDevOps1/sher-messenger/commit/50dd4f08e9711a3aac9433e2c9ab502d9feb0b5e))
* **db:** implement hard deletion & automatic disk vacuum to keep Neon storage under free limits ([99541a2](https://github.com/SudhirDevOps1/sher-messenger/commit/99541a23876f0eab61104b7ffa012aae743dd6e1))
* **landing:** auto-detect room code in input to join directly instead of creating duplicate rooms ([64a87b2](https://github.com/SudhirDevOps1/sher-messenger/commit/64a87b2038f969483c9c6a036b2337d3f475a40e))
* remove all hardcoded fallback URLs and ensure 100% env-driven endpoints ([d0f1051](https://github.com/SudhirDevOps1/sher-messenger/commit/d0f1051ae7c2bf1846c58b8e680be77a2e5c7c0c))
* resolve auto-burn infinite loop, enhance 3+ device group message key derivation, and optimize mobile responsive layout ([2df5fd8](https://github.com/SudhirDevOps1/sher-messenger/commit/2df5fd874cd8fb06243c65f8db617a3a95bfc760))
* **security:** sanitize dummy env placeholders and update gitleaks allowlist ([b84cc9e](https://github.com/SudhirDevOps1/sher-messenger/commit/b84cc9e1fa72ddf93b7ee946d634c40ca49c8715))
* **ui:** make 'Go to Chat Room' button accurately scroll to ephemeral room creator and focus input ([657242f](https://github.com/SudhirDevOps1/sher-messenger/commit/657242f9d4bb9ef551dd0ac2fdafa4cfec603b6f))

## [0.1.5] - 2026-08-31
### Added
- **Configurable 5 MB File & Media Attachments** — Expanded default attachment limits from 2 MB to 5 MB with manual environment variable configuration (`MAX_FILE_SIZE_MB` and `NEXT_PUBLIC_MAX_FILE_SIZE_MB`).
- **Zero-Dependency S3 / Backblaze B2 Storage Adapter** — Implemented zero-dependency AWS SigV4 storage module (`src/server/storage.ts`) supporting Backblaze B2, Cloudflare R2, and AWS S3 with automatic Postgres/SQLite zero-config fallback.
- **Guest Ephemeral Room Attachment Auth Fix** — Fixed `401 unauthorised` on attachment uploads in link-fragment (`#k=`) and ephemeral guest rooms by authorizing `anonId` against room membership.
- **In-Browser Encrypted Voice Notes** — In-browser audio recording via `MediaRecorder` with live pulse timer, animated soundwave visualizer, duration timer, and speed multiplier (`1x`, `1.5x`, `2x`).
- **Circular Front-Camera Round Video Notes** — Telegram/WhatsApp-style front-camera 15–30s circular video bubbles encrypted client-side with AES-256-GCM before upload.
- **P2P End-to-End Encrypted WebRTC Audio & Video Calling** — Direct browser-to-browser WebRTC voice and video calls with mute, camera toggle, and in-room encrypted signaling.
- **In-Chat Real-Time Memory Search** — Client-side in-memory search across active room messages with live match count and scroll-to-highlight, leaving zero traces on the server.
- **Pinned Messages System** — Ability to pin key messages to the top of any room with quick jump-to-message navigation.
- **Stealth Decoy Working Calculator Mode** — Emergency camouflage panic button converting the interface into a functional arithmetic calculator, unlocked exclusively with a secret PIN (`1337`).
- **1-Click PWA App Installation** — Header install button with `beforeinstallprompt` support for native Android/iPhone/Desktop app installation and offline shell caching.
- **Automated Security Penetration & Tamper Resistance Test Suite** — Comprehensive 13-test automated test suite (`tests/security-audit.test.ts`) validating AEAD tag verification, context isolation, replay rejection, rate limiting, and memory zeroization.

## [0.1.4] - 2026-08-30
### Added
- **Pure Bilingual Support (English / शुद्ध हिन्दी)** — Strictly eliminated all Romanized Hinglish strings across UI, guide, modals, and documentation in favor of pure, idiomatic English and Hindi translations.
- **Smart Room Code Auto-Detection** — Entering a 6-character room code (e.g. `cb34ce`) or pasting a direct link in the room creator automatically routes directly to joining that room instead of creating duplicate rooms.
- **Hardcore E2EE 256-bit Link Fragment Key** — Link fragment key (`#k=...`) never touches the relay server, providing out-of-band authenticated symmetric encryption with client-only zero-knowledge guarantees.
- **Hard Deletion & Auto-Vacuum Storage Optimization** — Expired ephemeral rooms, messages, tombstones, and sessions are immediately hard-deleted from Postgres/Neon to keep disk usage near 0 MB on free-tier limits.
- **Automatic EXIF Metadata Stripping** — Uploaded images are stripped of GPS coordinates, camera models, and timestamps in client memory prior to encryption.
- **Enhanced Privacy Shield & Panic Button** — Anti-snoop overlay, screenshot friction toast notifications, and 1-click instant panic purge (Esc key or 3 taps).
- **Admin Real-time Active Rooms Filtering** — Admin overview and room monitors now filter strictly active unexpired records and run background auto-shredding on overview refresh.
- **Public web + hidden admin** — web is public, `/admin` never linked. Dual gate: `POST /api/ked/admin/env-auth` (`src/app/api/ked/[...slug]/route.ts:464`) checks both `ADMIN_EMAIL` + `ADMIN_PASSWORD` (or `SHER_ADMIN_*`) from env (Cloudflare/Vercel Secrets) plus an admin invite bearer token for every `admin/*` route (`route.ts:522`). `src/app/admin/page.tsx` sessionStorage gate + `.env.example` docs.
- **Public room codes (ephemeral, 30m)** — `POST /api/ked/rooms/code` (`route.ts:278`) creates an ephemeral `group` room (`maxUsers` 2-30, `ttlMs` 60k-30*60k **hard cap 30*60_000**) and mints a 6-char code into `ked_room_codes` (`src/server/store.ts` `RoomCodeRow`, DDL for `ked_room_codes`, `SqlStore` + `MemoryStore`). `POST /api/ked/rooms/join` (`route.ts:307`) consumes the code with `maxUsers` + `expiresAt` + `revokedAt` checks via `consumeRoomCode`.
- **30m auto-burn ephemerals** — code-rooms carry `defaultTtl <=30m` (server enforces `Math.min`). `store.shredExpired()` (every `GET /sync`) nulls `body`, `KedClient.burnDue()` every **700ms** (`src/lib/client.ts`) zeroes local `HistMsg`. After 30m history is dead on both sides; ledger `message.burned` / `relay.shredded`.
- **Auto-delete on browser close** — `src/app/page.tsx` `beforeunload` clears `sessionStorage` (`ked.resume.v1` tab key + `ked.admin.env`) and ephemeral local history; `.watermark` + `.secret` blur while unfocused. Next open requires the full passphrase.
- **Screenshot / download friction** — CSS `.no-screenshot` (`user-select:none`, `-webkit-touch-callout:none`), `.watermark` (`repeating-linear-gradient(-30deg)`, `src/app/globals.css:447`), JS `contextmenu`/`copy` block, `PrintScreen`/`Ctrl+P`/`Ctrl+Shift+S` intercept with toast, blur while unfocused (`secret` class), ledger flag. Honesty: OS screenshot cannot be 100% blocked — only friction + watermark + blur-after-download.
- **Local vault at rest & Clear cache** — `localStorage` `ked.vault.v1.<username>` stores `{n,c,salt,at}` where `c = AES-256-GCM(vaultKey, JSON.stringify(VaultData), utf8(username))`, `vaultKey = PBKDF2(passphrase, 16B random salt, 750_000)` (`src/lib/client.ts:229`). Clarifies what is encrypted vs. plaintext on the relay (ciphertext + opaque ids only) and that Clear cache / Wipe does `ls.del` + `ss.clear()` + server `store.purgeUser` shred.
- **Production verify & easy deploy** — `RUNBOOK.md` #Cloudflare exact Build (`npx opennextjs-cloudflare build`) + Deploy (`npx wrangler deploy --env=""`) + Version (`echo "skip"` or deploy) wiring + Secrets setup, `README.md` deploy table, `CONTRIBUTING.md` smoke checks, `SECURITY-HEADERS.md` CSP notes for watermark.

### Docs
- `docs/README.md`, `docs/ARCHITECTURE.md` (ER model + data flow + key lifecycle), `docs/PRIVACY_POLICY.md`, `docs/THREAT-MODEL.md`, `docs/DATA-RETENTION.md`, `docs/SECURITY.md`, `docs/SECURITY-HEADERS.md`, `docs/RUNBOOK.md`, `docs/CONTRIBUTING.md` updated in place without removing existing content (see subsections above).

## [0.1.2] - 2026-08-30
### Fixed
- **Auth invite passthrough** — `src/app/page.tsx:197` now forwards `inviteCode` to `KedClient.register` (`src/lib/client.ts:335`), fixing UI `403 invite required` even when `?invite=` was detected (`src/components/Auth.tsx:73`).
- **Relay catch-all** — rename `src/app/api/ked/[slug]/route.ts` → `src/app/api/ked/[...slug]/route.ts` (`src/app/api/ked/[...slug]/route.ts:19`) so `invite/check`, `admin/*`, `me/*` stop 404ing with HTML on Workers; `bootstrap-invite` guard now uses `counts.invites` (`src/app/api/ked/[...slug]/route.ts:442`) to avoid Worker 1101.
- **Build config** — Cloudflare `Build: npx opennextjs-cloudflare build`, `Version: npx wrangler deploy --env=""` (was `versions upload` + missing build → `was not found`).

### Added

## [0.1.1] - 2026-08-29
### Fixed
- **Relay bootstrap** — `POST /api/ked/bootstrap-invite` now self-disables after first mint (`counts` + `listInvites` guard, `src/app/api/ked/[slug]/route.ts:440`), second call returns `409` even before first signup (fixes `bootstrap self-disables once an identity exists`).
- **Invite gate conformance** — CI keeps `SHER_INVITE_ONLY=1` and harness reads `GET /api/ked/version` `inviteOnly` to expect `403` (gated) or `200` (open), fixing `invite gate blocks signup without a code` when `SHER_INVITE_ONLY=0` (`.github/workflows/ci.yml:53`, `src/app/api/dev-selftest/route.ts:274`).

### Added
- **Admin console** (`/admin`, RBAC-gated server-side): dashboard counters, user list with
  block / unblock / promote / demote / purge, invite manager, SYSTEM broadcast, content-free audit trail.
- **Invite-only signup.** Codes are stored as SHA-256, single-use by default, with expiry and role
  (`member` / `admin`). Signup UI auto-detects `/?invite=…`; gate is controlled by `SHER_INVITE_ONLY`.
- **Offline outbox** (IndexedDB). Messages are sealed first, then queued if the relay is unreachable and
  flushed idempotently (ids fixed at enqueue time, so no duplicates). Red banner + "flush now".
- **PWA**: `manifest.webmanifest`, `icon.svg`, service worker that caches the shell but **never** `/api/*`.
  Installable on Android/iOS/desktop.
- **Never-HTML guarantee** on the relay: one `guarded()` wrapper means every `/api/ked/*` response is JSON
  even when a handler throws. Verified live via `/api/ked/__crash-test`.
- Ops probes: `/api/ked/healthz`, `/api/ked/readyz`, `/api/ked/version`, plus `/api/health` extension.
- **User rights endpoints**: `POST /api/ked/me/export` (ciphertext-only export) and
  `POST /api/ked/me/delete` (crypto-shred). Neither exposes content to the admin.
- System notices (`GET /api/ked/notice`) rendered in-app, flagged **"not E2EE"**.
- Docs pack: ARCHITECTURE, THREAT-MODEL, SECURITY, PRIVACY_POLICY (+ `/privacy`), TERMS (+ `/terms`),
  DATA-RETENTION, INCIDENT-RESPONSE, RUNBOOK, CHANGELOG, LICENSE, `.env.example`.
- New conformance checks (total **51**): crash-guard JSON contract, unknown-route JSON,
  human-label salt KDF, every envelope legacy form, relay-mirrored vault unlock on an empty device.

### Fixed
- `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` — relay no longer leaks an HTML error page;
  client also refuses to `JSON.parse` a non-JSON body and raises a readable error instead.
- `Failed to execute 'atob' on 'Window'` — salts that are human labels (e.g. `ked-auth-v1:<handle>`) are now
  hashed instead of base64-decoded; `b64d()` reports a labelled `BAD_BASE64:` error rather than a DOMException.
- Vault mirror written as `n|c` could not be unlocked on a device with empty local storage — replaced by a
  canonical `v1.<iv>.<ciphertext>` envelope that every legacy form still parses into.
- Double Ratchet used mismatched KDF labels on the two sides of a DH step, so the first reply failed to decrypt.
- Header signature covered only the ciphertext, not the IV — an observed relay could swap IVs. Now signs `iv ‖ ct`.
- Message-store insert used `$1` placeholders out of order on libSQL/SQLite, causing HTTP 500 on `send`.

## [0.1.0] — initial
### Added
- X3DH-lite key agreement, Double Ratchet (FS + PCS), sender-key groups, sealed attachments,
  60-digit safety numbers, TTL burn (client + relay), panic wipe, Inspector panel,
  4 storage adapters (Postgres / libSQL / node:sqlite / memory), `/plan` PRD.
