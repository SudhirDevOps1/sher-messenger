# RUNBOOK

## Deploy targets

### Vercel
```bash
npm i -g vercel && vercel link
vercel env add DATABASE_URL          # Neon: use the -pooler connection string
vercel --prod
curl -s https://$APP.vercel.app/api/ked/readyz
```

### Netlify
```bash
npm i -g netlify-cli && netlify init
netlify env:set DATABASE_URL "postgres://…?sslmode=require"
netlify deploy --build --prod
```

### Cloudflare (Pages + Workers, Turso)
```bash
npm i -D @opennextjs/cloudflare wrangler
npx wrangler secret put TURSO_TOKEN
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put ADMIN_PASSWORD
# exact build/deploy expected by dashboard:
npx opennextjs-cloudflare build          # Build command in Cloudflare dashboard
npx wrangler deploy --env=""             # Deploy command (no env name)
# Version command in some UIs shows as:
echo "skip"                              # alternative if the UI labels the slot "Version" instead of "Deploy"
# or
npx wrangler deploy --env=""             # use this when the UI shows Build + Version (not Build + Deploy)
```

Cloudflare dashboard wiring (post-9c95ee7): **Build:** `npx opennextjs-cloudflare build` — **Deploy:** `npx wrangler deploy --env=""` — **Version:** `echo "skip"` *or* `npx wrangler deploy --env=""` depending on whether the UI exposes Build/Deploy or Build/Version. Secrets above are encrypted and never exposed to the web.

### Vercel / Netlify one-click (extreme privacy)

- **Vercel:** import fork → add `DATABASE_URL` (Neon `-pooler` string) → add Secrets `ADMIN_EMAIL` + `ADMIN_PASSWORD` in Environment Variables (mark Encrypted) → Deploy. `POST /api/ked/admin/env-auth` is then required before the admin token step.
- **Netlify:** import fork (`netlify.toml` committed) → add `DATABASE_URL` + `ADMIN_EMAIL`/`ADMIN_PASSWORD` in Site → Environment → Deploy. Same env gate applies.

### VPS / Docker
```bash
git clone <repo> sher-messenger && cd sher-messenger
cp .env.example .env                 # SHER_SQLITE_PATH=/data/sher-messenger.db
docker compose up -d --build
docker compose logs -f ked
```
TLS: put Caddy in front (`ked.example.com { reverse_proxy localhost:3000 }`) — it obtains certificates automatically.

## First-boot bootstrap

1. `SHER_INVITE_ONLY=0` → create your identity in the UI → stop.
2. Mint an admin invite: `POST /api/ked/admin/invites {"create":true,"role":"admin","maxUses":3}`.
3. Save the returned `code` (shown once) and set `SHER_INVITE_ONLY=1` on the next deploy.
4. Sign up a second identity with that invite → it is your admin; the first is a spare.
5. Configure `ADMIN_EMAIL` + `ADMIN_PASSWORD` as encrypted Secrets on the host (Cloudflare `wrangler secret put …`, Vercel/Netlify Env Secrets). Without both, `/admin` env gate returns `500`.
6. Open `/admin` → first enter `ADMIN_EMAIL`/`ADMIN_PASSWORD` (POST `/api/ked/admin/env-auth`, `src/app/api/ked/[...slug]/route.ts:464`) → then paste the admin bearer token → Overview and confirm counters are non-zero.

### Public web, hidden admin

- Web stays public; `/admin` nav link is absent. The panel is unindexed and requires *both* the env gate and the bearer token. The env flag `ked.admin.env` lives in `sessionStorage` and clears on tab close.
- To rotate admin secrets: update `ADMIN_EMAIL`/`ADMIN_PASSWORD` on the host and restart/redeploy; open tabs lose `sessionStorage` and must re-auth.

### Free 30m rooms — no login (anon ephemerals) · Ephemeral room codes (ops)

> **FREE without login (Zero-Login Ephemeral Mode):** regular users never need an account. `rooms/code`, `rooms/join`, `send`, `sync` all accept `anonId` fallback (`route.ts:278,303,322,778`). `anonId = anon_<12 hex>` is generated client-side in memory/`sessionStorage` only, never stored in `ked_users`. Only the admin panel requires `ADMIN_EMAIL`/`ADMIN_PASSWORD` + bearer.

- **Mint (no auth):** any **anon or auth** user may `POST /api/ked/rooms/code {anonId?, maxUsers:2-30, ttlMs:60_000-30*60_000}` — default `maxUsers=5`, `ttlMs=30m` (hard cap `30*60_000`). `userId = auth?.user.id ?? anonId ?? auto anon_xxx` (`route.ts:282`). Returns `{roomId, code, maxUsers, expiresAt}`. Stored as `ked_room_codes` with `code_hash = SHA-256(code)` and `created_by = anon_xxx` or `u_…` — no `ked_users` row for anon.
- **Join (no auth):** `POST /api/ked/rooms/join {code, anonId?}` → `consumeRoomCode(SHA(code), userId)` checks `revokedAt`, `expiresAt`, `uses < maxUsers`, `members < maxUsers` (`src/server/store.ts:consumeRoomCode`). Already-member is idempotent. `userId` may be `anon_xxx`.
- **Send/Sync (no auth for anon members):** `POST /api/ked/send {roomId, header, body, anonId?}` (`route.ts:322`) checks `isMember(roomId, userId)` where `userId` may be `anon_xxx`; `GET /api/ked/sync?cursor=…&anonId=…` (`route.ts:778`) streams via the same `anonId` fallback. Persistent DMs still need Bearer.
- **Burn:** rooms have `default_ttl <=30m`; server `shredExpired` (every `/sync`) nulls `body`; client `burnDue` (700ms) zeroes local history. After the TTL the room is tombstoned; admin may `deleteRoom` if needed (zeroes bodies, deletes membership, revokes codes). Anon rooms are purged after 30m or browser close with no `ked_users` trace.
- **Rate limits:** `rooms` bucket applies to `rooms/code`; `admin-env` bucket applies to `admin/env-auth`; `send`/`sync` buckets apply per `anon_xxx` as well.

## Health & monitoring

| Endpoint | Purpose |
| --- | --- |
| `GET /api/ked/healthz` | liveness (no DB touch) |
| `GET /api/ked/readyz` | readiness (exercises the store; `503` on degradation) |
| `GET /api/health` | platform probe: Postgres + selected adapter + counters |
| `GET /api/ked/version` | build hash, adapter set, `inviteOnly` flag — footer checks this |
| `POST /api/ked/admin/env-auth` | rate-limited env gate check (`admin-env` bucket) — expect `500` if `ADMIN_EMAIL`/`ADMIN_PASSWORD` not set |
| `POST /api/ked/rooms/code` / `rooms/join` | ephemeral room flows — expect `403` if `maxUsers`/`code` invalid or `expired`/`full` |
| `GET /api/dev-selftest?relay=1` | crypto + relay conformance; **wire this into CI and a Gatus check** |

Suggested Gatus/Upptime check: `GET /api/ked/readyz`, expect `200` and `$.status == "ready"`, every 60s.

## Production verify (after every deploy)

Run this from your laptop against the live host:

```bash
HOST=https://your-host.example
# 1. ops probes
curl -fsS "$HOST/api/ked/healthz" | jq .
curl -fsS "$HOST/api/ked/readyz" | jq .
curl -fsS "$HOST/api/ked/version" | jq .build,.inviteOnly
# 2. relay is never-HTML
curl -sSI "$HOST/api/ked/__crash-test" | grep -i content-type  # must be application/json
curl -fsS "$HOST/api/ked/__crash-test" | jq .error             # 500 JSON, not HTML
# 3. admin env gate (expect 403 or 500, never 200 without valid env)
curl -fsS -X POST "$HOST/api/ked/admin/env-auth" -H "content-type: application/json" -d '{"email":"x","pass":"y"}' | jq .
# 4a. FREE anon room flow — no auth (must succeed without Bearer; proves route.ts:278 anonId fallback)
ANON="anon_$(head -c6 /dev/urandom | od -An -tx1 | tr -d ' \n' | cut -c1-12)"
CODE_JSON=$(curl -fsS -X POST "$HOST/api/ked/rooms/code" -H "content-type: application/json" -d "{\"anonId\":\"$ANON\",\"maxUsers\":5,\"ttlMs\":60000}")
echo "$CODE_JSON" | jq .  # expect {"ok":true,"roomId":"r_…","code":"…","maxUsers":5}
CODE=$(echo "$CODE_JSON" | jq -r .code)
ROOM=$(echo "$CODE_JSON" | jq -r .roomId)
# join as second anon (no auth)
ANON2="anon_$(head -c6 /dev/urandom | od -An -tx1 | tr -d ' \n' | cut -c1-12)"
curl -fsS -X POST "$HOST/api/ked/rooms/join" -H "content-type: application/json" -d "{\"code\":\"$CODE\",\"anonId\":\"$ANON2\"}" | jq .
# send + sync as anon (no bearer)
curl -fsS -X POST "$HOST/api/ked/send" -H "content-type: application/json" -d "{\"roomId\":\"$ROOM\",\"header\":\"{\\\"t\\\":1}\",\"body\":\"iv.ct\",\"anonId\":\"$ANON\"}" | jq .
curl -fsS "$HOST/api/ked/sync?cursor=0&anonId=$ANON" | jq '.items | length, .serverShredded'
# 4b. room codes with bearer (also still works — for persistent users)
# curl -H "authorization: Bearer $ADMIN_TOKEN" -d '{"maxUsers":5,"ttlMs":60000}' -H "content-type: application/json" "$HOST/api/ked/rooms/code" | jq .
# 5. headers (see SECURITY-HEADERS.md)
curl -sSI "$HOST" | tr -d '\r' | grep -Ei 'content-security-policy|strict-transport-security|x-content|referrer|permissions|cross-origin'
# 6. ciphertext-only (no plaintext in DB): cf. THREAT-MODEL verification
curl -fsS "$HOST/api/dev-selftest?relay=1" | jq '.allOk,.passed,.total'
```

For Cloudflare, confirm in the dashboard that **Build:** `npx opennextjs-cloudflare build` and **Deploy:** `npx wrangler deploy --env=""` (Version: `echo "skip"` or the deploy command, per UI) are set, and that `ADMIN_EMAIL`/`ADMIN_PASSWORD` + `TURSO_TOKEN` appear under Secrets (encrypted).

## Rollback

| Target | Command |
| --- | --- |
| Vercel | `vercel rollback <deployment-url>` (or Dashboard → Deployments → Promote previous) |
| Cloudflare | `wrangler rollback` (previous version) |
| Docker | `docker compose down && git checkout <last-good-tag> && docker compose up -d --build` |
| Netlify | Deploys → published deploy → "Restore this deploy" |

Rollback notes: schema changes are additive (`ADD COLUMN IF NOT EXISTS`), so an older app version runs
fine against a newer schema. Never ship a destructive migration in the same release as a code change.

## Backup

```bash
# Postgres (ciphertext + metadata only)
pg_dump --no-owner "$DATABASE_URL" | gzip > "ked-$(date -u +%F).sql.gz"

# SQLite
sqlite3 /data/sher-messenger.db ".backup /backups/sher-$(date -u +%F).db"

# ship to R2/B2
rclone copy /backups r2:ked-backups --transfers 4
```
Cron it (nightly). Add to crontab:
```
15 2 * * * cd /opt/ked && /opt/ked/scripts/backup.sh >> /var/log/ked-backup.log 2>&1
```

### Restore drill (do this quarterly, not just once)
```bash
psql "$RESTORE_URL" -f dump.sql                 # 1. restore into a scratch DB
DATABASE_URL="$RESTORE_URL" npm start           # 2. boot the app against it
curl -s localhost:3000/api/dev-selftest?relay=1 # 3. conformance must be allOk:true
# 4. log in with a real passphrase and confirm history decrypts  → PASS
# 5. destroy the scratch DB
```
Pass criteria: login works, a known conversation decrypts, `dev-selftest` reports `allOk:true`.
Record the date + result in `CHANGELOG.md`.

## Free-tier budget & database maintenance

| Resource | Free limit | This app's usage | Warn at |
| :--- | :--- | :--- | :--- |
| Relay requests (Vercel/CF) | 100k/day CF · ~1M/mo Vercel-Hobby | poll every 1.6s while a tab is open ≈ 2250 req/h/tab; idle tabs are the main cost | 80% |
| Neon storage | 0.5 GB | ciphertext + metadata; attachments are the growth risk | 400 MB |
| Turso | ~5 GB, 500M row reads/mo | same | 4 GB |
| CF D1 | 5 GB, 5M reads, 100k writes/day | one write per message | 80k writes |
| R2 | 10 GB, zero egress | attachment blobs (2 MB cap each) | 8 GB |

### Neon / Postgres Storage Purge & Disk Reclaim (0 MB Reset)

To immediately purge stale data and reclaim disk space on Neon Serverless Postgres (resetting usage near 0 MB), run this in the Neon SQL Editor or via `psql`:

```sql
-- 1. Purge all message bodies & attachment blobs
DELETE FROM ked_messages;
DELETE FROM ked_attachments;

-- 2. Purge ephemeral rooms, room codes, and temporary memberships
DELETE FROM ked_room_members;
DELETE FROM ked_room_codes;
DELETE FROM ked_rooms;

-- 3. Purge expired sessions, rate limit buckets & audit logs
DELETE FROM ked_auth_sessions;
DELETE FROM ked_rate;
DELETE FROM ked_audit;

-- 4. Immediately reclaim allocated disk space on Postgres / Neon
VACUUM FULL;
```

**Single-command terminal execution via `psql`:**
```bash
psql "$DATABASE_URL" -c "DELETE FROM ked_messages; DELETE FROM ked_attachments; DELETE FROM ked_room_members; DELETE FROM ked_room_codes; DELETE FROM ked_rooms; DELETE FROM ked_auth_sessions; DELETE FROM ked_rate; DELETE FROM ked_audit; VACUUM FULL;"
```

**Levers when approaching a limit:** run `VACUUM FULL;` in Neon, raise the poll interval (`setInterval` in `client.ts`), raise
`SHER_INVITE_ONLY` discipline (fewer tabs), shorten default TTLs (smaller `body` inventory), move attachments
to R2, enable `SHER_MAINTENANCE=1` to shed load gracefully.

## Maintenance mode

Set `SHER_MAINTENANCE=1` → relay returns `503` JSON on every route (client keeps the outbox and shows the
offline banner), while `/healthz` still answers so monitoring does not page you.

## On-call checklist

- [ ] `/api/ked/readyz` returns `status:"ready"`
- [ ] `dev-selftest?relay=1` → `allOk:true`
- [ ] `/admin` Overview loads and counters are non-zero
- [ ] no `integrity.violation` entries in the last 24h
- [ ] DB storage under 80% of tier limit
- [ ] last backup younger than 26h, and the last restore drill is < 90 days old
