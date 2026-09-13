import AssessmentScreen from "@/components/assessment/assessment-screen";

export default async function AssessmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ room?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const room = Array.isArray(query.room) ? query.room[0] : query.room;
  return <AssessmentScreen incidentId={id} roomId={room} />;
}
