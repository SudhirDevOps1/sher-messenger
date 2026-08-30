import { RoomDO, type Env } from "./room-do";

export { RoomDO };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket Room Gateway
    if (url.pathname.startsWith("/ws/room/")) {
      const roomId = url.pathname.replace("/ws/room/", "").split("/")[0];
      if (!roomId) return new Response("Room ID required", { status: 400 });

      const id = env.ROOMS.idFromName(roomId);
      const obj = env.ROOMS.get(id);
      return obj.fetch(request);
    }

    // Room API Gateway for Durable Objects
    if (url.pathname.startsWith("/api/room/")) {
      const parts = url.pathname.replace("/api/room/", "").split("/");
      const roomId = parts[0];
      const action = parts[1] || "info";

      if (!roomId) return new Response("Room ID required", { status: 400 });

      const id = env.ROOMS.idFromName(roomId);
      const obj = env.ROOMS.get(id);

      const forwardUrl = new URL(request.url);
      forwardUrl.pathname = `/${action}`;
      return obj.fetch(new Request(forwardUrl.toString(), request));
    }

    return new Response("SHER Messenger Edge Gateway", { status: 200 });
  },
};

export default worker;
