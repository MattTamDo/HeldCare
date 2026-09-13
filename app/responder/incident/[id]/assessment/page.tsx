import AssessmentScreen from "@/components/assessment/assessment-screen";

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="min-h-full bg-surface text-slate-100">
      <AssessmentScreen incidentId={id} />
    </div>
  );
}
