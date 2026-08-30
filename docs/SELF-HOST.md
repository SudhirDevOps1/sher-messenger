# SHER-MESSENGER v2 — Complete Self-Hosting & Deployment Guide

**₹0 Free-Tier · Zero Telemetry · Production-Grade Ephemeral Architecture**

---

## 🧰 Cloud & Database Service Matrix

| Service | Role in SHER-MESSENGER v2 | Why Needed? | Free-Tier Limit |
| :--- | :--- | :--- | :--- |
| **Cloudflare Pages** | Static Web Frontend & UI Shell | Fast global CDN delivery with unlimited static requests. | Unlimited requests & bandwidth |
| **Cloudflare Workers** | Edge API Gateway & WebSocket Router | Routes WebSocket connections to rooms with low latency. | 100,000 requests/day · 10ms CPU |
| **Cloudflare Durable Objects** | In-Memory Ephemeral Room Engine | Rooms live 100% in DO volatile RAM with WebSocket hibernation. Auto-evicts on timer. | Free SQLite DO ~13k GB-s/day |
| **Cloudflare D1** | Ops Database (Settings & Policy Matrix) | Stores runtime admin policy, rate limits & blind logs (**NO CHAT CONTENT**). | 5 GB storage · 100k writes/day |
| **Backblaze B2 / R2** | Phase-2 Media & File Attachments | Private presigned-only encrypted media storage with auto-purge. | 10 GB free storage |
| **Neon / Turso / Supabase** | Alternative Ops Database | Alternative SQL adapters if not deploying on Cloudflare D1. | Generous free tiers |

---

## ⚡ Primary Deployment: Cloudflare Pages + Workers + Durable Objects (₹0 Forever)

### Step 1: Clone & Configure
```bash
git clone https://github.com/SudhirDevOps1/sher-messenger.git
cd sher-messenger
cp .env.example .env
npm ci
```

### Step 2: Create D1 Database & KV Namespace
```bash
# 1. Create D1 database for admin ops
npx wrangler d1 create sher-ops
# -> Note down database_id and paste into wrangler.toml

# 2. Create KV namespace for IP rate limiting
npx wrangler kv namespace create sher-rl
# -> Note down kv_namespace_id and paste into wrangler.toml
```

### Step 3: Generate Admin Password Hash
```bash
npx tsx scripts/hash-pw.ts "YourSuperSecretAdminPassword"
# -> Copy output hash and set as ADMIN_PASSWORD_HASH in Cloudflare Dashboard Secrets
```

### Step 4: Deploy
```bash
# Build and deploy worker with Durable Objects
npx opennextjs-cloudflare build
npx wrangler deploy
```

---

## 👑 Accessing the Masked Admin Portal

The admin console is masked at `/{ADMIN_PATH}` (default: `/sh3r-9x-admin`).
1. Navigate to: `https://your-domain.com/sh3r-9x-admin`
2. Enter your `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
3. Access real-time Policy Matrix controls, live active room monitors, and the emergency All-Burn kill-switch.

---

## 🛡️ Data Retention & Storage Guarantees

| Data Type | Storage Location | Lifetime | Purge Behavior |
| :--- | :--- | :--- | :--- |
| **Room Keys & Plaintext Messages** | RAM Only | Tab Lifetime | 💨 Destroyed immediately on tab close |
| **Server Room State** | Durable Object Memory | Room TTL (≤120m) | Evicted and memory zeroed on timer expiry |
| **Admin Policy & Blind Logs** | Cloudflare D1 | 30 days rolling | Automated sweep purges old blind logs |

---

## 🧹 Neon Serverless Postgres Storage Reset (0 MB Maintenance)

If self-hosting with Neon Postgres, run these SQL statements in the Neon Console SQL Editor to immediately purge stale records and reclaim allocated disk storage:

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
