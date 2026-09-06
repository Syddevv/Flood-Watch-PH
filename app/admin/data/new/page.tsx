import { redirect } from "next/navigation";
import { AdminLayout, AdminPlaceholderPage } from "@/components/admin-shell";
import { getAuthenticatedUserFromCookies, isAdminRole } from "@/lib/admin-auth";
export default async function NewCenterPage() { const user = await getAuthenticatedUserFromCookies(); if (!user) redirect("/login?next=/admin/data/new"); if (!isAdminRole(user.role)) redirect("/admin"); return <AdminLayout user={user}><AdminPlaceholderPage title="Add evacuation center" description="The existing center creation API is ready; the administrative entry form will be added next." /></AdminLayout>; }
