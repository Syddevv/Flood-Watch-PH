import { redirect } from "next/navigation";
import { AdminEmergencyContactsPage } from "@/components/admin-emergency-contacts-page";
import { AdminLayout } from "@/components/admin-shell";
import { getAuthenticatedUserFromCookies, isAdminRole } from "@/lib/admin-auth";

export default async function AdminContactsPage() {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) redirect("/login?next=/admin/emergency-contacts");
  if (!isAdminRole(user.role)) redirect("/admin");
  return <AdminLayout user={user}><AdminEmergencyContactsPage /></AdminLayout>;
}
