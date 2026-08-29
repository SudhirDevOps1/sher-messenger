# SHER Messenger Mobile — reserved for Phase 4

This folder is deliberately present today so web architecture cannot silently grow dependencies that make a native shell impossible later.

## Binding contracts already defined

Pure interfaces live in `packages/crypto-core/src/adapters.ts`:

- `KeyStoreAdapter`: `get / set / delete / wipe`
- `PushAdapter`: wake-only payload `{ type: "wake" }`
- `PlatformAdapter`: native detection, safe URL open, biometric guard, deep-link parse

The current web implementation uses browser storage; the future native implementation will use Android Keystore / iOS Keychain through a secure-storage plugin. Crypto-core must never import DOM, Node, localStorage, IndexedDB, or a host SDK directly.

## Phase 4 plan

1. Initialize Capacitor in this folder and point `webDir` to the exported web bundle.
2. Implement `NativeKeyStoreAdapter` against secure Keystore/Keychain storage.
3. Implement `NativePushAdapter`; notification payload remains `{ "type": "wake" }` — no sender or content.
4. Android app link: `https://<host>/?invite=<token>`; custom fallback: `sher://invite/<token>`.
5. iOS remains web/PWA-first until a Mac and paid developer account are available. This is a cost constraint, not hidden.

`mobile-build.yml` is a safe stub today and becomes a real Gradle/signing workflow in Phase 4.
