# INCIDENT RESPONSE PLAYBOOK

**Golden rule for this architecture:** because no plaintext or private key ever exists server-side, the
overwhelming majority of incidents are *containment + rotation* problems, not "we must read the logs to see
what they read" problems. We usually cannot know what was read — say so plainly in the notice.

## Severity ladder

| Sev | Trigger | Response time |
| --- | --- | --- |
| S1 | private key material exposed, or an auth bypass on `/admin` | immediate, all hands |
| S2 | plaintext-relevant bug in the crypto path (e.g. AAD not bound), or relay returns readable data | 4 hours |
| S3 | relay availability loss, rate-limit bypass, invite forgery | 24 hours |
| S4 | cosmetic / header misconfiguration without exposure | next release |

## 1 · Detect

* `/api/ked/healthz` + `/readyz` (Gatus/Upptime) — availability
* `integrity.violation` entries in a user's ledger — tampering signal, treat as S2
* spike in `auth.failed` audit rows — credential attack, S3
* `/api/dev-selftest?relay=1` returning `allOk:false` — **regression in the crypto path, S2**
* provider abuse email / unusual request volume

## 2 · Contain

```bash
# freeze all sessions immediately (does not touch user data)
#   → /admin → Users → block, per identity
# or globally: take the relay out of the load path
vercel rollback                      # Vercel
wrangler rollback                    # Cloudflare
docker compose down                  # VPS
# maintenance mode: set SHER_MAINTENANCE=1 and redeploy (app shows a banner, relay returns 503 JSON)
```

Never "just look at the data to see the damage": if ciphertext is intact, looking tells you nothing, and if
it is not intact you are contaminating evidence. Snapshot first, act second.

## 3 · Eradicate & rotate

| What leaked | Action |
| --- | --- |
| Bearer tokens | revoke all sessions (`/admin` per user, or `POST /api/ked/logout` per account); tokens are SHA-256 hashed so a dump alone is not enough to reuse them |
| Invite codes | revoke the invite; codes are stored hashed, so rotate by revoking, not by "changing" them |
| Relay DB dump | **no key action needed** — bodies are unreadable without per-message keys that no longer exist. Still rotate: re-publish SPK/OPK pools, ask users to verify safety numbers |
| A user's device | that user: panic wipe → new identity → re-share new invite; contacts re-verify the new safety number |
| Operator secrets (`DATABASE_URL`, `TURSO_TOKEN`, VAPID) | rotate at the provider *first*, then redeploy; purge old env values from any build log |
| Suspected crypto bug | freeze the affected endpoint, publish a `SECURITY` notice, ship the fix, bump the protocol version in `/api/ked/version` |

## 4 · Notify (template)

```
SYSTEM NOTICE — [date]

What happened: <one sentence, no speculation>
What was exposed: <ciphertext only / metadata / nothing readable>
What was NOT exposed: message plaintext and your private keys were never stored on this
  server, so they were not part of this incident.
What we did: <contained, rotated, redeployed>
What you should do: <open Settings → Rotate bundle; re-verify safety numbers with your
  contacts; if you used a shared device, panic wipe>
Current status: <contained / monitoring>
```

Rules: never claim "no data was accessed" unless you have evidence; say "was not *stored*, therefore not
part of the incident". Never name affected users in a broadcast.

## 5 · Post-mortem

Within 7 days, written up and linked from `CHANGELOG.md`:

1. Timeline (detect → contain → resolve), in UTC.
2. Root cause, stated in one sentence a non-engineer can read.
3. Which invariant in `THREAT-MODEL.md` was strained, if any.
4. What changed in code (PR links) and in ops (new alert, new header, new rate limit).
5. What test now exists so this cannot regress silently (`/api/dev-selftest` addition where relevant).

## Contact tree

| Role | Who | Where |
| --- | --- | --- |
| Operator / incident commander | `OPERATOR_EMAIL` | `.env.example` |
| Hosting escalation | provider status page + support | Cloudflare / Vercel / Netlify |
| DB escalation | Neon / Turso dashboard | per `DB_TARGET` |
| Community notice channel | in-app SYSTEM NOTICE banner | `/admin` → Broadcast |
