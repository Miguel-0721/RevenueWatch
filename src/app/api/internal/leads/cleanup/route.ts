import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getLeadsAdminSession } from "@/lib/leads-auth";
import {
  clearAllLeads,
  clearDiscoveredProductHuntLeads,
  clearSkippedLeads,
} from "@/lib/lead-store";

export async function POST(request: Request) {
  const session = await getLeadsAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json()) as { mode?: string };

  let deletedCount = 0;

  if (body.mode === "skipped") {
    deletedCount = await clearSkippedLeads();
  } else if (body.mode === "product-hunt-new") {
    deletedCount = await clearDiscoveredProductHuntLeads();
  } else if (body.mode === "all") {
    deletedCount = await clearAllLeads();
  } else {
    return NextResponse.json({ ok: false, error: "Unsupported cleanup mode." }, { status: 400 });
  }

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/leads/discover");

  return NextResponse.json({ ok: true, deletedCount });
}
