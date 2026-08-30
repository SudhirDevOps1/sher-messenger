# Contributing to SHER Messenger

## Branch model

- `main`: protected production. No direct pushes.
- `staging`: protected preview environment. No direct pushes.
- `feat/*`, `fix/*`, `docs/*`, `chore/*`: short-lived branches.
- Open PR → CI/security gates → review → squash merge.

## Conventional commits / PR titles

Squash merge uses the PR title as the commit, so titles are enforced by `commitlint.yml`:

```
feat: add encrypted voice-note envelope
fix: keep ratchet state after an out-of-order message
docs: explain Turso edge setup
security: bind device id into message AAD
```

Allowed types: `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `revert`, `security`.

## Required local checks

```bash
npm ci
npx next typegen
npx tsc --noEmit --pretty false
npm run lint
npm run build
npm audit --omit=dev --audit-level=high
```

Then start the app with `SHER_RATE_LIMIT=off SHER_INVITE_ONLY=0 npm start` and run:

```bash
curl -fsS 'localhost:3000/api/dev-selftest?relay=1' | jq '.allOk'
# must print true
```

## Crypto changes

Any change to `src/lib/primitives.ts`, `src/lib/protocol.ts`, or protocol domain-separation strings requires:

1. a migration/compatibility note (old vaults must keep opening),
2. new conformance checks for both sides of the exchange,
3. five-message simulation including out-of-order delivery,
4. tamper-failure test,
5. review by someone other than the author.

Never invent a new primitive. Use standards-backed WebCrypto operations or a separately reviewed library.

## Production verify & easy deploy

- **One-click targets:** Vercel (`vercel --prod` + `DATABASE_URL` + `ADMIN_EMAIL`/`ADMIN_PASSWORD` Secrets), Netlify (`netlify deploy --build --prod` + same Secrets), Cloudflare (Build: `npx opennextjs-cloudflare build`, Deploy: `npx wrangler deploy --env=""`, Version: `echo "skip"` *or* `npx wrangler deploy --env=""` per UI — see `RUNBOOK.md` #Cloudflare), plus Render/Railway/Deno/Docker badges documented in `README.md` Deploy table.
- **Post-deploy smoke (do this before tagging):**
  ```bash
  HOST=https://your-host.example
  curl -fsS "$HOST/api/ked/readyz" | jq .status             # "ready"
  curl -sSI "$HOST/api/ked/__crash-test" | grep -qi json && echo ok  # never-HTML
  curl -fsS "$HOST/api/dev-selftest?relay=1" | jq .allOk    # true
  # admin env gate should reject bad creds
  curl -s -X POST "$HOST/api/ked/admin/env-auth" -H "content-type: application/json" -d '{"email":"a","pass":"b"}' | jq .
  ```
- **Env-gated admin test:** set `ADMIN_EMAIL` + `ADMIN_PASSWORD` as encrypted Secrets, POST valid creds to `/api/ked/admin/env-auth` → `{ok:true}`, then verify `GET /api/ked/admin/overview` without a bearer still 403.

## Release

`release-please` reads conventional commits, opens a version PR, updates CHANGELOG, and creates the SemVer tag + GitHub Release after merge. Release provenance names the commit, adapter matrix, and audit status.
