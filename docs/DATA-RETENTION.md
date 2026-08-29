# DATA RETENTION

| Data | Where | Default retention | Trigger for early deletion | Method |
| --- | --- | --- | --- | --- |
| Message ciphertext (`ked_messages.body`) | relay DB | until deleted | user delete-for-everyone, TTL burn, admin purge, account deletion | `body = NULL`, `destroyed_at = now` (**crypto-shredding**: the per-message key was destroyed at send time, so the row was already unreadable — the row itself becomes a tombstone) |
| Message tombstone (`seq`, `kind`, `size`, `created_at`) | relay DB | until account deletion | account deletion / admin purge | row kept for ordering, content gone |
| Attachment ciphertext | relay row (today) or R2/B2 | 7 days default, configurable per send (`ttlMs`) | TTL sweep on every `/sync` | blob emptied, `destroyed_at` set |
| Vault mirror (`vault_blob`) | `ked_users` | until overwritten or account deleted | panic wipe, account deletion | overwritten with `''` + salt blanked |
| Public key bundle (IK/SPK/OPK) | `ked_users` | until rotated or deleted | key rotation, purge | overwritten; OPK counter reset |
| One-time prekeys (consumed) | relay, in-use pointer | consumed immediately, never re-served | n/a | the *private* half never existed server-side |
| Auth sessions (`ked_auth_sessions`) | relay DB | 30 days | logout, device revoke, block, purge | `revoked_at` set; rows pruned on the 30-day boundary |
| Invites (`ked_invites`) | relay DB | until revoked or expiry | admin revoke | `revoked_at` set; only `code_hash` is stored, never the code |
| Audit log (`ked_audit`) | relay DB | **rolling 30 days** | age | event class + opaque id only; no content, no IPs |
| Rate buckets (`ked_rate`) | relay DB | window length (60s–10min) | window rollover | overwritten in place |
| System notices (`ked_notices`) | relay DB | until cleared | admin "clear notice" | `active = 0` |
| Local decrypted history | your browser `localStorage` | until panic wipe / browser clear | panic wipe, `Clear site data` | overwritten with empty vault |
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
