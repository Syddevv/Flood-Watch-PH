import { redirect } from "next/navigation";
import { AdminLayout } from "@/components/admin-shell";
import { AdminCoveredAreas } from "@/components/admin-covered-areas";
import { getAuthenticatedUserFromCookies, isAdminRole } from "@/lib/admin-auth";

export default async function AdminCoveredAreasPage() {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) redirect("/login?next=/admin/covered-areas");
  if (!isAdminRole(user.role)) redirect("/admin");
  return <AdminLayout user={user}><AdminCoveredAreas /></AdminLayout>;
}
