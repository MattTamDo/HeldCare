import { redirect } from "next/navigation";

export default async function DashboardRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams({ tab: "facility" });
  if (query.demo === "true") params.set("demo", "true");
  redirect(`/monitor?${params.toString()}`);
}
