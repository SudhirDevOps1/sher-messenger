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

## Release

`release-please` reads conventional commits, opens a version PR, updates CHANGELOG, and creates the SemVer tag + GitHub Release after merge. Release provenance names the commit, adapter matrix, and audit status.
