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
  "Marikina River Basin Severe Flood Alert",
  "Pasig - Cainta High Flood Risk",
  "Quezon City North Moderate Flood Watch",
] as const;

const evacuationCenterNames = [
  "Marikina Sports Center",
  "Quezon City Memorial Circle Evacuation Area",
  "Pasig City Rainforest Park Evacuation Site",
] as const;

const safetyTipTitles = [
  "Prepare an emergency go bag",
  "Avoid walking through floodwater",
  "Turn off electricity before evacuation",
  "Follow official evacuation instructions",
  "Disinfect items after flooding",
  "Keep emergency contacts accessible",
] as const;

const emergencyContactNames = [
  "National Emergency Hotline 911",
  "NDRRMC",
  "Philippine Red Cross",
  "Bureau of Fire Protection",
  "Philippine National Police",
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

    await tx.floodReport.createMany({
      data: [
        {
          title: seedReportTitles[0],
          description:
            "Water levels are rising and low-lying communities should stay alert.",
          category: "Overflowing River",
          severity: "Critical",
          status: "Confirmed by Community",
          locationName: "Marikina River Basin",
          latitude: 14.6407,
          longitude: 121.1029,
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
          locationName: "Pasig - Cainta Area",
          latitude: 14.5869,
          longitude: 121.1038,
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
          locationName: "Quezon City North",
          latitude: 14.7004,
          longitude: 121.0744,
          sourceType: "Community",
          reportedByName: "Community Watch",
          confirmationCount: 3,
          lastActivityAt: now,
          createdAt: ninetyMinutesAgo,
        },
      ],
    });

    await tx.evacuationCenter.deleteMany({
      where: {
        name: {
          in: [...evacuationCenterNames],
        },
      },
    });

    await tx.evacuationCenter.createMany({
      data: [
        {
          name: evacuationCenterNames[0],
          description:
            "Primary evacuation venue near the Marikina River corridor.",
          address: "Sumulong Highway, Marikina City",
          city: "Marikina City",
          province: "Metro Manila",
          latitude: 14.6353,
          longitude: 121.1016,
          contactNumber: "(02) 8646-2436",
          facilities: ["Sleeping Area", "Medical Desk", "Charging Station"],
          status: "Open",
        },
        {
          name: evacuationCenterNames[1],
          description:
            "Standby site for families from nearby low-lying barangays.",
          address: "Elliptical Road, Diliman, Quezon City",
          city: "Quezon City",
          province: "Metro Manila",
          latitude: 14.6512,
          longitude: 121.0493,
          contactNumber: "(02) 8988-4242",
          facilities: ["Relief Goods", "Restrooms", "Pet Area"],
          status: "Standby",
        },
        {
          name: evacuationCenterNames[2],
          description:
            "Community evacuation area serving Pasig and nearby flood-prone zones.",
          address: "F. Legaspi Bridge, Pasig City",
          city: "Pasig City",
          province: "Metro Manila",
          latitude: 14.5767,
          longitude: 121.0857,
          facilities: ["Open Grounds", "Covered Court", "Water Station"],
          status: "Unknown",
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

    await tx.emergencyContact.deleteMany({
      where: {
        agencyName: {
          in: [...emergencyContactNames],
        },
      },
    });

    await tx.emergencyContact.createMany({
      data: [
        {
          agencyName: emergencyContactNames[0],
          contactNumber: "911",
          region: "National Capital Region",
          description:
            "National emergency dispatch for police, fire, and medical response.",
          isNational: true,
        },
        {
          agencyName: emergencyContactNames[1],
          contactNumber: "(02) 8911-1406",
          region: "National",
          description:
            "National disaster coordination and emergency operations center.",
          isNational: true,
        },
        {
          agencyName: emergencyContactNames[2],
          contactNumber: "143",
          region: "National",
          description:
            "Emergency medical transport, rescue support, and humanitarian assistance.",
          isNational: true,
        },
        {
          agencyName: emergencyContactNames[3],
          contactNumber: "(02) 8426-0219",
          region: "National",
          description:
            "Fire response, rescue dispatch, and emergency assistance.",
          isNational: true,
        },
        {
          agencyName: emergencyContactNames[4],
          contactNumber: "117",
          region: "National",
          description: "Police emergency response and incident coordination.",
          isNational: true,
        },
      ],
    });

    const aboutSections = [
      {
        sectionKey: "mission",
        title: "Our Mission",
        content:
          "FloodWatch PH helps communities stay informed about flood risks using timely public-facing updates and location-based awareness tools.",
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
          "FloodWatch PH is designed to work alongside official weather agencies, local disaster offices, and community-submitted updates.",
      },
      {
        sectionKey: "disclaimer",
        title: "Disclaimer",
        content:
          "FloodWatch PH provides community-based flood monitoring information. Reports may come from public users and should be verified with official local authorities during emergencies.",
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
