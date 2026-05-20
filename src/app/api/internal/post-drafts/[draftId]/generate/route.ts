import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getLeadsAdminSession } from "@/lib/leads-auth";
import { findPostDraftById, updatePostDraft } from "@/lib/post-draft-store";
import { generatePostDraftText } from "@/lib/post-drafts";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ draftId: string }> }
) {
  const session = await getLeadsAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const { draftId } = await params;
  const draft = await findPostDraftById(draftId);
  if (!draft) {
    return NextResponse.json({ ok: false, error: "Draft not found." }, { status: 404 });
  }

  try {
    const postText = await generatePostDraftText({
      title: draft.title,
      postType: draft.postType,
      screenshotNotes: draft.screenshotNotes,
      existingText: draft.postText,
    });

    const updatedDraft = await updatePostDraft(draftId, {
      postText,
    });

    revalidatePath("/dashboard/leads/post-drafts");
    return NextResponse.json({ ok: true, draft: updatedDraft, postText });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not generate the post draft.",
      },
      { status: 500 }
    );
  }
}
