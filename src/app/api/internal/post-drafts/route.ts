import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getLeadsAdminSession } from "@/lib/leads-auth";
import { createPostDraft, listPostDrafts } from "@/lib/post-draft-store";
import type { PostDraftInput } from "@/lib/post-drafts";

export async function GET() {
  const session = await getLeadsAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const drafts = await listPostDrafts();
  return NextResponse.json({ ok: true, drafts });
}

export async function POST(request: Request) {
  const session = await getLeadsAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json()) as PostDraftInput;
  if (!body?.title?.trim()) {
    return NextResponse.json({ ok: false, error: "Draft title is required." }, { status: 400 });
  }

  const draft = await createPostDraft({
    ...body,
    title: body.title.trim(),
    status: body.status ?? "draft",
  });

  revalidatePath("/dashboard/leads/post-drafts");
  revalidatePath("/dashboard/leads");

  return NextResponse.json({ ok: true, draft });
}
