import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  console.log("🔁 OAuth callback hit");
  console.log("Code:", code);

  if (!code) {
    return NextResponse.json(
      { error: "Missing OAuth code" },
      { status: 400 }
    );
  }

  try {
    console.log("🔐 Exchanging code for token...");

    const response = await fetch(
      "https://connect.stripe.com/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: process.env.STRIPE_CLIENT_ID!,
          client_secret: process.env.STRIPE_SECRET_KEY!, // IMPORTANT
        }),
      }
    );

    const text = await response.text();
    console.log("Stripe raw response:", text);

    const data = JSON.parse(text);

    if (!response.ok) {
      console.error("❌ Stripe OAuth error:", data);
      return NextResponse.json(
        { error: "Stripe OAuth failed", details: data },
        { status: 400 }
      );
    }

    const stripeAccountId = data.stripe_user_id;
    console.log("✅ Connected account:", stripeAccountId);

    if (!stripeAccountId) {
      return NextResponse.json(
        { error: "No stripe_user_id returned", data },
        { status: 400 }
      );
    }

await prisma.stripeAccount.upsert({
  where: { stripeAccountId },
  update: {
    status: "active",
  },
  create: {
    stripeAccountId,
    status: "active",
  },
});





    console.log("💾 Stripe account saved");

    return NextResponse.redirect(
      new URL("/dashboard", req.url)
    );
  } catch (err) {
    console.error("🔥 OAuth exception FULL:", err);
    return NextResponse.json(
      { error: "OAuth exception", message: String(err) },
      { status: 500 }
    );
  }
}
