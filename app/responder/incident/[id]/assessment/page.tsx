import AssessmentScreen from "@/components/assessment/assessment-screen";

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AssessmentScreen incidentId={id} />;
}
