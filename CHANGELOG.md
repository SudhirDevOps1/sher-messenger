# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is SemVer.

## [0.2.0](https://github.com/SudhirDevOps1/sher-messenger/compare/v0.1.0...v0.2.0) (2026-08-29)


### Features

* initial commit — sher-messenger zero-knowledge messenger ([51a9640](https://github.com/SudhirDevOps1/sher-messenger/commit/51a964092a704822d9c51308851ff7ff1d93730f))


### Bug Fixes

* add package-lock.json for CI (npm ci) ([168defc](https://github.com/SudhirDevOps1/sher-messenger/commit/168defcb5391f21b1ad6ba024d8e42d0c59043f8))
* **ci:** allow CC0-1.0 for speed-highlight (transitive) ([bab4c31](https://github.com/SudhirDevOps1/sher-messenger/commit/bab4c317217b8f0a02062bb36485167ad2922611))
* **ci:** allow LGPL-3.0 for @img/sharp-libvips (Next.js sharp transitive dep) ([d7fc20e](https://github.com/SudhirDevOps1/sher-messenger/commit/d7fc20e0cfe6e19d9da3aecf2229fe20a12698d3))
* **ci:** allow UNLICENSED and set package license MIT for root ([cb80ab3](https://github.com/SudhirDevOps1/sher-messenger/commit/cb80ab3e3ce47330710d66157847bf3a99011ea9))
* **ci:** make OSV scan non-blocking and bump postcss to 8.5.26 (fix GHSA-6g55/ qx2v) ([7247297](https://github.com/SudhirDevOps1/sher-messenger/commit/7247297efedfe73c98bd15024d71b333669c4e81))
* **lint:** disable react-hooks/purity for Date.now in render (pollAge, posture) ([c4cfb8f](https://github.com/SudhirDevOps1/sher-messenger/commit/c4cfb8f3001dc36e0cb1a46f5ffe27f7133a2390))
* **relay:** bootstrap self-disables after first mint and keep invite gate on in CI ([f90c95c](https://github.com/SudhirDevOps1/sher-messenger/commit/f90c95c0cfca9d876e0b98799204e716cecccf5e))
* **security:** add .gitleaks.toml allowlist for false positives (TURSO env names, crypto comments) ([6791a4f](https://github.com/SudhirDevOps1/sher-messenger/commit/6791a4f3f04d439cd1ef2eadf8ddaf27c6abd2c1))
* **security:** correct .gitleaks.toml syntax (allowlist is map not slice) ([ca46a6c](https://github.com/SudhirDevOps1/sher-messenger/commit/ca46a6c517ba0957a80f76cd8c1f0463a12f00c1))

## [Unreleased]

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
