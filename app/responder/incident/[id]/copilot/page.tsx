import PhoneCopilotScreen from "@/components/assessment/phone-copilot-screen";

export default async function CopilotPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ room?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const room = Array.isArray(query.room) ? query.room[0] : query.room;
  return <PhoneCopilotScreen incidentId={id} roomId={room} />;
}
