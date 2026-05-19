import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getLeadsAdminSession } from "@/lib/leads-auth";
import { findLeadById, updateLead } from "@/lib/lead-store";
import { generateLeadReply, type LeadRecord, type ReplyType } from "@/lib/leads";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const session = await getLeadsAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const { leadId } = await params;
  const body = (await request.json()) as {
    inputText?: string;
    replyType?: ReplyType;
  };

  if (!body.inputText?.trim()) {
    return NextResponse.json({ ok: false, error: "Paste a post or message first." }, { status: 400 });
  }

  const lead = (await findLeadById(leadId)) as LeadRecord | null;

  if (!lead) {
    return NextResponse.json({ ok: false, error: "Lead not found." }, { status: 404 });
  }

  try {
    const reply = await generateLeadReply({
      lead,
      inputText: body.inputText,
      replyType: body.replyType ?? "public_reply",
    });

    await updateLead(leadId, {
      postText: body.inputText,
      suggestedReply: reply,
    });

    revalidatePath(`/dashboard/leads/${leadId}`);

    return NextResponse.json({ ok: true, reply });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Reply generation failed.",
      },
      { status: 500 }
    );
  }
}
