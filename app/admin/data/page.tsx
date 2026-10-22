import { redirect } from "next/navigation";
import { getAuthenticatedUserFromCookies, isAdminRole } from "@/lib/admin-auth";
import { AdminEvacuationCentersPage } from "@/components/admin-evacuation-centers-page";
import { AdminLayout } from "@/components/admin-shell";

export default async function AdminDataPage({ searchParams }: { searchParams: Promise<{ center?: string | string[]; new?: string | string[] }> }) {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) redirect("/login?next=/admin/data");
  if (!isAdminRole(user.role)) redirect("/admin");

  const query = await searchParams;
  const centerId = typeof query.center === "string" ? query.center : undefined;
  const initialCreate = query.new === "1";
  return <AdminLayout user={user}>
    <AdminEvacuationCentersPage key={centerId ?? (initialCreate ? "new" : "list")} initialCenterId={centerId} initialCreate={initialCreate} />
  </AdminLayout>;
}
