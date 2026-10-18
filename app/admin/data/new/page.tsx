import { redirect } from "next/navigation";
import { AdminLayout } from "@/components/admin-shell";
import { AdminEvacuationCenterDetail } from "@/components/admin-evacuation-center-detail";
import { getAuthenticatedUserFromCookies, isAdminRole } from "@/lib/admin-auth";
export default async function NewCenterPage() { const user = await getAuthenticatedUserFromCookies(); if (!user) redirect("/login?next=/admin/data/new"); if (!isAdminRole(user.role)) redirect("/admin"); return <AdminLayout user={user}><AdminEvacuationCenterDetail /></AdminLayout>; }
