import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { RescueError } from "@/lib/rescue-contracts";
import { isRescueTriageOverdue, parseAdminRescueFilters, TRIAGE_ATTENTION_MINUTES } from "@/lib/rescue-queue-policy";

const PAGE_SIZE = 20;

type Filters = ReturnType<typeof parseAdminRescueFilters>;

export function adminRescueWhere(filters: Filters): Prisma.RescueRequestWhereInput {
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.localityCode ? { localityCode: filters.localityCode } : {}),
    ...(filters.search ? { OR: [
      { reference: { contains: filters.search, mode: "insensitive" } },
      { barangay: { contains: filters.search, mode: "insensitive" } },
    ] } : {}),
  };
}

function queueOrder(sort: Filters["sort"]): Prisma.RescueRequestOrderByWithRelationInput[] {
  return sort === "locality" ? [{ localityCode: "asc" }, { createdAt: "asc" }, { id: "asc" }]
    : [{ createdAt: sort === "oldest" ? "asc" : "desc" }, { id: sort === "oldest" ? "asc" : "desc" }];
}

const queueSelect = {
  id: true, reference: true, status: true, priority: true, version: true,
  createdAt: true, updatedAt: true, localityCode: true, barangay: true,
  peopleCount: true, caseOwnerUserId: true, confirmedTeamReference: true,
  intakeChannel: true,
  events: { where: { nextStatus: "triaged" }, orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }], take: 1, select: { createdAt: true } },
} satisfies Prisma.RescueRequestSelect;

export async function listAdminRescueQueue(params: URLSearchParams) {
  const filters = parseAdminRescueFilters(params);
  const where = adminRescueWhere(filters);
  if (filters.cursor && !await prisma.rescueRequest.findFirst({ where: { ...where, id: filters.cursor }, select: { id: true } })) {
    throw new RescueError("Page cursor is unavailable for these filters.", 400);
  }
  const now = new Date();
  const [rows, total, overdueCount, unassignedCount] = await Promise.all([
    prisma.rescueRequest.findMany({ where, select: queueSelect, orderBy: queueOrder(filters.sort), take: PAGE_SIZE + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}) }),
    prisma.rescueRequest.count({ where }),
    prisma.rescueRequest.count({ where: { status: "received", createdAt: { lte: new Date(now.getTime() - TRIAGE_ATTENTION_MINUTES * 60_000) } } }),
    prisma.rescueRequest.count({ where: { status: "triaged", caseOwnerUserId: null } }),
  ]);
  return {
    requests: rows.slice(0, PAGE_SIZE).map(({ events, ...row }) => ({
      ...row, firstTriagedAt: events[0]?.createdAt ?? null, overdue: isRescueTriageOverdue(row, now),
    })),
    nextCursor: rows.length > PAGE_SIZE ? rows[PAGE_SIZE - 1].id : null,
    summary: { total, overdueCount, unassignedCount, asOf: now, attentionMinutes: TRIAGE_ATTENTION_MINUTES },
  };
}

export async function exportAdminRescueQueue(params: URLSearchParams) {
  const filters = parseAdminRescueFilters(params);
  const rows = await prisma.rescueRequest.findMany({ where: adminRescueWhere(filters), orderBy: queueOrder(filters.sort), take: 1001,
    select: { reference: true, createdAt: true, status: true, priority: true, localityCode: true, barangay: true, peopleCount: true, caseOwnerUserId: true, confirmedTeamReference: true } });
  if (rows.length > 1000) throw new RescueError("Export exceeds 1,000 rows. Narrow the filters first.", 400);
  const cell = (value: string | number | Date | null) => {
    const raw = value instanceof Date ? value.toISOString() : String(value ?? "");
    const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return ["Reference,Received at,Status,Priority,Locality,Barangay,People,Case owner ID,Confirmed team reference",
    ...rows.map((row) => [row.reference, row.createdAt, row.status, row.priority, row.localityCode, row.barangay, row.peopleCount, row.caseOwnerUserId, row.confirmedTeamReference].map(cell).join(","))].join("\r\n");
}
