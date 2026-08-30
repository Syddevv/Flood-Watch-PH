import { redirect } from "next/navigation";
import { AdminLayout } from "@/components/admin-shell";
import { AdminLiveMap } from "@/components/admin-live-map";
import { getAuthenticatedUserFromCookies, isAdminRole } from "@/lib/admin-auth";

export default async function AdminMapPage() {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) redirect("/login?next=/admin/map");
  if (!isAdminRole(user.role)) redirect("/admin");
  return <AdminLayout user={user}><AdminLiveMap /></AdminLayout>;
}
