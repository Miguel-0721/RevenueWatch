import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getLeadsAdminSession } from "@/lib/leads-auth";
import { createLead, findDuplicateLead, listLeads, updateLead } from "@/lib/lead-store";
import {
  prepareLeadCandidate,
  type LeadCandidate,
} from "@/lib/leads";

export async function GET() {
  const session = await getLeadsAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const leads = await listLeads({});

  return NextResponse.json({ ok: true, leads });
}

export async function POST(request: Request) {
  const session = await getLeadsAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json()) as LeadCandidate;
  if (!body?.name?.trim()) {
    return NextResponse.json({ ok: false, error: "Lead name is required." }, { status: 400 });
  }

  const prepared = await prepareLeadCandidate({
    ...body,
    source: (body.source ?? "manual") as LeadCandidate["source"],
    status: (body.status ?? "saved") as LeadCandidate["status"],
  });

  const existing = await findDuplicateLead(prepared);

  let lead;
  if (existing) {
    lead = await updateLead(existing.id, {
      ...prepared,
      notes: prepared.notes ?? existing.notes,
      suggestedReply: prepared.suggestedReply ?? existing.suggestedReply,
    });
  } else {
    lead = await createLead(prepared);
  }

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/leads/discover");
  revalidatePath(`/dashboard/leads/${lead.id}`);

  return NextResponse.json({ ok: true, lead });
}
