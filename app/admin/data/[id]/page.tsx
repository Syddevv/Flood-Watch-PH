import { redirect } from "next/navigation";
import { getAuthenticatedUserFromCookies, isAdminRole } from "@/lib/admin-auth";

export default async function AdminEvacuationCenterPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserFromCookies();
  const { id } = await params;
  if (!user) redirect(`/login?next=/admin/data/${id}`);
  if (!isAdminRole(user.role)) redirect("/admin");
  redirect(`/admin/data?center=${encodeURIComponent(id)}`);
}
