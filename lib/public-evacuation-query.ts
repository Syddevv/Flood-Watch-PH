import "server-only";

import { prisma } from "@/lib/prisma";
import { isPublishableCenter, toPublicCenter } from "@/lib/public-evacuation-centers";

export async function getPublicEvacuationCenters() {
  const rows = await prisma.evacuationCenter.findMany({
    where: { isArchived: false, province: { equals: "Bulacan", mode: "insensitive" }, verificationStatus: "verified" },
    orderBy: [{ city: "asc" }, { name: "asc" }],
    take: 1000,
  });
  return rows.filter(isPublishableCenter).map(toPublicCenter);
}
