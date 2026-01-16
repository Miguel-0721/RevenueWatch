import { prisma } from "@/lib/prisma";

type CanTriggerAlertArgs = {
  stripeAccountId: string;
  type: string;
  now?: Date;
};

export async function canTriggerAlert({
  stripeAccountId,
  type,
  now = new Date(),
}: CanTriggerAlertArgs): Promise<boolean> {
  // 1. Active alert still running → block
  const activeAlert = await prisma.alert.findFirst({
    where: {
      stripeAccountId,
      type,
      windowEnd: {
        gt: now,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (activeAlert) {
    return false;
  }

  // 2. Cooldown still active → block
  const lastAlert = await prisma.alert.findFirst({
    where: {
      stripeAccountId,
      type,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (lastAlert?.cooldownUntil && lastAlert.cooldownUntil > now) {
    return false;
  }

  // Safe to trigger
  return true;
}
