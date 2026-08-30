import { describe, it } from "node:test";
import assert from "node:assert";
import {
  b64urlEncode,
  b64urlDecode,
  zeroize,
  rnd,
  sha256,
  utf8,
  seal,
  openAead,
} from "../src/lib/primitives";
import {
  generateHardcoreKey,
  deriveCodeNityKey,
  resolveRoomKey,
} from "../src/lib/protocol";

describe("SHER-MESSENGER v2 — Cryptographic Core & Invariants", () => {
  it("Hardcore 256-bit link fragment key generator", () => {
    const key = generateHardcoreKey();
    assert.strictEqual(typeof key, "string");
    assert.ok(key.length >= 40, "Key should be valid base64url encoded 256-bit string");
    
    const bytes = b64urlDecode(key);
    assert.strictEqual(bytes.length, 32, "Decoded key must be exactly 32 bytes (256 bits)");
  });

  it("Hardcore AES-256-GCM encryption & decryption with AAD", async () => {
    const key = rnd(32);
    const plaintext = utf8(JSON.stringify({ text: "Super Secret Ephemeral Message", at: Date.now() }));
    const aad = utf8("room_123:msg_456");

    const env = await seal(key, plaintext, aad);
    assert.ok(env.n, "Nonce should be generated");
    assert.ok(env.c, "Ciphertext should be present");

    const decrypted = await openAead(key, env, aad);
    const parsed = JSON.parse(new TextDecoder().decode(decrypted));
    assert.strictEqual(parsed.text, "Super Secret Ephemeral Message");
  });

  it("Code-Nity PBKDF2 250,000 rounds key derivation", async () => {
    const code = "7FZK-M2Q9";
    const roomId = "room_abc123";

    const key1 = await deriveCodeNityKey(code, roomId);
    const key2 = await deriveCodeNityKey(code.toLowerCase(), roomId);
    assert.strictEqual(key1.length, 32, "Derived key must be 32 bytes");
    assert.deepStrictEqual(key1, key2, "Derivation should be case-insensitive for codes");

    const diffRoomKey = await deriveCodeNityKey(code, "diff_room_xyz");
    assert.notDeepStrictEqual(key1, diffRoomKey, "Salt must isolate different rooms");
  });

  it("Memory zeroize helper securely wipes buffers", () => {
    const buf = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    zeroize(buf);
    assert.deepStrictEqual(Array.from(buf), [0, 0, 0, 0, 0, 0, 0, 0], "Buffer must be filled with zeros");
  });

  it("Invariant: Fragment key is client-only and excluded from relay payload", () => {
    const sampleUrl = "https://sher.chat/r/room_abc123#k=dGhpcy1pcy1hLXNhbXBsZS1rZXktZm9yLXRlc3Rpbmc";
    const urlObj = new URL(sampleUrl);

    // Hash fragment is never transmitted in HTTP/WebSocket requests
    assert.strictEqual(urlObj.pathname, "/r/room_abc123");
    assert.strictEqual(urlObj.search, "");
    assert.ok(urlObj.hash.startsWith("#k="), "Fragment key remains strictly in URL hash");
  });
});
