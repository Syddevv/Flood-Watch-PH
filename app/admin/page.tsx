import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthenticatedUserFromCookies, isAdminRole } from "@/lib/admin-auth";
import { AdminLayout } from "@/components/admin-shell";
import { AdminOverview } from "@/components/admin-overview";

export default async function AdminPage() {
  const user = await getAuthenticatedUserFromCookies();
  if (!user) redirect("/login?next=/admin");
  if (!isAdminRole(user.role)) return <main className="min-h-screen p-8"><h1>Administrator access required</h1><p>Your account is signed in, but it does not have administrator permissions.</p><Link href="/">Return to FloodWatch PH</Link></main>;
  return <AdminLayout user={user}><AdminOverview /></AdminLayout>;
}
