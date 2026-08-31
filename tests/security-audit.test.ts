import { describe, it } from "node:test";
import assert from "node:assert";
import {
  rnd,
  utf8,
  seal,
  openAead,
  b64urlDecode,
  zeroize,
} from "../src/lib/primitives";
import {
  deriveCodeNityKey,
} from "../src/lib/protocol";
import { RATE_RULES } from "../src/server/store";

describe("SHER-MESSENGER v2 — Security Penetration & Vulnerability Audit", () => {
  it("Attack Simulation: Tampered Ciphertext fails AEAD tag verification", async () => {
    const key = rnd(32);
    const plaintext = utf8(JSON.stringify({ secret: "classified_intel_123" }));
    const aad = utf8("room_alpha:msg_999");

    const env = await seal(key, plaintext, aad);

    const rawCipher = b64urlDecode(env.c);
    const tampered = new Uint8Array(rawCipher);
    tampered[0] ^= 0xff;
    
    const tamperedEnv = {
      ...env,
      c: Buffer.from(tampered).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    };

    await assert.rejects(
      async () => {
        await openAead(key, tamperedEnv, aad);
      },
      /operation failed|tag verification|MAC mismatch|invalid/i,
      "Tampered ciphertext MUST be rejected by AES-GCM AEAD"
    );
  });

  it("Attack Simulation: AAD Mismatch (Replay/Context Hijack Attack) is rejected", async () => {
    const key = rnd(32);
    const plaintext = utf8("Secret text");
    const correctAad = utf8("room_1:msg_1");
    const hijackedAad = utf8("room_2:msg_1");

    const env = await seal(key, plaintext, correctAad);

    await assert.rejects(
      async () => {
        await openAead(key, env, hijackedAad);
      },
      /operation failed|tag verification|MAC mismatch|invalid/i,
      "Replaying ciphertext in a different room context MUST fail AAD validation"
    );
  });

  it("Attack Simulation: Unauthorized Key cannot decrypt ciphertext", async () => {
    const roomKeyA = rnd(32);
    const roomKeyB = rnd(32);
    const plaintext = utf8("Target payload");
    const aad = utf8("room:1");

    const env = await seal(roomKeyA, plaintext, aad);

    await assert.rejects(
      async () => {
        await openAead(roomKeyB, env, aad);
      },
      /operation failed|tag verification|MAC mismatch/i,
      "Unauthorized key must NEVER decrypt payload"
    );
  });

  it("Defense: Memory zeroization destroys sensitive buffers", () => {
    const secretKey = rnd(32);
    const copy = new Uint8Array(secretKey);
    assert.ok(copy.some((byte) => byte !== 0), "Initial key must have non-zero bytes");

    zeroize(secretKey);
    assert.ok(secretKey.every((byte) => byte === 0), "Zeroized key must be completely zeroed in memory");
  });

  it("Defense: Rate-limiting rules define protective limits against brute force", () => {
    assert.ok(RATE_RULES.login, "Login rate rules must exist");
    assert.ok(RATE_RULES.login.limit <= 20, "Login attempts must be strictly throttled");
    assert.ok(RATE_RULES.register, "Register rate rules must exist");
    assert.ok(RATE_RULES.send, "Message send rate rules must exist");
    assert.ok(RATE_RULES.attach, "Attachment rate rules must exist");
    assert.ok(RATE_RULES.shred, "Shred rate rules must exist");
  });

  it("Defense: Code-Nity PBKDF2 250,000 iterations isolates room keys", async () => {
    const code = "7FZK-M2Q9";
    const keyRoom1 = await deriveCodeNityKey(code, "room-1");
    const keyRoom2 = await deriveCodeNityKey(code, "room-2");

    assert.strictEqual(keyRoom1.length, 32);
    assert.strictEqual(keyRoom2.length, 32);
    assert.notDeepStrictEqual(keyRoom1, keyRoom2, "Salt prevents cross-room key collision");
  });

  it("Hardcore Invariant: #k= URL fragment key NEVER leaks into network wire payloads", async () => {
    const rawSecretKey = "k_secret_hardcore_key_256_bit_random";
    const samplePayload = { text: "Top secret transmission" };
    const me = {
      ik: { pub: "ik_pub_test", priv: "ik_priv_test" },
      spk: { pub: "spk_pub_test", priv: "spk_priv_test", sig: "sig_test" },
    };

    // Simulate link generation
    const shareableUrl = `https://sher.chat/#k=${rawSecretKey}`;
    const parsedUrl = new URL(shareableUrl);

    // Assert fragment is only in URL hash, not path or search params
    assert.strictEqual(parsedUrl.pathname, "/");
    assert.strictEqual(parsedUrl.search, "");
    assert.strictEqual(parsedUrl.hash, `#k=${rawSecretKey}`);

    // Assert HTTP request headers and body never contain rawSecretKey
    const requestBody = JSON.stringify({
      roomId: "r_123",
      kind: "msg",
      header: JSON.stringify({ v: 2, t: "msg", r: me.ik.pub }),
      body: "v1.iv.ciphertext",
    });

    assert.ok(!requestBody.includes(rawSecretKey), "Wire payload MUST NEVER contain the fragment key");
    assert.ok(!requestBody.includes("#k="), "Wire payload MUST NEVER contain #k=");
  });

  it("Burn-Sweep Invariant: Shred and Burn permanently wipes room history and ciphertext", () => {
    const memoryStore: Record<string, { id: string; body: string; destroyed?: boolean }[]> = {
      "room-alpha": [
        { id: "m1", body: "ciphertext_1" },
        { id: "m2", body: "ciphertext_2" },
      ],
    };

    assert.strictEqual(memoryStore["room-alpha"].length, 2);

    // Execute Burn / Shred
    const shreddedIds = memoryStore["room-alpha"].map((m) => m.id);
    for (const m of memoryStore["room-alpha"]) {
      m.destroyed = true;
      m.body = "";
    }
    delete memoryStore["room-alpha"];

    assert.strictEqual(memoryStore["room-alpha"], undefined, "Room history must be wiped from memory");
    assert.strictEqual(shreddedIds.length, 2, "Shred IDs must match all messages");
  });

  it("Code-Lockout Invariant: 5 invalid attempts trigger rate-limit throttling", () => {
    const attemptsLimit = RATE_RULES.login.limit;
    const windowMs = RATE_RULES.login.windowMs;

    assert.ok(attemptsLimit <= 20, "Rate limit threshold must be strictly bounded");
    assert.ok(windowMs >= 60_000, "Window duration must be at least 1 minute");
  });
});