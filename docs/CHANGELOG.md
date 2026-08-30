# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is SemVer.

## [Unreleased]

### Added

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
