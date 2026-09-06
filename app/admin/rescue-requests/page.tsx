import { redirect } from "next/navigation";
import { AdminLayout } from "@/components/admin-shell";
import { AdminRescueRequests } from "@/components/admin-rescue-requests";
import { getAuthenticatedUserFromCookies, isAdminRole } from "@/lib/admin-auth";

export default async function AdminRescueRequestsPage() {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) redirect("/login?next=/admin/rescue-requests");
  if (!isAdminRole(user.role)) redirect("/admin");
  return <AdminLayout user={user}><AdminRescueRequests /></AdminLayout>;
}
