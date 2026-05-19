import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getLeadsAdminSession } from "@/lib/leads-auth";
import { updateLead } from "@/lib/lead-store";
import type { LeadCandidate } from "@/lib/leads";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const session = await getLeadsAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const { leadId } = await params;
  const body = (await request.json()) as {
    status?: string;
    notes?: string;
    postText?: string;
    suggestedReply?: string;
    lastContactedAt?: string;
  };

  const lead = await updateLead(leadId, {
    status: body.status as LeadCandidate["status"],
    notes: body.notes,
    postText: body.postText,
    suggestedReply: body.suggestedReply,
    lastContactedAt: body.lastContactedAt ? new Date(body.lastContactedAt) : undefined,
  });

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/leads/discover");
  revalidatePath(`/dashboard/leads/${leadId}`);

  return NextResponse.json({ ok: true, lead });
}
