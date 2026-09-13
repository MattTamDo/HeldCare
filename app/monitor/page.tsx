import { CameraWall } from "@/components/monitor/CameraWall";

export default async function MonitorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return <CameraWall demoMode={query.demo === "true"} />;
}
