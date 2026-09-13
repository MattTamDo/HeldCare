import { CHANNEL, incidentBus } from "@/lib/realtime/bus";
import type { RealtimeEvent } from "@/lib/types/incident";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function encode(data: string) {
  return new TextEncoder().encode(data);
}

export async function GET() {
  let onEvent: (event: RealtimeEvent) => void = () => {};
  let heartbeat: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encode(`: connected\n\n`));

      onEvent = (event: RealtimeEvent) => {
        controller.enqueue(encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      incidentBus.on(CHANNEL, onEvent);

      // Keep intermediary proxies / browsers from closing an idle connection.
      heartbeat = setInterval(() => {
        controller.enqueue(encode(`: ping\n\n`));
      }, 25000);
    },
    cancel() {
      incidentBus.off(CHANNEL, onEvent);
      clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
