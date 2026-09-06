import { redirect } from "next/navigation";
import { AdminLayout, AdminPlaceholderPage } from "@/components/admin-shell";
import { getAuthenticatedUserFromCookies, isAdminRole } from "@/lib/admin-auth";

export default async function NewRescueRequestPage() {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) redirect("/login?next=/admin/rescue-requests/new");
  if (!isAdminRole(user.role)) redirect("/admin");
  return <AdminLayout user={user}><AdminPlaceholderPage title="New rescue request" description="The rescue intake workflow will be connected when rescue request persistence is introduced." /></AdminLayout>;
}
