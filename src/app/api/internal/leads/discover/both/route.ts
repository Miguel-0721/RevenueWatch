import { NextResponse } from "next/server";
import { getLeadsAdminSession } from "@/lib/leads-auth";
import { discoverBothLeadSources } from "@/lib/leads";

export async function POST() {
  const session = await getLeadsAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const result = await discoverBothLeadSources();
  const missingMessages = [
    result.productHunt.ok ? null : result.productHunt.missingEnv?.length
      ? `Product Hunt missing: ${result.productHunt.missingEnv.join(", ")}`
      : result.productHunt.error,
    result.x.ok ? null : result.x.missingEnv?.length
      ? `X missing: ${result.x.missingEnv.join(", ")}`
      : result.x.error,
  ].filter(Boolean);

  return NextResponse.json({
    ok: true,
    message:
      missingMessages.length > 0
        ? missingMessages.join(" | ")
        : `Found ${result.candidates.length} candidates across both sources.`,
    candidates: result.candidates,
  });
}
