import { SingleRoomMonitor } from "@/components/monitor/SingleRoomMonitor";

export default async function RoomCameraPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ roomId }, query] = await Promise.all([params, searchParams]);

  return <SingleRoomMonitor roomId={roomId} demoMode={query.demo === "true"} />;
}
