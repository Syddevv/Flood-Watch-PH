import { redirect } from "next/navigation";
import { AdminLayout, AdminPlaceholderPage } from "@/components/admin-shell";
import { getAuthenticatedUserFromCookies, isAdminRole } from "@/lib/admin-auth";
export default async function NewIncidentPage() { const user = await getAuthenticatedUserFromCookies(); if (!user) redirect("/login?next=/admin/incidents/new"); if (!isAdminRole(user.role)) redirect("/admin"); return <AdminLayout user={user}><AdminPlaceholderPage title="Create incident" description="Incident creation workflows are planned for a future release." /></AdminLayout>; }
