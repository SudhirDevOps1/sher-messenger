# @sher/crypto-core

Reserved pure-TypeScript boundary shared by web and future native shells.

Rules:

1. No DOM, Node, localStorage, IndexedDB, filesystem, framework, or provider SDK imports.
2. All persistence arrives through `KeyStoreAdapter`.
3. All platform behaviour arrives through `PlatformAdapter` and `PushAdapter`.
4. Notifications are wake-only; the type system accepts only `{ type: "wake" }`.
5. Existing protocol code will move here incrementally without changing domain-separation strings, preserving old encrypted vaults.

The current source of truth remains `src/lib/primitives.ts` and `src/lib/protocol.ts`; this reserved package prevents architecture drift until that migration is released.
