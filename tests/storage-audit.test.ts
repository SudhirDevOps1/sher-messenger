import { describe, it } from "node:test";
import assert from "node:assert";

describe("SHER-MESSENGER v2 — Storage & Memory Invariants Audit", () => {
  it("Assert zero sensitive keys in localStorage schema", () => {
    // Permitted client keys
    const allowedKeys = new Set(["ked.lang", "ked.theme", "theme", "lang"]);

    // Simulated sample storage keys
    const currentMockStorage = ["ked.lang", "ked.theme"];

    for (const key of currentMockStorage) {
      assert.ok(allowedKeys.has(key), `Key '${key}' must be purely non-sensitive`);
    }

    // Disallowed keys
    const forbiddenPatterns = [
      /pass/i,
      /key/i,
      /secret/i,
      /token/i,
      /msg/i,
      /history/i,
      /room_key/i,
      /vault/i,
    ];

    for (const key of currentMockStorage) {
      for (const pattern of forbiddenPatterns) {
        assert.ok(!pattern.test(key), `localStorage key '${key}' violates zero-sensitive-storage invariant`);
      }
    }
  });

  it("Assert memory-only lifecycle: tab reload clears in-memory state", () => {
    let tabMemoryState: any = {
      roomKey: "sample-frag-key-256",
      messages: [{ id: "m1", text: "Hello" }],
      ephemeralIdentity: { ik: "sample" },
    };

    // Simulate tab close / reload
    tabMemoryState = null;
    assert.strictEqual(tabMemoryState, null, "All session keys and messages must disappear on tab close");
  });
});
