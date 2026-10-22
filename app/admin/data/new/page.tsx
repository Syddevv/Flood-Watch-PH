import { redirect } from "next/navigation";
import { getAuthenticatedUserFromCookies, isAdminRole } from "@/lib/admin-auth";
export default async function NewCenterPage() { const user = await getAuthenticatedUserFromCookies(); if (!user) redirect("/login?next=/admin/data/new"); if (!isAdminRole(user.role)) redirect("/admin"); redirect("/admin/data?new=1"); }
