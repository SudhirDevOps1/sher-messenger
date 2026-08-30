/**
 * Cloudflare Durable Object: RoomDO
 * 
 * Ephemeral in-memory room runtime with WebSocket Hibernation.
 * Zero chat content is ever written to durable storage or database.
 * Auto-evicts and shreds all in-memory state upon TTL expiration.
 */

export interface Env {
  ROOMS: DurableObjectNamespace;
  DB?: D1Database;
  KV?: KVNamespace;
  ROOM_TTL_HARD_CAP_MIN?: string;
}

export interface MemberSession {
  ws: WebSocket;
  anonId: string;
  nickname: string;
  joinedAt: number;
}

export class RoomDO {
  state: DurableObjectState;
  env: Env;
  members = new Map<WebSocket, { anonId: string; nickname: string; joinedAt: number }>();
  roomId: string = "";
  roomName: string = "Ephemeral Room";
  maxUsers: number = 10;
  ttlMs: number = 30 * 60_000;
  createdAt: number = Date.now();
  burnTimer: any = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/init" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        roomId?: string;
        roomName?: string;
        maxUsers?: number;
        ttlMs?: number;
      };
      this.roomId = body.roomId || this.roomId;
      this.roomName = body.roomName || this.roomName;
      this.maxUsers = Math.max(2, Math.min(50, Number(body.maxUsers) || 10));
      const hardCap = (Number(this.env.ROOM_TTL_HARD_CAP_MIN) || 120) * 60_000;
      this.ttlMs = Math.min(hardCap, Math.max(60_000, Number(body.ttlMs) || 30 * 60_000));
      this.createdAt = Date.now();

      this.scheduleBurn();
      return new Response(JSON.stringify({ ok: true, roomId: this.roomId, expiresAt: new Date(this.createdAt + this.ttlMs).toISOString() }), {
        headers: { "content-type": "application/json" },
      });
    }

    if (url.pathname === "/info") {
      const remainingMs = Math.max(0, this.createdAt + this.ttlMs - Date.now());
      return new Response(
        JSON.stringify({
          roomId: this.roomId,
          roomName: this.roomName,
          membersCount: this.members.size,
          maxUsers: this.maxUsers,
          createdAt: this.createdAt,
          expiresAt: new Date(this.createdAt + this.ttlMs).toISOString(),
          remainingMs,
          isBurned: remainingMs <= 0,
        }),
        { headers: { "content-type": "application/json" } }
      );
    }

    if (url.pathname === "/burn" && request.method === "POST") {
      this.burnNow();
      return new Response(JSON.stringify({ ok: true, burned: true }), {
        headers: { "content-type": "application/json" },
      });
    }

    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      if (this.createdAt + this.ttlMs <= Date.now()) {
        return new Response("Room expired and burned", { status: 410 });
      }

      if (this.members.size >= this.maxUsers) {
        return new Response("Room at maximum capacity", { status: 429 });
      }

      const pair = new WebSocketPair();
      const [clientWs, serverWs] = Object.values(pair) as [WebSocket, WebSocket];

      const anonId = url.searchParams.get("anonId") || `u_${Math.random().toString(36).slice(2, 10)}`;
      const nickname = url.searchParams.get("nickname") || "Guest";

      this.state.acceptWebSocket(serverWs);
      this.members.set(serverWs, { anonId, nickname, joinedAt: Date.now() });

      this.broadcast({
        type: "presence",
        event: "join",
        anonId,
        nickname,
        membersCount: this.members.size,
      });

      return new Response(null, { status: 101, webSocket: clientWs } as any);
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (this.createdAt + this.ttlMs <= Date.now()) {
      this.burnNow();
      return;
    }

    const sender = this.members.get(ws);
    if (!sender) return;

    try {
      const data = typeof message === "string" ? JSON.parse(message) : null;
      if (!data) return;

      if (data.type === "msg" || data.type === "signal" || data.type === "typing") {
        const raw = typeof message === "string" ? message : "";
        if (raw.length > 3000) {
          ws.send(JSON.stringify({ type: "error", error: "Message size exceeds 2KB limit" }));
          return;
        }

        this.broadcast(
          {
            ...data,
            senderId: sender.anonId,
            senderName: sender.nickname,
            at: Date.now(),
          },
          ws
        );
      }
    } catch {
      // Ignore malformed frames
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    const sender = this.members.get(ws);
    this.members.delete(ws);
    if (sender) {
      this.broadcast({
        type: "presence",
        event: "leave",
        anonId: sender.anonId,
        nickname: sender.nickname,
        membersCount: this.members.size,
      });
    }
  }

  async webSocketError(ws: WebSocket, error: unknown) {
    this.members.delete(ws);
  }

  private broadcast(payload: unknown, excludeWs?: WebSocket) {
    const msg = JSON.stringify(payload);
    for (const [ws] of this.members) {
      if (ws !== excludeWs) {
        try {
          ws.send(msg);
        } catch {
          this.members.delete(ws);
        }
      }
    }
  }

  private scheduleBurn() {
    if (this.burnTimer) clearTimeout(this.burnTimer);
    const delay = Math.max(0, this.createdAt + this.ttlMs - Date.now());
    this.burnTimer = setTimeout(() => this.burnNow(), delay);
  }

  private burnNow() {
    this.broadcast({ type: "burned", note: "Room time expired. All ephemeral memory purged." });
    for (const [ws] of this.members) {
      try {
        ws.close(1000, "Room Burned");
      } catch {}
    }
    this.members.clear();
  }
}
