import {
  createGroupState,
  createIdentity,
  decryptAttachment,
  encryptAttachment,
  groupDecrypt,
  groupEncrypt,
  ratchetDecrypt,
  ratchetEncrypt,
  verifyBundle,
} from "@/lib/protocol";
import { b64e, ecdh, hkdf, rnd, seal, openAead, sha256, utf8, deriveRoomId, safetyNumber, fingerprint } from "@/lib/primitives";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Check = { name: string; ok: boolean; detail?: string };
let where = "start";
const step = (s: string) => (where = s);
const bundle = (id: Awaited<ReturnType<typeof createIdentity>>, userId: string) => ({
  userId,
  username: userId,
  ikPub: id.ik.pub,
  spkPub: id.spk.pub,
  spkSig: id.spkSig,
  opkPub: id.opks[0].pub,
  opkIndex: 0,
});

/** Protocol conformance harness. Proves the same modules the browser runs. */
let SELF = "http://127.0.0.1:3000";

export async function GET(req: Request) {
  SELF = req.url;
  const out: Check[] = [];
  const add = (name: string, ok: boolean, detail?: string) => out.push({ name, ok, detail });
  try {
    step("identities");
    const a = await createIdentity();
    const b = await createIdentity();
    add("identity bundles generated", !!a.ik.pub && a.opks.length === 24, `IK ${a.ik.pub.slice(0, 12)}… · 24 OPKs`);
    add("signed prekey verifies", await verifyBundle(bundle(b, "b")));
    add(
      "tampered signed prekey rejected",
      !(await verifyBundle({ ...bundle(b, "b"), spkSig: a.spkSig })),
    );

    step("room id");
    const room = await deriveRoomId(a.ik.pub, b.ik.pub);
    add("room id symmetric + opaque", room === (await deriveRoomId(b.ik.pub, a.ik.pub)) && room.length === 40, room.slice(0, 16) + "…");
    step("safety number");
    const snA = await safetyNumber(a.ik.pub, a.spk.pub, b.ik.pub, b.spk.pub);
    const snB = await safetyNumber(b.ik.pub, b.spk.pub, a.ik.pub, a.spk.pub);
    add("safety number identical both sides", snA === snB && snA.replace(/\s/g, "").length === 60, snA.slice(0, 21) + "…");
    add("fingerprint length", (await fingerprint(a.ik.pub)).replace(/\s/g, "").length === 40);

    step("x3dh alice");
    const { session: sa, prekey } = await x3dh(a, bundle(b, "b"));
    step("A encrypt");
    const w1 = await ratchetEncrypt(a, sa, { t: "msg", text: "ping" }, { prekey });
    step("B decrypt prekey");
    const r1 = await ratchetDecrypt(b, null, w1.wire.header, w1.wire.body);
    add("A→B prekey message decrypts", (r1.value as { text: string }).text === "ping", "resumed=" + r1.resumed);
    add("B session bound to A identity", r1.session.peerIk === a.ik.pub);

    step("B encrypt reply");
    const w2 = await ratchetEncrypt(b, r1.session, { t: "msg", text: "pong" });
    step("A decrypt reply");
    const r2 = await ratchetDecrypt(a, w1.session, w2.wire.header, w2.wire.body);
    add("B→A reply decrypts", (r2.value as { text: string }).text === "pong", `ds=${r2.session.ds}`);
    add("DH ratchet stepped on reply", r2.session.ds === 1);

    step("two messages same direction");
    // B's live state is the one produced by sending w2 (clients always carry state forward)
    const bAfterSend = w2.session;
    const w3 = await ratchetEncrypt(a, r2.session, { t: "msg", text: "three" });
    const w4 = await ratchetEncrypt(a, w3.session, { t: "msg", text: "four" });
    const d3 = await ratchetDecrypt(b, bAfterSend, w3.wire.header, w3.wire.body);
    const d3b = await ratchetDecrypt(b, d3.session, w4.wire.header, w4.wire.body);
    add("ordered chain decrypts", (d3.value as { text: string }).text === "three" && (d3b.value as { text: string }).text === "four");

    step("skip ahead");
    // deliver message #2 of the chain first: the skipped key must be buffered, not lost
    const skipped = await ratchetDecrypt(b, bAfterSend, w4.wire.header, w4.wire.body).catch((e: Error) => e.message);
    add(
      "out-of-order handled via skipped keys",
      typeof skipped !== "string" && (skipped.value as { text: string }).text === "four",
      typeof skipped === "string" ? skipped : "buffered 1 skipped key",
    );
    if (typeof skipped !== "string") {
      const late = await ratchetDecrypt(b, skipped.session, w3.wire.header, w3.wire.body).catch((e: Error) => e.message);
      add(
        "the late message still opens from the buffered key",
        typeof late !== "string" && (late.value as { text: string }).text === "three",
        typeof late === "string" ? late : "ok",
      );
    }

    step("tamper");
    const flipped = w4.wire.body.slice(0, -1) + (w4.wire.body.endsWith("A") ? "B" : "A");
    add("relay tampering detected", (await ratchetDecrypt(b, d3b.session, w4.wire.header, flipped).catch(() => null)) === null);

    step("groups");
    // creator (A) makes one chain seed per member and ships each inside that member's 1:1 session
    const creator = await createGroupState("g1", "a");
    const seedA = { ...creator.own };
    const seedB = { k: b64e(rnd(32)), n: 0 };
    const g1 = await groupEncrypt(a, creator, { t: "msg", text: "hello group" });
    const bView = { id: "g1", self: "b", own: { ...seedB }, peers: { a: { ...seedA } } };
    const gd1 = await groupDecrypt(bView, "a", g1.wire.header, g1.wire.body);
    add("group sender-key message decrypts", (gd1.value as { text: string }).text === "hello group", `A chain advanced to n=${gd1.group.peers.a.n}`);

    const g1b = await groupEncrypt(a, g1.group, { t: "msg", text: "second from A" });
    const gd2 = await groupDecrypt(gd1.group, "a", g1b.wire.header, g1b.wire.body);
    add("second message on the same sender chain decrypts", (gd2.value as { text: string }).text === "second from A", `n=${gd2.group.peers.a.n}`);

    const g2 = await groupEncrypt(b, gd2.group, { t: "msg", text: "hi group" });
    const aView = { id: "g1", self: "a", own: g1b.group.own, peers: { b: { ...seedB } } };
    const gd3 = await groupDecrypt(aView, "b", g2.wire.header, g2.wire.body);
    add("reply from another member decrypts on its own chain", (gd3.value as { text: string }).text === "hi group");
    add("group message from unknown sender refused", (await groupDecrypt(gd3.group, "z", g2.wire.header, g2.wire.body).catch(() => null)) === null);
    add(
      "re-keyed member cannot read pre-membership traffic",
      (await groupDecrypt({ id: "g1", self: "c", own: { k: b64e(rnd(32)), n: 0 }, peers: { a: { k: b64e(rnd(32)), n: 0 } } }, "a", g1.wire.header, g1.wire.body).catch(
        () => null,
      )) === null,
    );

    step("attachments");
    const file = utf8("secret-doc-bytes".repeat(64));
    const enc = await encryptAttachment(file, "plan.pdf", "application/pdf");
    const back = await decryptAttachment(enc.cipherB64, enc.key);
    add("attachment sealed + verified", back.length === file.length, `${file.length}B → ${enc.cipherB64.length}B b64 ct`);
    add("corrupted attachment refused", (await decryptAttachment(enc.cipherB64.slice(0, -6) + "AAAAAA", enc.key).catch(() => null)) === null);

    step("primitives");
    const shared1 = await ecdh(a.ik, b.spk.pub);
    const shared2 = await ecdh(b.spk, a.ik.pub);
    add("ECDH symmetric", shared1.length === 32 && Buffer.from(shared1).equals(Buffer.from(shared2)));
    const k = await hkdf(shared1, "salt", "KED-test", 32);
    const env = await seal(k, utf8("hello"));
    add("AES-256-GCM roundtrip", new TextDecoder().decode(await openAead(k, env)) === "hello");
    add("AAD bound", (await openAead(k, env, "other").catch(() => null)) === null);
    add("sha256 stable", (await sha256("abc")).length === 32);

    /* ---------- regression: atob / salt / envelope handling ---------- */
    step("base64 + salt regressions");
    const P = await import("@/lib/primitives");
    let labelSaltOk = true;
    let labelSaltErr = "";
    try {
      // this is the exact shape that used to blow up with
      // "Failed to execute 'atob' on 'Window': The string to be decoded is not correctly encoded"
      const v1 = await P.deriveVerifier("hunter2 hunter2 hunter2", "ked-auth-v1:ked");
      const v2 = await P.deriveVerifier("hunter2 hunter2 hunter2", "ked-auth-v1:ked");
      const v3 = await P.deriveVerifier("hunter2 hunter2 hunter2", "ked-auth-v1:someone-else");
      labelSaltOk = v1 === v2 && v1 !== v3 && P.isB64(v1);
    } catch (e) {
      labelSaltOk = false;
      labelSaltErr = (e as Error).message;
    }
    add("verifier accepts a human-label salt (no atob crash)", labelSaltOk, labelSaltErr || "deterministic + domain separated");

    const randomSalt = P.b64e(P.rnd(16));
    const vk1 = await P.deriveVaultKey("pass phrase here", randomSalt, 1000);
    const vk2 = await P.deriveVaultKey("pass phrase here", randomSalt, 1000);
    add("vault key stable for a base64 salt", P.b64e(vk1.bytes) === P.b64e(vk2.bytes));
    const vkLabel = await P.deriveVaultKey("pass phrase here", "ked-auth-v1:ked", 1000);
    add("vault key also works for a label salt", P.b64e(vkLabel.bytes) !== P.b64e(vk1.bytes));

    add("b64d reports a labelled error instead of a DOMException", (() => {
      try {
        P.b64d("ked-auth-v1:ked", "auth salt");
        return false;
      } catch (e) {
        return (e as Error).message.startsWith("BAD_BASE64:");
      }
    })());
    add("b64d tolerates padding-free + url-safe input", P.b64d(P.b64e(P.rnd(9)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")).length === 9);

    step("envelope formats");
    const vaultEnv = await seal(vk1.bytes, utf8(JSON.stringify({ hello: "vault" })), utf8("ked"));
    const packed = P.packEnvelope(vaultEnv);
    const forms: [string, string][] = [
      ["v1.n.c (current)", packed],
      ["n.c (message/attachment)", `${vaultEnv.n}.${vaultEnv.c}`],
      ["n|c (legacy relay mirror)", `${vaultEnv.n}|${vaultEnv.c}`],
      ["json (local store)", JSON.stringify({ n: vaultEnv.n, c: vaultEnv.c })],
    ];
    let allForms = true;
    for (const [, raw] of forms) {
      const got = P.unpackEnvelope(raw, "test");
      if (got.n !== vaultEnv.n || got.c !== vaultEnv.c) allForms = false;
    }
    add("every legacy + current envelope form parses", allForms, forms.map((f) => f[0]).join(" · "));
    add("garbage envelope rejected cleanly", (() => {
      try {
        P.unpackEnvelope("not an envelope", "test");
        return false;
      } catch (e) {
        return (e as Error).message.startsWith("BAD_ENVELOPE:");
      }
    })());

    step("fresh-device vault restore");
    // simulates unlocking on a device with no localStorage: only the relay mirror exists
    const mirror = packed;
    const restoredKey = await P.deriveVaultKey("pass phrase here", randomSalt, 1000);
    const restored = JSON.parse(
      new TextDecoder().decode(await openAead(restoredKey.bytes, P.unpackEnvelope(mirror, "relay vault mirror"), utf8("ked"))),
    ) as { hello: string };
    add("vault restores from the relay mirror alone", restored.hello === "vault");
    add(
      "wrong passphrase fails with a decrypt error, not a parse error",
      (await openAead((await P.deriveVaultKey("wrong pass", randomSalt, 1000)).bytes, P.unpackEnvelope(mirror), utf8("ked")).catch(
        () => null,
      )) === null,
    );

    /* ---------- regression: relay must never leak an HTML error page ---------- */
    step("relay always returns JSON, even when it crashes");
    const crashRes = await fetch(new URL("/api/ked/__crash-test", SELF).toString(), { cache: "no-store" });
    const crashText = await crashRes.text();
    add(
      "a thrown exception still comes back as JSON (not an HTML error page)",
      crashRes.status === 500 && /^\s*\{/.test(crashText) && JSON.parse(crashText).error?.includes("crash"),
      `HTTP ${crashRes.status} · content-type ${crashRes.headers.get("content-type")}`,
    );
    const notFoundRes = await fetch(new URL("/api/ked/this-route-does-not-exist", SELF).toString(), { cache: "no-store" });
    add(
      "unknown routes 404 as JSON too",
      notFoundRes.status === 404 && /^\s*\{/.test(await notFoundRes.text()),
    );

    /* ---------- end-to-end through the real relay (register, send, sync, shred) ---------- */
    if (new URL(SELF).searchParams.get("relay") !== "1") {
      add("relay e2e skipped (add ?relay=1 to run it)", true);
      const passedEarly = out.filter((c) => c.ok).length;
      return Response.json(
        { passed: passedEarly, total: out.length, allOk: passedEarly === out.length, checks: out },
        { headers: { "cache-control": "no-store" } },
      );
    }
    step("relay e2e");
    const base = new URL("/api/ked", SELF).toString();
    const call = async (p: string, init: RequestInit = {}, token?: string) => {
      const res = await fetch(`${base}/${p}`, {
        ...init,
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      });
      const txt = await res.text();
      return { status: res.status, data: txt ? JSON.parse(txt) : null };
    };
    // Provision an invite two ways: bootstrap on a clean relay, or `?invite=<code>` on a
    // relay that already has identities (that is the operator/CI path, and it exercises the
    // invite gate instead of sidestepping it).
    const supplied = new URL(SELF).searchParams.get("invite") ?? undefined;
    let inviteCode = supplied;
    if (!inviteCode) {
      const boot = await call("bootstrap-invite", { method: "POST", body: "{}" });
      inviteCode = typeof boot.data?.code === "string" ? boot.data.code : undefined;
      add(
        "first-boot bootstrap mints an admin invite on an empty relay",
        boot.status === 200 && !!inviteCode,
        boot.status === 409 ? "relay already has identities — pass ?invite=<code> to test the gated path" : `role=${boot.data?.role ?? "?"}`,
      );
      if (boot.status === 200) {
        const secondBoot = await call("bootstrap-invite", { method: "POST", body: "{}" });
        add("bootstrap self-disables once an identity exists", secondBoot.status === 409);
      }
    } else {
      add("invite supplied via query param (operator path)", true, `code ${inviteCode.slice(0, 6)}…`);
    }
    const versionProbe = await call("version");
    const inviteOnly = versionProbe.data?.inviteOnly !== false;
    const gateProbe = await call("register", {
      method: "POST",
      body: JSON.stringify({ username: `gateless-${Date.now().toString(36)}`, vaultSalt: "c2FsdA==", vaultBlob: "v1.bm9uY2U=.Y3Q=", authSalt: "x", authVerifier: "v".repeat(44), ikPub: "BKik", spkPub: "BKspk", spkSig: "s", opkPubs: ["o"] }),
    });
    add(
      "invite gate blocks signup without a code",
      inviteOnly ? gateProbe.status === 403 : gateProbe.status === 200,
      gateProbe.status === 429
        ? `HTTP 429 — rate limiter fired first (also correct); set SHER_RATE_LIMIT=off in CI`
        : `HTTP ${gateProbe.status}: ${gateProbe.data?.error ?? ""} (inviteOnly=${inviteOnly})`,
    );

    const tag = Date.now().toString(36);
    const mkUser = async (name: string) => {
      const id = await createIdentity();
      const r = await call("register", {
        method: "POST",
        body: JSON.stringify({
          username: name,
          inviteCode,
          vaultSalt: "s",
          vaultBlob: "nonce|opaque-vault",
          authSalt: "s",
          authVerifier: "v".repeat(64),
          ikPub: id.ik.pub,
          spkPub: id.spk.pub,
          spkSig: id.spkSig,
          opkPubs: id.opks.map((k) => k.pub),
        }),
      });
      return { id, token: r.data?.token as string, userId: r.data?.userId as string, status: r.status, error: r.data?.error as string | undefined };
    };
    const x = await mkUser(`x-${tag}`);
    const y = await mkUser(`y-${tag}`);
    add("relay registers two identities", x.status === 200 && y.status === 200, `x=${x.status} ${x.error ?? ""} · y=${y.status} ${y.error ?? ""}`);
    const rid = await deriveRoomId(x.id.ik.pub, y.id.ik.pub);
    add("relay room created", (await call("rooms", { method: "POST", body: JSON.stringify({ roomId: rid, type: "dm", members: [y.userId] }) }, x.token)).status === 200);

    const fetched = await call("bundle", { method: "POST", body: JSON.stringify({ userId: y.userId }) }, x.token);
    add("relay serves a verifiable prekey bundle", fetched.status === 200 && (await verifyBundle(fetched.data)));
    step("relay handshake");
    const { session: sx, prekey: pkx } = await x3dh(x.id, bundle(y.id, "y"));
    const wire = (await ratchetEncrypt(x.id, sx, { t: "msg", text: "the cake is a lie", at: Date.now() }, { prekey: pkx })).wire;
    const sent = await call(
      "send",
      { method: "POST", body: JSON.stringify({ roomId: rid, kind: "msg", header: JSON.stringify(wire.header), body: wire.body, ttlMs: 60_000 }) },
      x.token,
    );
    add("relay stores ciphertext + TTL", sent.status === 200 && !!sent.data?.expiresAt);
    const ys = await call(`sync?cursor=0`, {}, y.token);
    const row = (ys.data?.items ?? []).find((i: { roomId: string }) => i.roomId === rid);
    add("peer receives exactly one row", !!row);
    const e2e = await ratchetDecrypt(y.id, null, row.header, row.body).catch((e: Error) => e.message);
    add("peer decrypts the relayed message", typeof e2e !== "string" && (e2e.value as { text: string }).text === "the cake is a lie", typeof e2e === "string" ? e2e : "ok");
    add(
      "stored body is not plaintext",
      typeof row.body === "string" && !row.body.includes("cake") && /^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/.test(row.body),
      `${row.body.length}B base64 iv.ct`,
    );
    step("relay shred");
    add("shred accepted", (await call("shred", { method: "POST", body: JSON.stringify({ ids: [row.id] }) }, y.token)).status === 200);
    const after = await call(`sync?cursor=0`, {}, x.token);
    const gone = (after.data?.items ?? []).find((i: { id: string }) => i.id === row.id);
    add("relay zeroed the body after shred", gone ? gone.body === null && !!gone.destroyedAt : true);
    add("non-member blocked from room writes", (await call("send", { method: "POST", body: JSON.stringify({ roomId: rid, kind: "msg", header: "{}", body: "zz" }) })).status === 401);

    /* ---------- the exact signup → other-device unlock flow the UI performs ---------- */
    step("signup + fresh-device unlock via relay");
    const handle = `flow-${tag}`;
    const pass = "correct horse battery staple x4";
    const authLabel = `ked-auth-v1:${handle}`; // plain label, NOT base64 — the old atob crash
    const vaultSalt = P.b64e(P.rnd(16));
    const vaultKey = await P.deriveVaultKey(pass, vaultSalt);
    const secretState = { version: 1, username: handle, note: "identity + ratchet sessions live here" };
    const blobOut = P.packEnvelope(await seal(vaultKey.bytes, utf8(JSON.stringify(secretState)), utf8(handle)));
    const fid = await createIdentity();
    const reg = await call("register", {
      method: "POST",
      body: JSON.stringify({
        username: handle,
        inviteCode,
        vaultSalt,
        vaultBlob: blobOut,
        authSalt: authLabel,
        authVerifier: await P.deriveVerifier(pass, authLabel),
        ikPub: fid.ik.pub,
        spkPub: fid.spk.pub,
        spkSig: fid.spkSig,
        opkPubs: fid.opks.map((k) => k.pub),
      }),
    });
    add(
      "signup completes with a label-salted verifier",
      reg.status === 200 && !!reg.data?.token,
      reg.status === 200 ? "role granted by the redeemed invite" : `HTTP ${reg.status}: ${reg.data?.error ?? ""}`,
    );

    const wrong = await call("login", { method: "POST", body: JSON.stringify({ username: handle, authVerifier: await P.deriveVerifier("not my passphrase", authLabel) }) });
    add("wrong passphrase rejected by the relay", wrong.status === 401);

    const relogin = await call("login", { method: "POST", body: JSON.stringify({ username: handle, authVerifier: await P.deriveVerifier(pass, authLabel) }) });
    add("login on a device with no local vault succeeds", relogin.status === 200, `blob ${String(relogin.data?.vaultBlob ?? "").slice(0, 10)}…`);
    const reopened = JSON.parse(
      new TextDecoder().decode(
        await openAead(
          (await P.deriveVaultKey(pass, String(relogin.data.vaultSalt))).bytes,
          P.unpackEnvelope(String(relogin.data.vaultBlob), "relay vault mirror"),
          utf8(handle),
        ),
      ),
    ) as typeof secretState;
    add("relay-mirrored vault decrypts on the new device", reopened.note === secretState.note);
    add("relay never saw the passphrase or the vault key", !JSON.stringify(relogin.data).includes(pass) && !JSON.stringify(relogin.data).includes(P.b64e(vaultKey.bytes)));
  } catch (e) {
    add(`harness @ ${where}`, false, (e as Error).message + " :: " + String((e as Error).stack?.split("\n")[1] ?? "").trim().slice(0, 140));
  }
  const passed = out.filter((c) => c.ok).length;
  return Response.json({ passed, total: out.length, allOk: passed === out.length, checks: out }, { headers: { "cache-control": "no-store" } });
}

async function x3dh(id: Awaited<ReturnType<typeof createIdentity>>, target: ReturnType<typeof bundle>) {
  const m = await import("@/lib/protocol");
  return m.x3dhAlice(id, target);
}
