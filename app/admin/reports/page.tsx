import { redirect } from "next/navigation";
import { getAuthenticatedUserFromCookies, isAdminRole } from "@/lib/admin-auth";
import { AdminReports } from "@/components/admin-reports";
import { AdminLayout } from "@/components/admin-shell";

export default async function AdminReportsPage() {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) redirect("/login?next=/admin/reports");
  if (!isAdminRole(user.role)) redirect("/admin");
  return <AdminLayout user={user}><AdminReports /></AdminLayout>;
}
