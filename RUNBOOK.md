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
npx @opennextjs/cloudflare build && npx wrangler deploy
```

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
5. Open `/admin` → Overview and confirm counters are non-zero.

## Health & monitoring

| Endpoint | Purpose |
| --- | --- |
| `GET /api/ked/healthz` | liveness (no DB touch) |
| `GET /api/ked/readyz` | readiness (exercises the store; `503` on degradation) |
| `GET /api/health` | platform probe: Postgres + selected adapter + counters |
| `GET /api/ked/version` | build hash, adapter set, `inviteOnly` flag — footer checks this |
| `GET /api/dev-selftest?relay=1` | crypto + relay conformance; **wire this into CI and a Gatus check** |

Suggested Gatus/Upptime check: `GET /api/ked/readyz`, expect `200` and `$.status == "ready"`, every 60s.

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

## Free-tier budget

| Resource | Free limit | This app's usage | Warn at |
| --- | --- | --- | --- |
| Relay requests (Vercel/CF) | 100k/day CF · ~1M/mo Vercel-Hobby | poll every 1.6s while a tab is open ≈ 2250 req/h/tab; idle tabs are the main cost | 80% |
| Neon storage | 0.5 GB | ciphertext + metadata; attachments are the growth risk | 400 MB |
| Turso | ~5 GB, 500M row reads/mo | same | 4 GB |
| CF D1 | 5 GB, 5M reads, 100k writes/day | one write per message | 80k writes |
| R2 | 10 GB, zero egress | attachment blobs (2 MB cap each) | 8 GB |

**Levers when approaching a limit:** raise the poll interval (`setInterval` in `client.ts`), raise
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
