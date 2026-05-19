import { NextResponse } from "next/server";
import { getLeadsAdminSession } from "@/lib/leads-auth";
import { discoverXLeads } from "@/lib/leads";

export async function POST() {
  const session = await getLeadsAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const result = await discoverXLeads();

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          result.missingEnv?.length
            ? `Missing X credentials: ${result.missingEnv.join(", ")}`
            : result.error,
        candidates: result.candidates,
      },
      { status: result.missingEnv?.length ? 200 : 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: `Found ${result.candidates.length} X candidates.`,
    candidates: result.candidates,
  });
}
