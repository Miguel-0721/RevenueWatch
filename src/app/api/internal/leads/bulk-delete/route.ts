import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getLeadsAdminSession } from "@/lib/leads-auth";
import { deleteLeadsByIds } from "@/lib/lead-store";

export async function POST(request: Request) {
  const session = await getLeadsAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json()) as { ids?: string[] };
  const ids = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : [];

  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: "Select at least one lead to delete." }, { status: 400 });
  }

  const deletedCount = await deleteLeadsByIds(ids);

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/leads/discover");

  return NextResponse.json({ ok: true, deletedCount });
}
