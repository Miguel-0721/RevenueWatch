import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getLeadsAdminSession } from "@/lib/leads-auth";
import { updatePostDraft } from "@/lib/post-draft-store";
import type { PostDraftInput } from "@/lib/post-drafts";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> }
) {
  const session = await getLeadsAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const { draftId } = await params;
  const body = (await request.json()) as Partial<PostDraftInput>;

  const draft = await updatePostDraft(draftId, body);
  if (!draft) {
    return NextResponse.json({ ok: false, error: "Draft not found." }, { status: 404 });
  }

  revalidatePath("/dashboard/leads/post-drafts");
  return NextResponse.json({ ok: true, draft });
}
