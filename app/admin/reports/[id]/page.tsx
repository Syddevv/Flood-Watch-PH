import { redirect } from "next/navigation";
import { getAuthenticatedUserFromCookies, isAdminRole } from "@/lib/admin-auth";
import { AdminReportDetail } from "@/components/admin-report-detail";

export default async function AdminReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) redirect(`/login?next=/admin/reports/${(await params).id}`);
  if (!isAdminRole(user.role)) redirect("/admin");
  return <AdminReportDetail reportId={(await params).id} />;
}
