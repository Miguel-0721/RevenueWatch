import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function GET() {
  const balance = await stripe.balance.retrieve();

  return NextResponse.json({
    ok: true,
    balance,
  });
}
