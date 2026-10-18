import { redirect } from "next/navigation";
import { AdminLayout } from "@/components/admin-shell";
import { AdminNewRescuePageContent } from "@/components/admin-new-rescue-page-content";
import { getAuthenticatedUserFromCookies, isAdminRole } from "@/lib/admin-auth";

export default async function NewRescueRequestPage() {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) redirect("/login?next=/admin/rescue-requests/new");
  if (!isAdminRole(user.role)) redirect("/admin");
  return <AdminLayout user={user}><AdminNewRescuePageContent /></AdminLayout>;
}
