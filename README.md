# SHER ·MESSENGER — zero-knowledge encrypted messenger

**Free · open source · MIT licensed · self-hostable in one click.**

![License](https://img.shields.io/badge/license-MIT-4ff0b6?style=flat-square)
![No telemetry](https://img.shields.io/badge/telemetry-none-4ff0b6?style=flat-square)
![Zero-knowledge](https://img.shields.io/badge/relay-zero--knowledge-4ff0b6?style=flat-square)
![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-6aa6ff?style=flat-square)
![PRs welcome](https://img.shields.io/badge/PRs-welcome-6aa6ff?style=flat-square)

A personal, invite-only, end-to-end encrypted chat app — your own private messenger, from scratch — **with an admin panel**.
Real cryptography runs in your browser; the relay is a blind post-office that physically cannot read what it routes.

## One-click deploy

The app also ships an interactive **`/deploy` wizard**: paste your GitHub fork once and it generates real, provider-specific one-click links with no placeholder editing.

> Fork this repo first (button below), then click any target — each one deploys straight from your fork.
> Replace `YOUR_GH_USER/YOUR_REPO` in these links with your fork's path once it's on GitHub.

[![Fork on GitHub](https://img.shields.io/badge/1.%20Fork%20this%20repo-black?style=for-the-badge&logo=github)](https://github.com/new/import)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_GH_USER/YOUR_REPO&env=SHER_INVITE_ONLY&envDescription=Leave%20SHER_INVITE_ONLY%3D0%20for%20first%20boot%2C%20then%20set%20back%20to%201&project-name=sher-messenger&repository-name=sher-messenger)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/YOUR_GH_USER/YOUR_REPO)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/YOUR_GH_USER/YOUR_REPO)
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/YOUR_GH_USER/YOUR_REPO)
[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YOUR_GH_USER/YOUR_REPO)
[![Deploy on Deno](https://deno.com/button)](https://console.deno.com/new?clone=https://github.com/YOUR_GH_USER/YOUR_REPO)

| Badge | What it needs from you | Free tier |
| --- | --- | --- |
| **Vercel** | one env var: `DATABASE_URL` (Neon, `-pooler` string) | Hobby plan, generous |
| **Netlify** | `netlify.toml` is already committed — just add `DATABASE_URL` after import | 125k function calls/mo |
| **Render** | `render.yaml` blueprint is committed — pick a DB in the dashboard | 750 hrs/mo, sleeps after 15 min idle |
| **Railway** | `railway.json` is committed — add a Postgres plugin or `TURSO_URL` | usage-based free credits |
| **Cloudflare** | `wrangler.toml` + verified OpenNext bundle; memory zero-config, Turso for persistence | 100k req/day |
| **Deno Deploy** | GitHub import auto-detects Next; Turso over HTTP for persistence | 100k req/day-class |

No forced tracking, no telemetry phone-home, no vendor lock-in — every button above deploys the exact same
open-source code, and you can move between them at any time by changing one environment variable.

> ⚠️ **Not professionally audited.** Crypto is built from audited WebCrypto primitives only (no hand-rolled math),
> but the overall protocol has not had a third-party review. Read `SECURITY.md` before trusting it with anything serious.

```mermaid
flowchart LR
  A["Your tab<br/>vault key (PBKDF2 750k)"] -->|"X3DH-lite"| B["Double Ratchet<br/>per-message key"]
  B -->|"AES-256-GCM<br/>header = AAD"| C["sealed blob<br/>v1.iv.ciphertext"]
  C -->|TLS| D["Relay — BLIND<br/>routes ciphertext only"]
  D --> E[(Neon / Turso /<br/>D1 / SQLite / memory)]
  D --> F[(R2 / B2<br/>attachment blobs)]
  D -->|TLS| G["Peer tab<br/>decrypts, key destroyed"]
  style D fill:#1a1f2b,stroke:#4ff0b6
  style A fill:#0f1419,stroke:#6aa6ff
  style G fill:#0f1419,stroke:#6aa6ff
```

## Live documentation

| Route | What it is |
| --- | --- |
| `/` | the messenger |
| `/guide` | **how to use it + full deploy guide (Vercel / Netlify / Cloudflare / VPS-Docker)** |
| `/plan` | PRD, crypto spec, wire format, threat model, API reference |
| `/admin` | admin console (invites, users, broadcast, audit) — not publicly linked |
| `/privacy` | privacy policy (matches the *actual* data-flow, no false claims) |
| `/terms` | terms of use |
| `/api/health` `/api/ked/healthz` `/api/ked/readyz` `/api/ked/version` | ops probes |
| `/api/dev-selftest?relay=1` | 51-check conformance suite, live |

## Feature matrix

| Phase | Shipped |
| --- | --- |
| **P1 core** | invite-only signup · handle + passphrase identity (no phone/email) · E2EE 1:1 text · X3DH-lite + Double Ratchet · sent/sealed/read ticks · typing · reply · edit ("edited" state) · delete-for-everyone (relay shred) · reactions · day separators · offline outbox (IndexedDB) · safety number (60-digit) + verify flag · encrypted key export · panic wipe |
| **P1.5 admin** | `/admin` with RBAC · dashboard counters · user list with block/unblock/promote/purge · invite manager (hashed codes, use-limit, expiry, role) · SYSTEM broadcast (flagged "not E2EE") · content-free audit trail · health/ready/version probes |
| **P2 rich** | attachments (client-side AES-GCM, SHA-256 verified, ≤2 MB) · sender-key groups ≤32 with re-key · per-room + per-message TTL (30s → 30d) · local-only history search · PWA install · offline shell · blur-on-blur · clipboard auto-clear |
| **P3 later** | voice/video (LiveKit), multi-device QR link, stories, federation note |

## Quickstart

```bash
cp .env.example .env       # empty ⇒ volatile in-memory relay, perfect for a first look
npm ci
npx drizzle-kit push       # optional; the app also self-creates tables on first boot
npm run build && npm start
# open http://localhost:3000
```

### First admin + first invite

```bash
# 1. allow open bootstrap for 30 seconds and create your identity in the UI
SHER_INVITE_ONLY=0 npm start        # register your handle in the app, then Ctrl-C

# 2. mint an admin invite via the API using that account's token
curl -s localhost:3000/api/ked/admin/invites \
  -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"create":true,"role":"admin","maxUses":3,"expiresInDays":30,"label":"bootstrap"}'
# → {"ok":true,"code":"<32 hex chars>",...}   # shown ONCE, stored hashed

# 3. turn the gate back on and hand out https://your-host/?invite=<code>
SHER_INVITE_ONLY=1 npm start
```

## Deploy (one command each)

| Target | Command | Notes |
| --- | --- | --- |
| **Vercel** | `vercel --prod` | add `DATABASE_URL` (Neon). Use Neon's `-pooler` string. |
| **Netlify** | `netlify deploy --build --prod` | `netlify.toml` + Next runtime committed |
| **Cloudflare** | `npx opennextjs-cloudflare build && npx wrangler deploy` | OpenNext build + Wrangler dry-run verified; memory demo, Turso persistence |
| **Deno Deploy** | click the badge or import the GitHub fork | Next auto-detection + Turso over HTTP |
| **Render** | click the badge above, or `render blueprint launch` | `render.yaml` blueprint committed |
| **Railway** | click the badge above, or `railway up` | `railway.json` committed |
| **VPS / Docker** | `docker compose up -d --build` | `SHER_SQLITE_PATH=/data/sher-messenger.db` |

Full step-by-step with screenshots-level detail: **`/guide` §8–12**, or [`RUNBOOK.md`](./RUNBOOK.md).

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Crypto | WebCrypto: ECDH+ECDSA P-256, AES-256-GCM, HKDF-SHA-256, PBKDF2 750k | universally available, FIPS-validated implementations, zero bundled crypto code |
| Ratchet | X3DH-lite + Double Ratchet (own impl, spec-faithful) | forward secrecy + post-compromise security, auditable in the UI |
| Framework | Next.js 16 (App Router) + React 19 + TS strict | one codebase for static shell + relay routes |
| UI | Tailwind 4, hand-built components | no component library fetching remote JS |
| DB | Drizzle schema + 4 adapters (Postgres / libSQL / node:sqlite / memory) | swap by env var, no client change |
| Storage | relay-blob today, R2/B2 adapter interface for attachments | ciphertext only, never a filename |
| Realtime | cursor polling (1.6s) + SSE-ready adapter shape | works on every free tier; WS notes in ARCHITECTURE.md |

## Repository map

```
src/lib/primitives.ts    WebCrypto core (base64, HKDF, AEAD, KDF, fingerprints)
src/lib/protocol.ts      X3DH-lite, Double Ratchet, sender-key groups, attachments
src/lib/client.ts        vault, sessions, sync loop, outbox, ledger
src/lib/outbox.ts        IndexedDB offline queue (ciphertext only)
src/lib/sentry.ts        second real identity for a live self-test
src/server/store.ts      one Store interface, 4 backends
src/app/api/ked/[slug]   the relay router (never-HTML guarantee)
src/app/(admin|guide|plan|privacy|terms)  UI surfaces
docs/                    ARCHITECTURE · THREAT-MODEL · RUNBOOK · RETENTION · INCIDENT
```

## Docs pack

[README](./README.md) · [ARCHITECTURE](./ARCHITECTURE.md) · [THREAT-MODEL](./THREAT-MODEL.md) ·
[SECURITY](./SECURITY.md) · [PRIVACY](./PRIVACY_POLICY.md) · [TERMS](./TERMS.md) ·
[DATA-RETENTION](./DATA-RETENTION.md) · [INCIDENT-RESPONSE](./INCIDENT-RESPONSE.md) ·
[RUNBOOK](./RUNBOOK.md) · [SECURITY-HEADERS](./SECURITY-HEADERS.md) · [CONTRIBUTING](./CONTRIBUTING.md) ·
[CHANGELOG](./CHANGELOG.md) · [LICENSE](./LICENSE) · [.env.example](./.env.example)

## Reliability contract

Every `/api/ked/*` response is JSON — never an HTML error page — even if something throws deep inside a
handler. Prove it: `curl -s localhost:3000/api/ked/__crash-test` → HTTP 500 with a JSON body.

## Development

```bash
npm run lint && npx tsc --noEmit && npm run build
curl -s "localhost:3000/api/dev-selftest?relay=1" | jq '.passed, .total'
```

