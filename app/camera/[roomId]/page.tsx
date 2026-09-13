import { RoomCameraMonitor } from "@/components/camera/RoomCameraMonitor";
import { getMonitoredRoom } from "@/lib/fall/config";

export default async function RoomCameraPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ roomId }, query] = await Promise.all([params, searchParams]);

  return (
    <RoomCameraMonitor
      room={getMonitoredRoom(roomId)}
      demoMode={query.demo === "true"}
    />
  );
}
