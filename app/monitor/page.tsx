import { CameraWall } from "@/components/monitor/CameraWall";

export default async function MonitorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <div className="flex flex-1 flex-col bg-slate-950 text-slate-100">
      <CameraWall demoMode={query.demo === "true"} />
    </div>
  );
}
