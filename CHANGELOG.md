# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is SemVer.

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
