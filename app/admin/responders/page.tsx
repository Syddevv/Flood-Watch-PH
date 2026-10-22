import { redirect } from "next/navigation";
import { AdminLayout } from "@/components/admin-shell";
import { AdminResponders } from "@/components/admin-responders";
import { getAuthenticatedUserFromCookies, isAdminRole } from "@/lib/admin-auth";

export default async function RespondersPage() {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) redirect("/login?next=/admin/responders");
  if (!isAdminRole(user.role)) redirect("/admin");
  return <AdminLayout user={user}><AdminResponders /></AdminLayout>;
}
