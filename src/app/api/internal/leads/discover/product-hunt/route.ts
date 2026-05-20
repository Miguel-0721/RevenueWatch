import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getLeadsAdminSession } from "@/lib/leads-auth";
import { discoverProductHuntLeads } from "@/lib/leads";
import {
  createLead,
  findDuplicateLead,
  listDiscoveredProductHuntLeads,
  updateLead,
} from "@/lib/lead-store";

const REVIEWED_STATUSES = new Set([
  "saved",
  "skipped",
  "contacted",
  "replied",
  "interested",
  "trial_offered",
  "connected_stripe",
  "customer",
  "not_fit",
  "no_response",
]);

export async function POST() {
  const session = await getLeadsAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const result = await discoverProductHuntLeads();

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          result.missingEnv?.length
            ? `Missing Product Hunt credentials: ${result.missingEnv.join(", ")}`
            : result.error,
        candidates: result.candidates,
      },
      { status: result.missingEnv?.length ? 200 : 500 }
    );
  }

  for (const candidate of result.candidates) {
    const existing = await findDuplicateLead(candidate);

    if (existing) {
      await updateLead(existing.id, {
        ...candidate,
        status: REVIEWED_STATUSES.has(existing.status) ? (existing.status as any) : "new",
        notes: existing.notes ?? candidate.notes ?? null,
        suggestedReply: existing.suggestedReply ?? candidate.suggestedReply ?? null,
        lastContactedAt: existing.lastContactedAt ?? null,
      });
      continue;
    }

    await createLead({
      ...candidate,
      status: "new",
    });
  }

  const persistedCandidates = await listDiscoveredProductHuntLeads();

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/leads/discover");

  return NextResponse.json({
    ok: true,
    message:
      result.message ??
      `Showing ${persistedCandidates.length} Product Hunt candidates ranked by fit.`,
    candidates: persistedCandidates,
  });
}
