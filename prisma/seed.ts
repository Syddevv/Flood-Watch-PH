import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DIRECT_URL or DATABASE_URL is required to run the seed script.",
  );
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

const seedReportTitles = [
  "Poblacion Riverside Severe Flood Alert",
  "Iba O'Este Road Flooding",
  "Frances Low-Lying Area Flood Watch",
] as const;

const safetyTipTitles = [
  "Prepare an emergency go bag",
  "Avoid walking through floodwater",
  "Turn off electricity before evacuation",
  "Follow official evacuation instructions",
  "Disinfect items after flooding",
  "Keep emergency contacts accessible",
] as const;

async function main() {
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const ninetyMinutesAgo = new Date(now.getTime() - 90 * 60 * 1000);
    const fortyMinutesAgo = new Date(now.getTime() - 40 * 60 * 1000);

    await tx.floodReport.deleteMany({
      where: {
        title: {
          in: [...seedReportTitles],
        },
      },
    });

    await tx.adminOperationalAction.deleteMany({
      where: { requestId: "seed:phase0" },
    });

    // Each seed report founds its own singleton incident (createMany can't
    // populate a required relation, and these three reports aren't meant to
    // represent the same physical incident anyway).
    const seedReports = [
      {
        title: seedReportTitles[0],
        description:
          "Water levels are rising and low-lying communities should stay alert.",
        category: "Overflowing River",
        severity: "Critical",
        status: "Confirmed by Community",
        locationName: "Poblacion, Calumpit",
        latitude: 14.916,
        longitude: 120.766,
        sourceType: "System",
        confirmationCount: 12,
        lastActivityAt: fortyMinutesAgo,
        createdAt: threeHoursAgo,
      },
      {
        title: seedReportTitles[1],
        description:
          "Road-level flooding reported near major routes. Avoid the area if possible.",
        category: "Flood",
        severity: "High",
        status: "Confirmed by Community",
        locationName: "Iba O'Este, Calumpit",
        latitude: 14.908,
        longitude: 120.758,
        sourceType: "Community",
        reportedByName: "Barangay Response Volunteer",
        confirmationCount: 7,
        lastActivityAt: ninetyMinutesAgo,
        createdAt: threeHoursAgo,
      },
      {
        title: seedReportTitles[2],
        description: "Street-level flooding reported. Drive with caution.",
        category: "Road Blocked",
        severity: "Moderate",
        status: "Needs More Confirmation",
        locationName: "Frances, Calumpit",
        latitude: 14.905,
        longitude: 120.78,
        sourceType: "Community",
        reportedByName: "Community Watch",
        confirmationCount: 3,
        lastActivityAt: now,
        createdAt: ninetyMinutesAgo,
      },
    ];

    for (const seedReport of seedReports) {
      const createdReport = await tx.floodReport.create({
        data: {
          ...seedReport,
          incident: {
            create: {
              status: seedReport.status,
              representativeLatitude: seedReport.latitude,
              representativeLongitude: seedReport.longitude,
              locationName: seedReport.locationName,
              severity: seedReport.severity,
              firstReportAt: seedReport.createdAt,
              lastActivityAt: seedReport.lastActivityAt,
            },
          },
        },
      });

      await tx.adminOperationalAction.create({
        data: {
          targetType: "FloodReport",
          targetId: createdReport.id,
          actionType: "status_change",
          previousValue: null,
          nextValue: "pending",
          visibility: "internal",
          note: "Seeded report awaiting administrative review.",
          requestId: "seed:phase0",
        },
      });
    }

    for (const setting of [
      ["operationsCenterName", "Flood Watch operations"],
      ["publicAdvisoryFooter", "Follow official PAGASA and local DRRMO advisories."],
      ["notifyCriticalReports", "true"],
      ["notifyVerificationReminders", "true"],
      ["notifyCapacityWarnings", "true"],
    ] as const) {
      await tx.adminSetting.upsert({
        where: { key: setting[0] },
        update: { value: setting[1], updatedByUserId: null },
        create: { key: setting[0], value: setting[1] },
      });
    }

    await tx.adminNotification.deleteMany({
      where: { dedupeKey: { startsWith: "seed:phase0:" } },
    });
    await tx.adminNotification.createMany({
      data: [
        {
          type: "report_verification",
          title: "Reports awaiting verification",
          detail: "Seeded reports are ready for administrative review.",
          priority: "urgent",
          dedupeKey: "seed:phase0:verification",
        },
        {
          type: "system",
          title: "Admin backend foundation ready",
          detail: "Operational history, settings, and notification storage are configured.",
          priority: "normal",
          dedupeKey: "seed:phase0:foundation",
        },
      ],
    });

    await tx.safetyTip.deleteMany({
      where: {
        title: {
          in: [...safetyTipTitles],
        },
      },
    });

    await tx.safetyTip.createMany({
      data: [
        {
          title: safetyTipTitles[0],
          content:
            "Pack water, food, flashlight, batteries, medicines, clothes, and copies of important documents before heavy rain begins.",
          category: "Before Flood",
          priority: 5,
        },
        {
          title: safetyTipTitles[1],
          content:
            "Moving floodwater can hide open canals, debris, or electrical hazards. Stay on elevated ground whenever possible.",
          category: "During Flood",
          priority: 6,
        },
        {
          title: safetyTipTitles[2],
          content:
            "Switch off the main electrical breaker before leaving your home if flooding is likely to reach sockets or appliances.",
          category: "Evacuation",
          priority: 4,
        },
        {
          title: safetyTipTitles[3],
          content:
            "Listen to barangay and city disaster response teams and evacuate early when official alerts are issued.",
          category: "Evacuation",
          priority: 6,
        },
        {
          title: safetyTipTitles[4],
          content:
            "Clean and disinfect surfaces, utensils, and personal items exposed to floodwater before using them again.",
          category: "After Flood",
          priority: 3,
        },
        {
          title: safetyTipTitles[5],
          content:
            "Save hotline numbers on your phone and write them on paper in case you lose power or battery access.",
          category: "Emergency Kit",
          priority: 2,
        },
      ],
    });

    const aboutSections = [
      {
        sectionKey: "mission",
        title: "Our Mission",
        content:
          "Flood Watch helps communities stay informed about flood risks using timely public-facing updates and location-based awareness tools.",
      },
      {
        sectionKey: "how_it_works",
        title: "How It Works",
        content:
          "The platform combines mapped hazard information, community observations, and emergency guidance into a single monitoring experience.",
      },
      {
        sectionKey: "community_reports",
        title: "Community Reports",
        content:
          "Residents can help strengthen situational awareness by sharing flood observations that add context to developing local conditions.",
      },
      {
        sectionKey: "data_sources",
        title: "Data Sources",
        content:
          "Flood Watch is designed to work alongside official weather agencies, local disaster offices, and community-submitted updates.",
      },
      {
        sectionKey: "disclaimer",
        title: "Disclaimer",
        content:
          "Flood Watch provides community-based flood monitoring information. Reports may come from public users and should be verified with official local authorities during emergencies.",
      },
      {
        sectionKey: "contact",
        title: "Contact",
        content:
          "For corrections, partnership inquiries, or response coordination concerns, reach out through the appropriate local disaster management office.",
      },
    ] as const;

    for (const section of aboutSections) {
      await tx.aboutContent.upsert({
        where: { sectionKey: section.sectionKey },
        update: {
          title: section.title,
          content: section.content,
        },
        create: section,
      });
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Database seed failed.", error);
    await prisma.$disconnect();
    process.exit(1);
  });
