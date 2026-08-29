/**
 * Host-neutral contracts for SHER Messenger.
 *
 * IMPORTANT: this module is pure TypeScript. It intentionally imports no DOM,
 * Node.js, browser storage, framework, or platform SDK. Web and native shells
 * inject implementations, so crypto state never becomes coupled to a host.
 */

export interface KeyStoreAdapter {
  get(key: string): Promise<Uint8Array | null>;
  set(key: string, value: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
  wipe(): Promise<void>;
}

/** Push notifications carry no identity or content — they only wake the client. */
export type WakePayload = Readonly<{ type: "wake" }>;

export interface PushSubscriptionDescriptor {
  /** Opaque provider token. It must be encrypted before persistence. */
  token: string;
  platform: "web" | "android" | "ios";
}

export interface PushAdapter {
  supported(): Promise<boolean>;
  requestPermission(): Promise<"granted" | "denied" | "prompt">;
  subscribe(): Promise<PushSubscriptionDescriptor | null>;
  unsubscribe(): Promise<void>;
  onWake(handler: (payload: WakePayload) => void): () => void;
}

export interface ParsedDeepLink {
  kind: "invite" | "room" | "unknown";
  token?: string;
  roomId?: string;
}

export interface PlatformAdapter {
  isNative(): boolean;
  openUrl(url: string): Promise<void>;
  requireBiometricUnlock(reason: string): Promise<boolean>;
  parseDeepLink(url: string): ParsedDeepLink;
  appVersion(): Promise<string>;
}

/** Injected crypto facade: the core only needs standards-compatible WebCrypto. */
export interface CryptoRuntime {
  readonly subtle: SubtleCrypto;
  randomBytes(length: number): Uint8Array;
  now(): number;
}
