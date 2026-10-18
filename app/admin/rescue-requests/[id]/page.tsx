import { redirect } from "next/navigation";
import { AdminLayout } from "@/components/admin-shell";
import { AdminRescueDetail } from "@/components/admin-rescue-detail";
import { getAuthenticatedUserFromCookies, isAdminRole } from "@/lib/admin-auth";

export default async function AdminRescueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromCookies();
  const { id } = await params;
  if (!user) redirect(`/login?next=/admin/rescue-requests/${encodeURIComponent(id)}`);
  if (!isAdminRole(user.role)) redirect("/admin");
  return <AdminLayout user={user}><AdminRescueDetail id={id} /></AdminLayout>;
}
