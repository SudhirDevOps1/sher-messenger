/**
 * SHER Messenger — cryptographic core (runs in the browser via WebCrypto).
 *
 * Primitives (chosen for WebCrypto portability, see /plan for rationale):
 *  - Identity / signing : ECDSA P-256 (NIST curve, re-imported as ECDH for DH)
 *  - Key agreement      : ECDH P-256 -> 256-bit shared secret
 *  - KDF                : HKDF-SHA-256 (32/32 domain-separated splits)
 *  - AEAD               : AES-256-GCM, 96-bit random IV, AAD = message header
 *  - Auth material      : PBKDF2-SHA-256 (vault: 750k, server verifier: 210k)
 *
 * Protocol: X3DH-lite key agreement (IK + signed SPK + OPK pool) followed by a
 * full Double Ratchet (DH ratchet + symmetric hash ratchet) => forward secrecy
 * and post-compromise security. Group chats use per-sender chains (Sender Keys).
 */

export type Bytes = Uint8Array<ArrayBuffer>;
export type B64 = string;

const SUB: SubtleCrypto = globalThis.crypto.subtle;
const TE = new TextEncoder();
const TD = new TextDecoder();

/* ------------------------------------------------------------------ bytes */

export const utf8 = (s: string): Bytes => TE.encode(s);
export const fromUtf8 = (b: Bytes): string => TD.decode(b);

export function rnd(n: number): Bytes {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export function b64e(b: Bytes): B64 {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < b.length; i += chunk) {
    s += String.fromCharCode.apply(undefined, Array.from(b.subarray(i, i + chunk)));
  }
  return btoa(s);
}

export function b64urlEncode(b: Bytes): string {
  return b64e(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): Bytes {
  let standard = s.replace(/-/g, "+").replace(/_/g, "/");
  while (standard.length % 4) standard += "=";
  return b64d(standard);
}

export function zeroize(b: Uint8Array | ArrayBuffer | null | undefined): void {
  if (!b) return;
  if (b instanceof Uint8Array) {
    crypto.getRandomValues(b);
    b.fill(0);
  } else if (b instanceof ArrayBuffer) {
    const view = new Uint8Array(b);
    crypto.getRandomValues(view);
    view.fill(0);
  }
}

/** Strict-but-forgiving base64 test: standard or URL-safe alphabet, padding optional. */
export function isB64(s: unknown): boolean {
  if (typeof s !== "string" || s.length === 0) return false;
  const clean = s.trim().replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) return false;
  return (clean.length + (clean.length % 4 === 0 ? 0 : 4 - (clean.length % 4))) % 4 === 0;
}

/**
 * Decode base64 without ever surfacing a raw `atob` DOMException.
 * Accepts whitespace, URL-safe alphabet and missing padding, and throws a
 * labelled error otherwise so callers can report *which* field was malformed.
 */
export function b64d(s: B64, label = "value"): Bytes {
  const clean = String(s ?? "").trim().replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (clean === "") return new Uint8Array(0);
  const padded = clean.length % 4 === 0 ? clean : clean + "=".repeat(4 - (clean.length % 4));
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(padded))
    throw new Error(`BAD_BASE64: ${label} is not base64 (${clean.length} chars, starts "${clean.slice(0, 12)}")`);
  let bin: string;
  try {
    bin = atob(padded);
  } catch {
    throw new Error(`BAD_BASE64: ${label} could not be decoded (${clean.length} chars)`);
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function concat(parts: Bytes[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function hex(b: Bytes): string {
  let s = "";
  for (const x of b) s += x.toString(16).padStart(2, "0");
  return s;
}

export function equal(a: Bytes, b: Bytes): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function constantTimeEqualStr(a: string, b: string): boolean {
  return equal(utf8(a), utf8(b));
}

/* ------------------------------------------------------------------ hash / kdf */

export async function sha256(...parts: (Bytes | string)[]): Promise<Bytes> {
  const buf = concat(parts.map((p) => (typeof p === "string" ? utf8(p) : p)));
  return new Uint8Array(await SUB.digest("SHA-256", buf));
}

export async function hkdf(
  ikm: Bytes,
  salt: Bytes | string,
  info: string,
  len = 32,
): Promise<Bytes> {
  return new Uint8Array(
    await SUB.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: typeof salt === "string" ? utf8(salt) : salt, info: utf8(info) },
      await SUB.importKey("raw", ikm, "HKDF", false, ["deriveBits"]),
      len * 8,
    ),
  );
}

/** HKDF returning two independent 32-byte outputs (a KDF32-style split). */
export async function hkdf2(
  ikm: Bytes,
  salt: Bytes | string,
  info: string,
): Promise<[Bytes, Bytes]> {
  const both = await hkdf(ikm, salt, info, 64);
  return [both.slice(0, 32), both.slice(32, 64)];
}

/* ------------------------------------------------------------------ keys */

export interface KeyPair {
  /** base64 uncompressed SEC1 point (65 bytes) */
  pub: B64;
  /** exportable JWK private material, kept only inside the encrypted vault */
  priv: JsonWebKey;
}

export async function generateP256(): Promise<KeyPair> {
  const kp = (await SUB.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const raw = new Uint8Array(await SUB.exportKey("raw", kp.publicKey));
  const jwk = (await SUB.exportKey("jwk", kp.privateKey)) as JsonWebKey;
  return { pub: b64e(raw), priv: jwk };
}

function privJwk(kp: KeyPair): JsonWebKey {
  return { kty: "EC", crv: kp.priv.crv, x: kp.priv.x, y: kp.priv.y, d: kp.priv.d } as JsonWebKey;
}

export async function ecdsaSign(kp: KeyPair, data: Bytes): Promise<B64> {
  const key = await SUB.importKey("jwk", privJwk(kp), { name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign",
  ]);
  return b64e(new Uint8Array(await SUB.sign({ name: "ECDSA", hash: "SHA-256" }, key, data)));
}

export async function ecdsaVerify(pub: B64, sig: B64, data: Bytes): Promise<boolean> {
  try {
    const key = await SUB.importKey("raw", b64d(pub), { name: "ECDSA", namedCurve: "P-256" }, true, [
      "verify",
    ]);
    return await SUB.verify({ name: "ECDSA", hash: "SHA-256" }, key, b64d(sig), data);
  } catch {
    return false;
  }
}

async function dhPriv(kp: KeyPair): Promise<CryptoKey> {
  return SUB.importKey("jwk", privJwk(kp), { name: "ECDH", namedCurve: "P-256" }, false, [
    "deriveBits",
  ]);
}

async function dhPub(pub: B64): Promise<CryptoKey> {
  return SUB.importKey("raw", b64d(pub), { name: "ECDH", namedCurve: "P-256" }, true, []);
}

/** X = ECDH(myPriv, theirPub) -> 32 bytes */
export async function ecdh(kp: KeyPair, theirPub: B64): Promise<Bytes> {
  return new Uint8Array(
    await SUB.deriveBits({ name: "ECDH", public: await dhPub(theirPub) }, await dhPriv(kp), 256),
  );
}

/* ------------------------------------------------------------------ AEAD */

export interface Envelope {
  n: B64;
  c: B64;
}

export async function seal(key: Bytes, plain: Bytes, aad: Bytes | string = ""): Promise<Envelope> {
  const iv = rnd(12);
  const k = await SUB.importKey("raw", key, { name: "AES-GCM" }, false, ["encrypt"]);
  const p = new Uint8Array(
    await SUB.encrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: typeof aad === "string" ? utf8(aad) : aad,
        tagLength: 128,
      },
      k,
      plain,
    ),
  );
  return { n: b64e(iv), c: b64e(p) };
}

export async function openAead(key: Bytes, env: Envelope, aad: Bytes | string = ""): Promise<Bytes> {
  const k = await SUB.importKey("raw", key, { name: "AES-GCM" }, false, ["decrypt"]);
  const buf = await SUB.decrypt(
    { name: "AES-GCM", iv: b64d(env.n), additionalData: typeof aad === "string" ? utf8(aad) : aad, tagLength: 128 },
    k,
    b64d(env.c),
  );
  return new Uint8Array(buf);
}

export async function sealJson<T>(key: Bytes, obj: T, aad = ""): Promise<Envelope & { v: 1 }> {
  const env = await seal(key, utf8(JSON.stringify(obj)), aad);
  return { v: 1, ...env };
}

export async function openJson<T>(key: Bytes, env: Envelope, aad = ""): Promise<T> {
  return JSON.parse(fromUtf8(await openAead(key, env, aad))) as T;
}

/* ------------------------------------------------------------------ passwords / vault */

export async function pbkdf2(passphrase: string, salt: Bytes, iterations: number, len = 32): Promise<Bytes> {
  const base = await SUB.importKey("raw", utf8(passphrase.normalize("NFKD")), "PBKDF2", false, [
    "deriveBits",
  ]);
  return new Uint8Array(
    await SUB.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, base, len * 8),
  );
}

export const VAULT_ITERATIONS = 750_000;
export const VERIFIER_ITERATIONS = 210_000;

/**
 * Salts may arrive as random base64 (the per-account vault salt) or as a stable
 * human label such as `ked-auth-v1:<handle>` (the login verifier salt, which must
 * be reproducible on any device without a server round-trip). Labels are hashed
 * into 32 salt bytes instead of being fed to `atob`.
 */
export async function saltBytes(input: string): Promise<Bytes> {
  const s = String(input ?? "");
  if (isB64(s) && s.replace(/=+$/, "").length >= 16) return b64d(s, "salt");
  return sha256("KED-salt-v1", utf8(s));
}

export async function deriveVaultKey(passphrase: string, salt: string, iterations = VAULT_ITERATIONS) {
  const key = await pbkdf2(passphrase, await saltBytes(salt), iterations, 32);
  return {
    bytes: key,
    aes: await SUB.importKey("raw", key, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]),
  };
}

/** Verifier the server may store. Derived from a different salt AND a lower cost
 *  than the vault key, so the server can never recover the vault key from it. */
export async function deriveVerifier(passphrase: string, salt: string): Promise<B64> {
  return b64e(await pbkdf2(passphrase, await saltBytes(salt), VERIFIER_ITERATIONS, 32));
}

/* ------------------------------------------------------------------ envelope wire format */

/** Canonical transport form for an AEAD envelope: `v1.<iv>.<ciphertext+tag>`. */
export function packEnvelope(env: Envelope): string {
  return `v1.${env.n}.${env.c}`;
}

/**
 * Parse any envelope form this app has ever written:
 *   `v1.<n>.<c>`  (current)   ·  `<n>.<c>` (messages, attachments)
 *   `<n>|<c>`     (legacy relay vault mirror)  ·  `{"n":…,"c":…}` (local JSON)
 * Never throws a raw atob error — malformed input gets a labelled failure.
 */
export function unpackEnvelope(raw: string, label = "envelope"): Envelope {
  const s = String(raw ?? "").trim();
  if (!s) throw new Error(`BAD_ENVELOPE: ${label} is empty`);
  if (s.startsWith("{")) {
    try {
      const o = JSON.parse(s) as Partial<Envelope>;
      if (o && typeof o.n === "string" && typeof o.c === "string") return { n: o.n, c: o.c };
    } catch {
      /* fall through */
    }
  }
  const parts = s.includes("|") ? s.split("|") : s.split(".");
  const trimmed = parts[0] === "v1" ? parts.slice(1) : parts;
  if (trimmed.length !== 2 || !isB64(trimmed[0]) || !isB64(trimmed[1]))
    throw new Error(`BAD_ENVELOPE: ${label} is not a v1.iv.ciphertext envelope`);
  return { n: trimmed[0], c: trimmed[1] };
}

/* ------------------------------------------------------------------ human facing */

/** 8 groups of 5 base16 chars — long term identity fingerprint (64 hex). */
export async function fingerprint(...pubs: B64[]): Promise<string> {
  const h = hex(await sha256(...pubs.map((p) => b64d(p))));
  return h.slice(0, 40).match(/.{1,5}/g)!.join(" ");
}

/** 60-digit safety number over both identity + signed prekeys (sorted => symmetric). */
export async function safetyNumber(a: B64, aSpk: B64, b: B64, bSpk: B64): Promise<string> {
  const pairs = [a, aSpk, b, bSpk].sort();
  const h = await sha256(...pairs.map((p) => b64d(p)));
  let n = "";
  for (let i = 0; i < 30; i++) n += (h[i] % 10).toString();
  const digits = n.slice(0, 60).padEnd(60, "0");
  return digits.match(/.{1,5}/g)!.join(" ");
}

export function randomToken(bytes = 32): string {
  return hex(rnd(bytes));
}

/** Opaque deterministic id (used for 1:1 room ids so both sides agree without a lookup). */
export async function deriveRoomId(a: B64, b: B64): Promise<string> {
  const parts = [a, b].sort();
  return hex(await sha256(...parts.map((p) => b64d(p)))).slice(0, 40);
}
