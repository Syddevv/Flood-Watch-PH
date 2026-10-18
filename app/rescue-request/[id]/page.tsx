import { DashboardShell } from "@/components/dashboard-shell";

export default async function RescueRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DashboardShell pageMode="rescue-request" rescueRequestId={id} />;
}
