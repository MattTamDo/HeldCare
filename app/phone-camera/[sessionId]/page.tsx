import PhoneCameraPage from "@/components/phone-camera/phone-camera-page";

export default async function Page({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <PhoneCameraPage sessionId={sessionId} />;
}
