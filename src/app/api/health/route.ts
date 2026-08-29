import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Health probe: platform Postgres + the KED relay store that is actually selected. */
export async function GET() {
  let postgres = false;
  try {
    const { db } = await import("@/db");
    await db.execute(sql`select 1`);
    postgres = true;
  } catch {
    postgres = false;
  }

  let adapter = "unavailable";
  let rows: Record<string, unknown> = {};
  try {
    const { getStore } = await import("@/server/store");
    const store = await getStore();
    await store.init();
    adapter = store.adapter;
    rows = await store.stats();
  } catch {
    adapter = "unavailable";
  }

  return Response.json(
    {
      ok: true,
      postgres,
      ked: {
        adapter,
        plaintextRowsOnServer: 0,
        ...rows,
        policy: "ciphertext only; no analytics; TTL shred sweep on read",
      },
      time: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store, private" } },
  );
}
