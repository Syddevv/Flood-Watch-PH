import { NEARBY_EVACUATION_FEATURED_CENTERS } from "@/lib/evacuation-center-scope";

export type AdminStatus = "critical" | "urgent" | "pending" | "verified";
export type AdminAlert = { severity: "critical" | "warning" | "information" | "success"; title: string; description: string; updated: string };
export type AdminStat = { label: string; value: string; detail: string; tone: "critical" | "warning" | "info" | "success" };
export type AdminAttentionItem = { id: string; recordId: string; title: string; location: string; relativeTime: string; status: AdminStatus; href?: string };
export type CapacityItem = { id: string; name: string; occupied: number; capacity: number; status: "normal" | "high" | "full" };
export type AdminActivityEntry = { id: string; action: string; record: string; timestamp: string; description: string };
export type AdminOverviewData = { alert: AdminAlert; stats: AdminStat[]; attentionItems: AdminAttentionItem[]; evacuationReadiness: CapacityItem[]; activity: AdminActivityEntry[]; dataMode: "live" | "preview" };

export function getAdminOverviewData(): AdminOverviewData {
  const centers = NEARBY_EVACUATION_FEATURED_CENTERS;
  return {
    dataMode: "preview",
    alert: { severity: "warning", title: "Orange rainfall warning remains active across Calumpit", description: "Three critical rescue requests are open. River levels continue to rise in Meysulao and Gatbuca.", updated: "Updated 2 min ago" },
    stats: [
      { label: "Critical rescues", value: "3", detail: "+1 in 10 min", tone: "critical" },
      { label: "Active incidents", value: "12", detail: "4 severe", tone: "warning" },
      { label: "Awaiting verification", value: "19", detail: "Oldest: 26 min", tone: "info" },
      { label: "People sheltered", value: "918", detail: "80% total capacity", tone: "success" },
    ],
    attentionItems: [
      { id: "rr-1048", recordId: "RR-1048", title: "Family trapped on second floor", location: "Brgy. Meysulao", relativeTime: "2 min ago", status: "critical", href: "/admin/rescue-requests" },
      { id: "inc-209", recordId: "INC-209", title: "River overflow affecting three streets", location: "Brgy. Gatbuca", relativeTime: "4 min ago", status: "urgent", href: "/admin/incidents" },
      { id: "rpt-5821", recordId: "RPT-5821", title: "Chest-deep flooding near public market", location: "Brgy. Popolacion", relativeTime: "7 min ago", status: "pending", href: "/admin/reports" },
      { id: "rr-1045", recordId: "RR-1045", title: "Dialysis patient needs transport", location: "Brgy. Longos", relativeTime: "9 min ago", status: "urgent", href: "/admin/rescue-requests" },
      { id: "rpt-5819", recordId: "RPT-5819", title: "MacArthur Highway lane impassable", location: "Brgy. Calumpang", relativeTime: "14 min ago", status: "verified", href: "/admin/reports" },
    ],
    evacuationReadiness: (centers.length ? centers : []).map((center, index) => ({ id: center.id, name: center.name.replace(" Reference", ""), occupied: [386, 278, 180, 74][index] ?? 74, capacity: [500, 300, 180, 160][index] ?? 160, status: index === 2 ? "full" : index === 1 ? "high" : "normal" })),
    activity: [
      { id: "a1", action: "Team Alpha acknowledged", record: "RR-1048", timestamp: "2 min ago", description: "Rescue dispatch is coordinating a second-floor extraction." },
      { id: "a2", action: "Report verified", record: "RPT-5819", timestamp: "6 min ago", description: "Field evidence confirms the highway obstruction." },
      { id: "a3", action: "Capacity updated", record: "Meycauayan center", timestamp: "11 min ago", description: "Shelter occupancy was refreshed by the operations desk." },
      { id: "a4", action: "Incident created", record: "INC-209", timestamp: "18 min ago", description: "River overflow response is now active." },
    ],
  };
}
