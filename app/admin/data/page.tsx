import { redirect } from "next/navigation";
import { getAuthenticatedUserFromCookies, isAdminRole } from "@/lib/admin-auth";
import { AdminEvacuationCenters } from "@/components/admin-evacuation-centers";
export default async function AdminDataPage() { const user = await getAuthenticatedUserFromCookies(); if (!user) redirect("/login?next=/admin/data"); if (!isAdminRole(user.role)) redirect("/admin"); return <AdminEvacuationCenters />; }
