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

## Hardening checklist (verified)

- [x] CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP, `X-Frame-Options` on every response
- [x] HSTS (via `netlify.toml` / `public/_headers` / Caddyfile)
- [x] no `eval`, no `dangerouslySetInnerHTML` on user content, no remote scripts
- [x] per-route token buckets + 6-strike 15-minute lockout
- [x] invite codes hashed at rest, single-use default, expiry, admin-only minting
- [x] bearer tokens SHA-256 hashed at rest, 30-day expiry, per-device revocation
- [x] relay never returns HTML on error (`/api/ked/__crash-test` proves it)
- [x] secrets only via env; `.env` gitignored, `.env.example` has placeholders
- [x] WebSocket/realtime origin pinning documented for the WS adapter
- [ ] TOTP second factor on `/admin` (roadmap)
- [ ] third-party audit (roadmap)
