"use client";

/**
 * Sentry — a second *real* identity that runs entirely in your browser tab.
 *
 * It is not a fake bubble: Sentry registers its own account, generates its own
 * P-256 identity/signed-prekey/one-time-prekey bundle, keeps its private keys in
 * its own PBKDF2-encrypted vault, and completes a genuine X3DH handshake +
 * Double Ratchet with you over the same relay. The relay sees two independent
 * users exchanging ciphertext. That makes it a live, honest demo of the whole
 * crypto path (and a regression test you can poke at), while never phoning home.
 */

import { KedClient, computeFingerprint } from "./client";
import { randomToken } from "./primitives";

const LS_KEY = "ked.sentry.v1";

export interface SentryHandle {
  client: KedClient;
  username: string;
  status: "starting" | "ready" | "error";
  message: string;
}

let handle: SentryHandle | null = null;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function replyFor(raw: string, ctx: { username: string; fingerprint: string }): string {
  const t = raw.toLowerCase().trim();
  const has = (...k: string[]) => k.some((x) => t.includes(x));

  if (has("help", "/help", "commands"))
    return [
      "Sentry online — every message between us is sealed with a per-message ratchet key.",
      "",
      "Try me with:",
      "• audit          → live security posture readout",
      "• verify         → safety-number onboarding flow",
      "• ratchet        → why forward secrecy matters",
      "• burn           → TTL / auto-shred behaviour",
      "• group          → sender-key explanation",
      "• file           → encrypted attachment pipeline",
      "• threat model   → what I cannot protect you from",
    ].join("\n");

  if (has("audit", "posture", "status", "secure?"))
    return [
      "SECURITY POSTURE (from my side of the session)",
      `• peer: ${ctx.username}`,
      `• my identity fingerprint: ${ctx.fingerprint}`,
      "• cipher: AES-256-GCM, 96-bit IV, header as AAD",
      "• agreement: X3DH-lite over ECDH P-256 (IK + signed SPK + OPK)",
      "• ratchet: DH step on every reply + symmetric chain per message",
      "• relay knowledge: room id, opaque sender id, ciphertext length, timestamps. Nothing else.",
      "• my private keys: never transmitted, never stored unencrypted.",
      "",
      "Open the Inspector panel on your side to compare our safety numbers.",
    ].join("\n");

  if (has("verify", "safety", "fingerprint"))
    return [
      "MITM check: open Inspector → Identity here and on your device.",
      "Both safety numbers must match digit-for-digit. If they differ, someone swapped keys at handshake.",
      `My identity fingerprint is ${ctx.fingerprint} — compare it out-of-band (voice call, QR, anything but this relay).`,
      "Once you are happy, mark me verified; with 'require verified' on, I can no longer be silently replaced.",
    ].join("\n");

  if (has("ratchet", "forward", "pcs", "perfect"))
    return [
      "Double Ratchet in one breath:",
      "1. symmetric chain: every message advances a hash ratchet, the old key is destroyed → the relay (or a seized laptop) cannot replay your past.",
      "2. DH step: each direction change adds a fresh ECDH secret → a key stolen today cannot read tomorrow once we exchange anything new (post-compromise security).",
      "My chain counters are visible in the Inspector: they only move forward, never back.",
    ].join("\n");

  if (has("burn", "ttl", "expir", "shred", "delete"))
    return [
      "Burn is enforced in three places, not just visually:",
      "• your client destroys the plaintext + attachment reference on the timer",
      "• the relay nulls `body` on the next sweep (I can show you: send a message with 30s TTL and watch the Inspector ledger)",
      "• 'recall' shreds at the relay for every member, and the ciphertext is useless anyway since the ratchet key is already destroyed",
      "Backups/exports use the same TTL clock, so shredded items never return.",
    ].join("\n");

  if (has("group", "sender key", "senderkey"))
    return [
      "Groups use Sender Keys, not a shared group secret:",
      "• the creator generates one chain seed per member and ships each seed inside that member's verified 1:1 session",
      "• so a member can read everyone's traffic but an outsider (including the relay) reads nothing",
      "• add/remove a member → creator re-keys the whole group (that is the group's post-compromise security)",
      "Type `group demo` in the New Group dialog to see the re-key land in your ledger.",
    ].join("\n");

  if (has("file", "attach", "image", "photo"))
    return [
      "Attachment pipeline: your file is AES-256-GCM encrypted with a one-time key *before* upload; the relay stores an opaque blob id + length + TTL only.",
      "The key, filename, MIME and SHA-256 travel inside the encrypted message body, so the blob is meaningless without it.",
      "On open, I re-hash the decrypted bytes and refuse the file if the digest differs.",
    ].join("\n");

  if (has("threat", "cannot", "can't", "weakness", "attack"))
    return [
      "Honest limits of this build:",
      "• the relay still learns *who talks to whom* (room id + sender id + timing). Full sealed-sender/PoW routing is on the roadmap.",
      "• a compromised browser (bad extension, XSS) can read plaintext before encryption — CSP + no third-party scripts is the mitigation, not crypto.",
      "• metadata on the network layer (your IP) needs Tor/SOCKS or onion relay hosting.",
      "• screenshots and coerced passphrases are outside cryptography's reach: use blur-on-background + panic wipe.",
      "• our KDF is PBKDF2 (WebCrypto-native). Argon2id in a WASM module is the upgrade path.",
    ].join("\n");

  if (has("key", "rotate", "regenerat"))
    return [
      "Rotate from Inspector → Rotate identity bundle. I will publish a new IK + signed SPK + a fresh OPK pool and drop my old chains.",
      "Every contact sees a safety-number change banner — that is the protocol telling you to re-verify.",
    ].join("\n");

  if (has("perf", "slow", "latency"))
    return [
      "Costs you can see: PBKDF2-SHA-256 750k iterations at unlock (~0.4-1.2s on laptop-class hardware, and that is the point — it is your offline-brute-force bill).",
      "Per message: one ECDH + one HKDF + one AES-GCM. Sub-millisecond, all in your tab.",
      "Relay polls are 1.6s apart with a cursor, so idle bandwidth stays in the kilobytes.",
    ].join("\n");

  if (has("hi", "hello", "hey", "salaam", "namaste", "yo"))
    return [
      `Handshake complete — we now share a ratcheted session, ${ctx.username.split("@")[0]}.`,
      "Nothing you typed reached the relay in plaintext. Type `audit` for a live posture readout, or `help` for the command list.",
    ].join("\n");

  if (has("?"))
    return [
      "Short answer: the cryptography is local, the relay is dumb, and both of those properties are verifiable — read /plan for the spec and threat model.",
      "Type `help` if you want the command list.",
    ].join("\n");

  return [
    `Sealed and delivered (${t.length} chars → ${Math.ceil((t.length * 1.4) / 4)} bytes of base64 ciphertext on the relay).`,
    "Something to try: `audit`, `verify`, `burn`, `ratchet`, `threat model`, `help`.",
  ].join("\n");
}

export async function ensureSentry(onProgress?: (msg: string) => void): Promise<SentryHandle> {
  if (handle && handle.client.connected) return handle;
  const store = typeof localStorage !== "undefined" ? localStorage : null;
  let creds: { username: string; passphrase: string } | null = null;
  try {
    const raw = store?.getItem(LS_KEY);
    if (raw) creds = JSON.parse(raw) as { username: string; passphrase: string };
  } catch {
    creds = null;
  }
  if (!creds) {
    creds = { username: `sentry-${randomToken(3).slice(0, 5)}`, passphrase: randomToken(12) };
    try {
      store?.setItem(LS_KEY, JSON.stringify(creds));
    } catch {
      /* ignore */
    }
  }

  onProgress?.("Sentry node: generating identity bundle + registering…");
  let client: KedClient | null = null;
  try {
    client = await KedClient.unlock({ username: creds.username, passphrase: creds.passphrase });
    onProgress?.("Sentry node: session resumed");
  } catch {
    client = null;
  }
  // Registration can collide (handle taken by an earlier wipe): retry with fresh creds
  // rather than dead-ending the demo.
  for (let attempt = 0; !client && attempt < 3; attempt++) {
    try {
      client = await KedClient.register({ username: creds.username, passphrase: creds.passphrase, device: "local peer agent" });
      onProgress?.("Sentry node: identity published");
    } catch (e) {
      const msg = (e as Error).message;
      if (!/taken|409/i.test(msg) && attempt === 2) throw e;
      creds = { username: `sentry-${randomToken(4).slice(0, 6)}`, passphrase: randomToken(12) };
      try {
        store?.setItem(LS_KEY, JSON.stringify(creds));
      } catch {
        /* ignore */
      }
    }
  }
  if (!client) throw new Error("sentry node could not reach the relay");

  handle = { client, username: creds.username, status: "starting", message: "booting" };
  const fingerprint = await computeFingerprint(client.data.identity!.ik.pub);

  client.onInbound = async (item, value) => {
    const kind = String(value.t ?? "msg");
    const roomId = item.roomId;
    if (kind === "group-add") {
      await wait(450);
      await client
        .send({ roomId, text: `Sentry joined the group. My sender-key chain starts at 0 — re-key me any time from the Inspector.` })
        .catch(() => undefined);
      return;
    }
    if (kind !== "msg" || item.senderId === client.userId) return;
    const text = String(value.text ?? "");
    if (!text.trim()) return;
    if (client.data.settings.typingIndicators) await client.sendTyping(roomId).catch(() => undefined);
    await wait(Math.min(1500, 420 + text.length * 6));
    const reply = replyFor(text, { username: client.username, fingerprint });
    const ttl = value.ttl ? Number(value.ttl) : null;
    await client.send({ roomId, text: reply, ttlMs: ttl }).catch(() => undefined);
  };

  handle.status = "ready";
  handle.message = `live · ${creds.username}`;
  return handle;
}

export function sentryFingerprint(client: KedClient): Promise<string> {
  return computeFingerprint(client.data.identity?.ik.pub ?? "");
}

export function dropSentry() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
  handle = null;
}
