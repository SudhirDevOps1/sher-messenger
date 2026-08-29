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
| Room id, sender id | routing + 403 enforcement | until account deletion |
| Byte size, `createdAt`, `destroyedAt` | ordering, TTL sweeps | until account deletion |
| Role (`member`/`admin`), blocked flag | RBAC, abuse control | until account deletion |
| SHA-256(bearer token), PBKDF2 verifier, device label, truncated IP hash | auth | 30 days or until revoked |
| Public keys (IK/SPK/OPK) | they are public by definition | until rotated or deleted |
| Audit rows (event class + opaque id, e.g. `msg.shredded`) | security visibility, **no content** | rolling 30 days |
| Invite `code_hash`, uses, expiry, role | invite-only signup | until revoked |
| System notice text | operational broadcast — **explicitly not E2EE** | until cleared |

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

## Eligibility
Invite-only personal messenger. Not directed at children. Not for unlawful content — see `/terms`.

## Changes
Material changes are announced with an in-app **SYSTEM NOTICE** banner (the one thing on this relay that is
deliberately *not* end-to-end encrypted, so it reaches you before you decrypt anything). The "last updated"
date above always reflects the current version.

## Contact
`OPERATOR_EMAIL` in your deployment env. Security issues: follow **SECURITY.md** — do not post publicly.
