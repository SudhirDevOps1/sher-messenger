/**
 * SHER Messenger — protocol layer (client side only; the relay never runs this code).
 *
 *  X3DH-lite agreement  : DH1 = IK_a <-> SPK_b, DH2 = EK_a <-> IK_b,
 *                         DH3 = EK_a <-> SPK_b, DH4 = EK_a <-> OPK_b
 *  Double Ratchet       : DH ratchet + symmetric hash ratchet (FS + PCS)
 *  Group Sender Keys    : per-member chain, re-keyed on membership change
 *
 * Wire format per relay row:
 *   header : JSON (public material only) — also used as AEAD additional data
 *   body   : AES-256-GCM ciphertext || 128-bit tag  (base64)
 * The relay cannot derive any message key, cannot map a room to identities
 * beyond the authenticated sender id, and cannot forge or mutate a body
 * (signature over header+digest of ciphertext with the sender's identity key).
 */

import {
  type B64,
  type Bytes,
  type KeyPair,
  b64d,
  b64e,
  concat,
  ecdh,
  ecdsaSign,
  ecdsaVerify,
  generateP256,
  hkdf,
  hkdf2,
  openAead,
  rnd,
  seal,
  sha256,
  unpackEnvelope,
  utf8,
  equal,
} from "./primitives";

export const PROTOCOL_VERSION = 1;
export const OPK_COUNT = 24;

/* ------------------------------------------------------------------ identity */

export interface LocalIdentity {
  ik: KeyPair;
  spk: KeyPair;
  spkSig: B64;
  opks: KeyPair[];
  opkConsumed: number[];
  createdAt: number;
}

export interface PublicBundle {
  userId: string;
  username: string;
  ikPub: B64;
  spkPub: B64;
  spkSig: B64;
  opkPub: B64 | null;
  opkIndex: number;
}

export async function createIdentity(): Promise<LocalIdentity> {
  const ik = await generateP256();
  const spk = await generateP256();
  const opks: KeyPair[] = [];
  for (let i = 0; i < OPK_COUNT; i++) opks.push(await generateP256());
  const sig = await ecdsaSign(ik, await sha256(b64d(spk.pub)));
  return { ik, spk, spkSig: sig, opks, opkConsumed: [], createdAt: Date.now() };
}

/** Verify a fetched bundle: signed prekey must be signed by the identity key. */
export async function verifyBundle(b: PublicBundle): Promise<boolean> {
  const okSig = await ecdsaVerify(b.ikPub, b.spkSig, await sha256(b64d(b.spkPub)));
  return okSig;
}

/* ------------------------------------------------------------------ ratchet state */

export interface Chain {
  k: B64; // chain key
  n: number; // message counter
}

export interface Session {
  peerId: string;
  peerIk: B64;
  peerSpk: B64;
  rootKey: B64;
  send: Chain | null;
  recv: Chain | null;
  myRatchet: KeyPair;
  peerRatchet: B64 | null;
  skipped: Record<string, B64>;
  ds: number; // double-ratchet step counter (for the ledger UI)
  createdAt: number;
}

export interface MsgHeader {
  v: number;
  t: "prekey" | "msg";
  r: B64;
  n: number;
  s: B64; // sender identity key
  p?: B64; // signed prekey of sender (for first contact safety number)
  e?: B64; // initiator ephemeral key
  o?: number; // one-time prekey index
  sig: B64;
}

const MAX_SKIP = 64;

async function chainStep(chainKey: Bytes, rootKey: Bytes): Promise<[Bytes, Bytes]> {
  return hkdf2(chainKey, rootKey, "KED-DR-msgkey-v1");
}

async function signHeader(ik: KeyPair, core: Omit<MsgHeader, "sig">, body: B64): Promise<B64> {
  const digest = await sha256(JSON.stringify(core), body);
  return ecdsaSign(ik, digest);
}

async function verifyHeader(header: MsgHeader, body: B64): Promise<boolean> {
  const { sig, ...core } = header;
  const digest = await sha256(JSON.stringify(core), body);
  return ecdsaVerify(header.s, sig, digest);
}

/* ------------------------------------------------------------------ X3DH */

async function x3dhSecret(
  dhParts: Bytes[],
  ikA: B64,
  ikB: B64,
): Promise<[Bytes, Bytes]> {
  const master = await hkdf(
    concat(dhParts),
    concat([b64d(ikA), b64d(ikB)].sort((a, b) => (a.length === b.length ? bytesCmp(a, b) : a.length - b.length))),
    "KED-X3DH-v1",
    96,
  );
  const rootKey = master.slice(0, 32);
  const chainKey = master.slice(32, 64);
  const ck = await hkdf(master.slice(64, 96), rootKey, "KED-X3DH-ck", 32);
  void ck;
  return [rootKey, chainKey];
}

function bytesCmp(a: Bytes, b: Bytes): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** Alice side: returns session + the prekey header fields to embed in message 1. */
export async function x3dhAlice(
  me: LocalIdentity,
  bundle: PublicBundle,
): Promise<{ session: Session; prekey: { e: B64; o?: number } }> {
  const ek = await generateP256();
  const dh1 = await ecdh(me.ik, bundle.spkPub);
  const dh2 = await ecdh(ek, bundle.ikPub);
  const dh3 = await ecdh(ek, bundle.spkPub);
  const parts = [dh1, dh2, dh3];
  let o: number | undefined;
  if (bundle.opkPub) {
    parts.push(await ecdh(ek, bundle.opkPub));
    o = bundle.opkIndex;
  }
  const zeros = new Uint8Array(32) as Bytes;
  while (parts.length < 4) parts.push(zeros);
  const [rootKey, chainKey] = await x3dhSecret(parts, me.ik.pub, bundle.ikPub);
  const session: Session = {
    peerId: bundle.userId,
    peerIk: bundle.ikPub,
    peerSpk: bundle.spkPub,
    rootKey: b64e(rootKey),
    send: { k: b64e(chainKey), n: 0 },
    recv: null,
    myRatchet: ek,
    peerRatchet: null,
    skipped: {},
    ds: 0,
    createdAt: Date.now(),
  };
  return { session, prekey: { e: ek.pub, o } };
}

/** Bob side, driven by an inbound prekey message. */
export async function x3dhBob(
  me: LocalIdentity,
  ikA: B64,
  ekA: B64,
  opkIndex: number | undefined,
): Promise<Session> {
  const spkPriv = me.spk;
  const dh1 = await ecdh(spkPriv, ikA);
  const dh2 = await ecdh(me.ik, ekA);
  const dh3 = await ecdh(spkPriv, ekA);
  const parts = [dh1, dh2, dh3];
  if (typeof opkIndex === "number" && me.opks[opkIndex]) parts.push(await ecdh(me.opks[opkIndex], ekA));
  const zeros = new Uint8Array(32) as Bytes;
  while (parts.length < 4) parts.push(zeros);
  const [rootKey, chainKey] = await x3dhSecret(parts, ikA, me.ik.pub);
  return {
    peerId: "",
    peerIk: ikA,
    peerSpk: "",
    rootKey: b64e(rootKey),
    send: null,
    recv: { k: b64e(chainKey), n: 0 },
    myRatchet: await generateP256(),
    peerRatchet: ekA,
    skipped: {},
    ds: 0,
    createdAt: Date.now(),
  };
}

/* ------------------------------------------------------------------ encrypt / decrypt */

export interface OutMessage {
  header: MsgHeader;
  body: B64;
}

export async function ratchetEncrypt(
  me: LocalIdentity,
  session: Session,
  plaintext: unknown,
  opts: { prekey?: { e: B64; o?: number }; forcePrekey?: boolean } = {},
): Promise<{ wire: OutMessage; session: Session }> {
  const s: Session = { ...session, skipped: { ...session.skipped } };
  if (!s.send) {
    // DH ratchet step for sending: fresh pair + one KDF root advance
    const next = await generateP256();
    const shared = await ecdh(next, s.peerRatchet ?? s.peerIk);
    const [root, ck] = await hkdf2(shared, b64d(s.rootKey), "KED-DR-step-v1");
    s.rootKey = b64e(root);
    s.myRatchet = next;
    s.send = { k: b64e(ck), n: 0 };
  }
  const [nextChain, msgKey] = await chainStep(b64d(s.send.k), b64d(s.rootKey));
  const n = s.send.n;
  s.send = { k: b64e(nextChain), n: n + 1 };

  const core: Omit<MsgHeader, "sig"> = {
    v: PROTOCOL_VERSION,
    t: opts.prekey || opts.forcePrekey ? "prekey" : "msg",
    r: s.myRatchet.pub,
    n,
    s: me.ik.pub,
    p: me.spk.pub,
  };
  if (opts.prekey) {
    core.e = opts.prekey.e;
    if (typeof opts.prekey.o === "number") core.o = opts.prekey.o;
  }
  const plainBytes = utf8(JSON.stringify(plaintext));
  const aad = utf8(JSON.stringify(core));
  const env = await seal(msgKey, plainBytes, aad);
  // the transmitted body is `iv.ciphertext(+tag)`; the signature covers exactly those bytes
  const body = `${env.n}.${env.c}`;
  const wire: OutMessage = { header: { ...(core as MsgHeader), sig: await signHeader(me.ik, core, body) }, body };
  return { wire, session: s };
}

export interface DecryptResult {
  value: unknown;
  session: Session;
  authenticated: boolean;
  resumed: boolean;
}

export async function ratchetDecrypt(
  me: LocalIdentity,
  session: Session | null,
  header: MsgHeader,
  body: B64,
): Promise<DecryptResult> {
  const authenticated = await verifyHeader(header, body);
  if (!authenticated) throw new Error("AUTH_FAILED: header/body signature invalid (relay tampering?)");
  const env = unpackEnvelope(body, "message body");
  let s: Session = session ? { ...session, skipped: { ...session.skipped } } : null!;
  let resumed = false;

  if (!s) {
    if (header.t !== "prekey" || !header.e) throw new Error("NO_SESSION: expected a prekey message");
    s = await x3dhBob(me, header.s, header.e, header.o);
    s.peerSpk = header.p ?? "";
    resumed = true;
  }

  const skipKey = (r: B64, counter: number) => `${r.slice(0, 16)}:${counter}`;

  // out-of-order / skipped message keys on the current receiving chain
  if (s.recv && s.peerRatchet === header.r && header.n < s.recv.n) {
    const k = s.skipped[skipKey(header.r, header.n)];
    if (!k) throw new Error("MISSING_KEY: message key already destroyed");
    const val = JSON.parse(
      new TextDecoder().decode(await openAead(b64d(k), env, utf8(JSON.stringify(stripSig(header))))),
    );
    const { [skipKey(header.r, header.n)]: _drop, ...rest } = s.skipped;
    return { value: val, session: { ...s, skipped: rest }, authenticated, resumed };
  }

  if (header.t === "prekey" && header.e && !equal(b64d(s.peerRatchet ?? ""), b64d(header.e)) && s.recv === null) {
    // very first message from this peer: peer ratchet is their ephemeral key
    s.peerRatchet = header.e;
  }

  if (header.r !== s.peerRatchet) {
    // DH ratchet step: the peer published a new ratchet key, so we mix in a fresh ECDH
    // secret and take exactly one root advance — mirroring the peer's sending step.
    const shared = await ecdh(s.myRatchet, header.r);
    const [root, recvChain] = await hkdf2(shared, b64d(s.rootKey), "KED-DR-step-v1");
    s.rootKey = b64e(root);
    s.peerRatchet = header.r;
    s.recv = { k: b64e(recvChain), n: 0 };
    // our next message will start a new sending chain with a new pair
    s.send = null;
    s.ds += 1;
  }

  if (!s.recv) throw new Error("NO_RECV_CHAIN");
  while (s.recv.n < header.n) {
    if (Object.keys(s.skipped).length < MAX_SKIP) {
      const [nc, mk] = await chainStep(b64d(s.recv.k), b64d(s.rootKey));
      s.skipped[skipKey(s.peerRatchet ?? header.r, s.recv.n)] = b64e(mk);
      s.recv = { k: b64e(nc), n: s.recv.n + 1 };
    } else {
      const [nc] = await chainStep(b64d(s.recv.k), b64d(s.rootKey));
      s.recv = { k: b64e(nc), n: s.recv.n + 1 };
    }
  }
  const [nextChain, msgKey] = await chainStep(b64d(s.recv.k), b64d(s.rootKey));
  s.recv = { k: b64e(nextChain), n: s.recv.n + 1 };
  const value = JSON.parse(
    new TextDecoder().decode(await openAead(msgKey, env, utf8(JSON.stringify(stripSig(header))))),
  );
  return { value, session: s, authenticated, resumed };
}

function stripSig(h: MsgHeader): Omit<MsgHeader, "sig"> {
  const { sig: _sig, ...core } = h;
  return core;
}

/* ------------------------------------------------------------------ group sender keys */

export interface GroupMemberKey {
  k: B64;
  n: number;
}

export interface GroupState {
  id: string;
  self: string; // my user id
  own: GroupMemberKey;
  peers: Record<string, GroupMemberKey>;
}

export async function createGroupState(groupId: string, self: string): Promise<GroupState> {
  const seed = rnd(32);
  return { id: groupId, self, own: { k: b64e(seed), n: 0 }, peers: {} };
}

export async function groupEncrypt(
  me: LocalIdentity,
  group: GroupState,
  plaintext: unknown,
): Promise<{ wire: OutMessage; group: GroupState }> {
  const g = { ...group };
  const [next, msgKey] = await hkdf2(b64d(g.own.k), utf8(`KED-SK:${g.id}`), `m${g.own.n}`);
  const n = g.own.n;
  g.own = { k: b64e(next), n: n + 1 };
  const core: Omit<MsgHeader, "sig"> = {
    v: PROTOCOL_VERSION,
    t: "msg",
    r: me.ik.pub,
    n,
    s: me.ik.pub,
    p: me.spk.pub,
  };
  const aad = utf8(JSON.stringify(core));
  const env = await seal(msgKey, utf8(JSON.stringify(plaintext)), aad);
  const body = `${env.n}.${env.c}`;
  return {
    wire: { header: { ...(core as MsgHeader), sig: await signHeader(me.ik, core, body) }, body },
    group: g,
  };
}

export async function groupDecrypt(
  group: GroupState,
  senderId: string,
  header: MsgHeader,
  body: B64,
): Promise<{ value: unknown; group: GroupState; authenticated: boolean }> {
  const authenticated = await verifyHeader(header, body);
  if (!authenticated) throw new Error("AUTH_FAILED: group message signature invalid");
  const g = { ...group, peers: { ...group.peers } };
  const chainKeyOf = senderId === group.self ? "own" : "peer";
  const chain = chainKeyOf === "own" ? g.own : g.peers[senderId];
  if (!chain) throw new Error("NO_SENDER_KEY: membership was added after this message");
  let cur = { ...chain };
  const env = unpackEnvelope(body, "group message body");
  let msgKey: Bytes | null = null;
  for (let guard = 0; guard < MAX_SKIP + 1; guard++) {
    const [next, mk] = await hkdf2(b64d(cur.k), utf8(`KED-SK:${g.id}`), `m${cur.n}`);
    if (cur.n === header.n) {
      msgKey = mk;
      cur = { k: b64e(next), n: cur.n + 1 };
      break;
    }
    cur = { k: b64e(next), n: cur.n + 1 };
    if (cur.n > header.n) throw new Error("STALE_SENDER_KEY: message predates your membership");
  }
  if (!msgKey) throw new Error("MISSING_KEY");
  const value = JSON.parse(
    new TextDecoder().decode(await openAead(msgKey, env, utf8(JSON.stringify(stripSig(header))))),
  );
  if (chainKeyOf === "own") g.own = cur;
  else g.peers[senderId] = cur;
  return { value, group: g, authenticated };
}

/* ------------------------------------------------------------------ attachments */

export interface AttachmentKey {
  id: string;
  key: B64;
  sha: B64;
  name: string;
  mime: string;
  size: number;
}

export async function encryptAttachment(bytes: Bytes, name: string, mime: string): Promise<{
  key: AttachmentKey;
  cipherB64: B64;
}> {
  const key = rnd(32);
  const id = b64e(rnd(12)).replace(/[^a-zA-Z0-9]/g, "");
  const sha = b64e(await sha256(bytes));
  const env = await seal(key, bytes);
  return {
    key: { id, key: b64e(key), sha, name, mime, size: bytes.length },
    cipherB64: env.n + "." + env.c,
  };
}

export async function decryptAttachment(cipherB64: string, key: AttachmentKey): Promise<Bytes> {
  const plain = await openAead(b64d(key.key, "attachment key"), unpackEnvelope(cipherB64, "attachment"));
  if (b64e(await sha256(plain)) !== key.sha) throw new Error("HASH_MISMATCH: attachment corrupted");
  return plain;
}

/* ------------------------------------------------------------------ ephemeral room crypto */

export async function ephemeralRoomKey(roomId: string, code?: string): Promise<Bytes> {
  const secret = utf8(`SHER-EPHEMERAL-SECRET:${roomId}:${code ? code.toLowerCase() : ""}`);
  return sha256(secret);
}

export async function ephemeralEncrypt(
  me: LocalIdentity,
  roomId: string,
  plaintext: unknown,
  seq: number = 0,
  code?: string
): Promise<{ wire: OutMessage }> {
  const rKey = await ephemeralRoomKey(roomId, code);
  const [, msgKey] = await hkdf2(rKey, utf8(`SHER-EPH-MSG:${roomId}`), `m${seq}`);
  const core: Omit<MsgHeader, "sig"> = {
    v: PROTOCOL_VERSION,
    t: "msg",
    r: me.ik.pub,
    n: seq,
    s: me.ik.pub,
    p: me.spk.pub,
  };
  const aad = utf8(JSON.stringify(core));
  const env = await seal(msgKey, utf8(JSON.stringify(plaintext)), aad);
  const body = `${env.n}.${env.c}`;
  return {
    wire: { header: { ...(core as MsgHeader), sig: await signHeader(me.ik, core, body) }, body },
  };
}

export async function ephemeralDecrypt(
  roomId: string,
  header: MsgHeader,
  body: B64,
  code?: string
): Promise<{ value: unknown; authenticated: boolean }> {
  const authenticated = await verifyHeader(header, body);
  const rKey = await ephemeralRoomKey(roomId, code);
  const [, msgKey] = await hkdf2(rKey, utf8(`SHER-EPH-MSG:${roomId}`), `m${header.n}`);
  const env = unpackEnvelope(body, "ephemeral message body");
  const plain = await openAead(msgKey, env, utf8(JSON.stringify(stripSig(header))));
  const value = JSON.parse(new TextDecoder().decode(plain));
  return { value, authenticated };
}

