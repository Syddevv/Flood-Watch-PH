import { redirect } from "next/navigation";
import { AdminLayout, AdminPlaceholderPage } from "@/components/admin-shell";
import { AdminAnalytics } from "@/components/admin-analytics";
import { getAuthenticatedUserFromCookies, isAdminRole } from "@/lib/admin-auth";

const labels: Record<string, string> = { map: "Live Operations Map", incidents: "Incidents", "rescue-requests": "Rescue Requests", "covered-areas": "Covered Areas", users: "Users & Roles", analytics: "Analytics", exports: "Statistics & Exports", notifications: "Notifications", "audit-logs": "Audit Logs", settings: "Settings" };

export default async function AdminModulePage({ params }: { params: Promise<{ module: string }> }) {
  const user = await getAuthenticatedUserFromCookies();
  const { module } = await params;
  if (!user) redirect(`/login?next=/admin/${module}`);
  if (!isAdminRole(user.role)) redirect("/admin");
  if (module === "analytics") return <AdminLayout user={user}><AdminAnalytics /></AdminLayout>;
  return <AdminLayout user={user}><AdminPlaceholderPage title={labels[module] ?? "Admin module"} /></AdminLayout>;
}
