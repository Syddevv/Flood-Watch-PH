import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AdminLayout, AdminPlaceholderPage } from "@/components/admin-shell";
import { AdminAnalytics } from "@/components/admin-analytics";
import { AdminNotifications } from "@/components/admin-notifications";
import { AdminSettings } from "@/components/admin-settings";
import { getAuthenticatedUserFromCookies, isAdminRole } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const labels: Record<string, string> = { map: "Live Operations Map", incidents: "Incidents", "covered-areas": "Covered Areas", users: "Users & Roles", analytics: "Analytics", exports: "Statistics & Exports", notifications: "Notifications", "audit-logs": "Audit Logs", settings: "Settings" };

export default async function AdminModulePage({ params, searchParams }: { params: Promise<{ module: string }>; searchParams: Promise<{ page?: string }> }) {
  const user = await getAuthenticatedUserFromCookies();
  const { module } = await params;
  if (module === "rescue-requests" || module === "responders") notFound();
  if (!user) redirect(`/login?next=/admin/${module}`);
  if (!isAdminRole(user.role)) redirect("/admin");
  if (module === "analytics") return <AdminLayout user={user}><AdminAnalytics /></AdminLayout>;
  if (module === "notifications") return <AdminLayout user={user}><AdminNotifications /></AdminLayout>;
  if (module === "settings") return <AdminLayout user={user}><AdminSettings /></AdminLayout>;
  if (module === "audit-logs") {
    const query = await searchParams;
    const page = /^\d+$/.test(query.page ?? "") ? Math.min(1000, Math.max(1, Number(query.page))) : 1;
    const logs = await prisma.adminAuditLog.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 50, take: 51,
      select: { id: true, action: true, targetType: true, targetId: true, createdAt: true, actor: { select: { fullName: true, email: true } } } });
    return <AdminLayout user={user}><div className="mx-auto max-w-[1000px] space-y-5"><div><Link href="/admin/settings" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">← Back to settings</Link><h2 className="mt-3 text-3xl font-bold">Administrative Audit Logs</h2><p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Recorded administrative activity, newest first.</p></div><div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">{logs.slice(0, 50).map((log) => <div key={log.id} className="border-b border-[var(--color-border)] p-4 last:border-0"><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{log.action.replaceAll("_", " ")}</strong><time className="text-xs text-[var(--color-muted-foreground)]" dateTime={log.createdAt.toISOString()}>{log.createdAt.toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</time></div><p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{log.actor?.fullName ?? log.actor?.email ?? "System"}{log.targetType ? ` · ${log.targetType}` : ""}{log.targetId ? ` · ${log.targetId}` : ""}</p></div>)}{!logs.length && <p className="p-5 text-sm text-[var(--color-muted-foreground)]">No administrative activity recorded.</p>}</div><nav className="flex gap-3 text-sm">{page > 1 && <Link href={`/admin/audit-logs?page=${page - 1}`} className="rounded-lg border border-[var(--color-border)] px-3 py-2">Previous</Link>}{logs.length > 50 && <Link href={`/admin/audit-logs?page=${page + 1}`} className="rounded-lg border border-[var(--color-border)] px-3 py-2">Next</Link>}</nav></div></AdminLayout>;
  }
  return <AdminLayout user={user}><AdminPlaceholderPage title={labels[module] ?? "Admin module"} /></AdminLayout>;
}
