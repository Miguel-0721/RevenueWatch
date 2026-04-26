import type { UserPlan } from "@prisma/client";

export const PLAN_LIMITS: Record<UserPlan, number> = {
  FREE: 1,
  GROWTH: 10,
  PRO: 25,
};

export const PLAN_LABELS: Record<UserPlan, string> = {
  FREE: "Free",
  GROWTH: "Growth",
  PRO: "Pro",
};

export function getPlanLimit(plan: UserPlan) {
  return PLAN_LIMITS[plan];
}

export function getPlanLabel(plan: UserPlan) {
  return PLAN_LABELS[plan];
}
