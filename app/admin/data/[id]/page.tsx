import { redirect } from "next/navigation";
import { AdminLayout } from "@/components/admin-shell";
import { AdminEvacuationCenterDetail } from "@/components/admin-evacuation-center-detail";
import { getAuthenticatedUserFromCookies, isAdminRole } from "@/lib/admin-auth";

export default async function AdminEvacuationCenterPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromCookies();
  const { id } = await params;
  if (!user) redirect(`/login?next=/admin/data/${id}`);
  if (!isAdminRole(user.role)) redirect("/admin");
  return <AdminLayout user={user}><AdminEvacuationCenterDetail centerId={id} /></AdminLayout>;
}
