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
});