import { PrismaClient, Priority, JobStatus, TaskType, PriceMode } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Owner (auth is env-password, no DB credential)
  const owner = await prisma.user.upsert({
    where: { email: "owner@braimtracker.local" },
    update: {},
    create: {
      role: "OWNER",
      name: "Owner",
      email: "owner@braimtracker.local",
    },
  });

  // Workers with 4-digit login codes
  const workers = [
    { name: "Mike", code: "1234", rate: 20 },
    { name: "Jake", code: "2345", rate: 18 },
    { name: "Tom", code: "3456", rate: 22 },
  ];

  const workerRecords: Record<string, { id: string; hourlyRate: number }> = {};
  for (const w of workers) {
    const user = await prisma.user.upsert({
      where: { loginCode: w.code },
      update: {},
      create: {
        role: "WORKER",
        name: w.name,
        loginCode: w.code,
        workerProfile: {
          create: { hourlyRate: w.rate, active: true },
        },
      },
      include: { workerProfile: true },
    });
    workerRecords[w.name] = { id: user.id, hourlyRate: w.rate };
  }

  // Zones
  const zoneDefs = [
    { name: "Pool Area", priority: "HIGH" as Priority, description: "Showcase zone around the pool — clean edges, tight pruning, no clutter." },
    { name: "Front Beds", priority: "HIGH" as Priority, description: "Front garden beds visible from the street." },
    { name: "House Perimeter", priority: "NORMAL" as Priority, description: "Perimeter cleanup, weed control, functional trim." },
    { name: "Side Yard", priority: "NORMAL" as Priority, description: "Side yard brush and cleanup." },
    { name: "Outer Yard", priority: "LOW" as Priority, description: "Outer yard / woods edge — minimal-effort maintenance." },
  ];

  const zoneRecords: Record<string, string> = {};
  for (const z of zoneDefs) {
    const existing = await prisma.zone.findFirst({ where: { name: z.name } });
    const zone = existing
      ? await prisma.zone.update({ where: { id: existing.id }, data: z })
      : await prisma.zone.create({ data: z });
    zoneRecords[z.name] = zone.id;
  }

  // Jobs
  const jobsData = [
    {
      title: "Edge and clean pool bed",
      zone: "Pool Area",
      worker: "Mike",
      taskType: "EDGING" as TaskType,
      status: "ASSIGNED" as JobStatus,
      priority: "HIGH" as Priority,
      priceMode: "HOURLY" as PriceMode,
      instructions:
        "Edge the full perimeter of the pool-side bed. Pull any weeds. Leave all existing plants intact. Haul clippings to the brush pile.",
      estimatedHours: 3,
      tasks: ["Edge full perimeter", "Pull weeds", "Haul clippings", "Leave existing plants"],
    },
    {
      title: "Spread mulch in front beds",
      zone: "Front Beds",
      worker: null,
      taskType: "MULCH" as TaskType,
      status: "DRAFT" as JobStatus,
      priority: "NORMAL" as Priority,
      priceMode: "FLAT" as PriceMode,
      flatRate: 200,
      instructions: "Two cubic yards of mulch will be delivered to the driveway. Spread evenly 2\" deep across all front beds.",
      estimatedHours: 4,
      tasks: ["Spread mulch 2\" deep", "Rake smooth", "Sweep driveway after"],
    },
    {
      title: "Clear brush along side yard",
      zone: "Side Yard",
      worker: "Tom",
      taskType: "CLEANUP" as TaskType,
      status: "IN_PROGRESS" as JobStatus,
      priority: "NORMAL" as Priority,
      priceMode: "HOURLY" as PriceMode,
      instructions: "Clear fallen branches and overgrown brush along the side yard fence line. Leave saplings over 1\" diameter.",
      estimatedHours: 2.5,
      tasks: ["Clear fallen branches", "Cut back overgrowth", "Pile debris at curb"],
      openTimer: true,
    },
  ];

  for (const j of jobsData) {
    const existing = await prisma.job.findFirst({ where: { title: j.title } });
    if (existing) continue;

    const workerId = j.worker ? workerRecords[j.worker].id : null;
    const hourlyRate = j.worker ? workerRecords[j.worker].hourlyRate : 20;

    const job = await prisma.job.create({
      data: {
        title: j.title,
        zoneId: zoneRecords[j.zone],
        assignedWorkerId: workerId,
        taskType: j.taskType,
        status: j.status,
        priority: j.priority,
        instructions: j.instructions,
        estimatedHours: j.estimatedHours,
        priceMode: j.priceMode,
        hourlyRate,
        flatRate: j.flatRate ?? null,
        tasks: {
          create: j.tasks.map((label, order) => ({ label, order })),
        },
      },
    });

    await prisma.activityLog.create({
      data: { jobId: job.id, actorId: owner.id, action: "CREATED" },
    });

    if (j.worker) {
      await prisma.activityLog.create({
        data: {
          jobId: job.id,
          actorId: owner.id,
          action: "ASSIGNED",
          meta: { workerName: j.worker },
        },
      });
    }

    if (j.openTimer && workerId) {
      const start = new Date(Date.now() - 45 * 60 * 1000);
      await prisma.timeEntry.create({
        data: { jobId: job.id, workerId, startAt: start },
      });
      await prisma.activityLog.create({
        data: { jobId: job.id, actorId: workerId, action: "STARTED" },
      });
    }
  }

  console.log("Seed complete.");
  console.log("  Owner login:  password = process.env.OWNER_PASSWORD");
  console.log("  Worker codes: Mike=1234  Jake=2345  Tom=3456");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
