# THREAT-MODEL

## Assets

| # | Asset | Where it lives | Impact if disclosed |
| --- | --- | --- | --- |
| A1 | Message plaintext | sender/receiver tab memory only | critical — conversation content |
| A2 | Vault key / private keys | tab memory + sessionStorage (tab-scoped) | critical — full history + impersonation |
| A3 | Passphrase | user's head / password manager | critical — derives A2 |
| A4 | Ciphertext blobs | relay DB, attachment store | low — computationally unreadable |
| A5 | Public keys | relay DB | none directly; enables MITM if unverified |
| A6 | Metadata (handle, room id, sizes, timing) | relay DB, provider logs | medium — relationship + traffic analysis |
| A7 | Safety number | both devices | low — but comparison is the MITM defence |

## Adversaries & mitigations

| Adversary | Reads A1? | Mitigations | Residual risk |
| --- | --- | --- | --- |
| **Curious server admin (me)** | **NO** | plaintext never sent; DB has only `body` = base64 `iv.ct`; no vault key derivable from the stored verifier (different salt + cost); admin panel has no message-read path at all | sees who-talks-to-whom, sizes, timestamps |
| **Compromised DB dump** | NO | message keys destroyed after use on both ends → dump cannot decrypt history; private keys absent | can replay rows (fails signature + counter checks), can count traffic |
| **Network observer / ISP** | NO | TLS + per-message keys; headers contain no metadata beyond routing | sees your IP and request timing |
| **MITM at key exchange** | attempted | SPK is signed by IK and verified client-side; 60-digit safety number; optional "require verified" hard mode | you skipping the out-of-band check (TOFU) |
| **Stolen unlocked device** | YES | sessionStorage key dies with the tab (`ked.resume.v1` cleared on `beforeunload`); vault is AES-GCM at rest (`ked.vault.v1.<username>` envelope); panic wipe; watermark + blur-on-background + CSP | a screenshot taken before the wipe; camera photo still possible |
| **XSS / hostile browser extension** | YES | strict CSP (default-src self, no object/embed, frame-ancestors none), no inline handlers, no remote scripts, no `dangerouslySetInnerHTML` on user text, `.no-screenshot` / watermark friction | an injected script in your own origin reads plaintext pre-encryption — no web app can fully prevent this |
| **Physical coercion** | — | panic wipe (local vault + session revocation + relay shred); no server-side key exists to surrender | deniability is limited: the account exists |
| **Traffic analysis** | — | fixed 1.6s polling; sizes padded to base64 blocks | volume/timing still visible; Tor/onion hosting is the fix |
| **Invite forgery / signup spam** | — | invite codes stored as SHA-256, single-use by default, expiry, admin-only minting, 6-strike lockout, per-route token buckets | operator must keep the invite list short |

## Screenshot / download friction (extreme privacy)

The app ships active friction to make casual copying harder — but **OS screenshots cannot be blocked with 100% reliability**. A camera photo of the screen always works; no web app can prevent that. What we *do* provide is deterrence + trace + blur-after-download:

| Layer | Implementation | Where |
| --- | --- | --- |
| CSS | `.no-screenshot { user-select:none; -webkit-touch-callout:none }`, `.no-screenshot * { -webkit-touch-callout:none }`, `.watermark { position:fixed; repeating-linear-gradient(-30deg, transparent 0 120px, rgba(255,255,255,.7) 120px 121px); opacity:0.04 }` | `src/app/globals.css:447` |
| JS — context menu / copy | `document.addEventListener("copy", prevent)` (allow inside INPUT/TEXTAREA only), `contextmenu` prevented | `src/app/page.tsx:174` |
| JS — key intercept | `PrintScreen` or `Ctrl+P` or `Ctrl+Shift+S` → `preventDefault()` + toast "screenshot blocked — privacy first" | `src/app/page.tsx:181` |
| Blur while unfocused | `document.hidden || !document.hasFocus()` → `hidden` state → `secret` class (`filter: blur(7px) saturate(0.6)`) + banner "blurred while unfocused" | `src/app/page.tsx:124`, `globals.css:.secret` |
| Ledger flag | `integrity.violation` / `message.burned` entries record shred/burn events content-free | `src/lib/client.ts:514`, server `store.shredExpired` |
| Auto-delete on close | `beforeunload` clears `sessionStorage` (`ked.resume.v1`) + ephemeral `history` | `src/app/page.tsx:156` |

**Limits:** OS print-screen, hardware screen grab, VM capture, or external camera bypass the JS intercept. We therefore emphasize **friction, watermark traceability, and immediate auto-burn** over a false "screenshot-proof" claim.

## What this is NOT (read before trusting it)

1. **Not anonymity.** E2EE ≠ anonymity. The relay knows an account exists and when it is active. Use Tor/onion hosting for network anonymity.
2. **Not screenshot-proof.** No client can prevent a photo of the screen. Blur-on-blur + watermark + copy-block are deterrence + trace, not a control. Treat them as friction that raises the cost of casual copying, not as a guarantee (see section above).
3. **Not audited.** Primitives are WebCrypto (audited implementations), but this protocol composition has had no third-party review.
4. **Not metadata-private.** Sealed sender is a roadmap item; today the relay needs `sender_id` for the 403 membership check — a common trade-off among metadata-minimal designs, and one some anonymity-first designs remove entirely.
5. **Not a backup service.** There is no server-side plaintext and no recovery. Your encrypted export is your only backup.
6. **Not 30m-recoverable.** After the auto-burn window, ciphertext keys are gone on both sides; no admin, operator, or forensics can reconstitute the plaintext from the remaining tombstones.

## Verification you can run

```bash
# 1. does the DB contain plaintext?
psql "$DATABASE_URL" -c "SELECT body FROM ked_messages LIMIT 5;"     # base64 only
# 2. does a crash leak HTML?
curl -s -w '%{content_type}\n' localhost:3000/api/ked/__crash-test   # application/json
# 3. does the stored body ever equal the plaintext?
curl -s "localhost:3000/api/dev-selftest?relay=1" | jq '.checks[] | select(.name|contains("plaintext"))'
