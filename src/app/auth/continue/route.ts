import { auth } from "@/auth";
import { NextResponse } from "next/server";

function normalizePlan(plan: string | null) {
  if (!plan) {
    return "free";
  }

  const normalized = plan.toLowerCase();

  if (normalized === "growth") {
    return "growth";
  }

  if (normalized === "pro") {
    return "pro";
  }

  return "free";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const plan = normalizePlan(url.searchParams.get("plan"));
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL(`/login?plan=${plan}`, appUrl));
  }

  if (plan === "growth") {
    return NextResponse.redirect(new URL("/api/billing/checkout/growth", appUrl));
  }

  if (plan === "pro") {
    return NextResponse.redirect(new URL("/contact", appUrl));
  }

  return NextResponse.redirect(new URL("/dashboard", appUrl));
}
