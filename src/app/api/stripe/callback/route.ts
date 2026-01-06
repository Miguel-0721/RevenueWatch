import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const response = await stripe.oauth.token({
    grant_type: "authorization_code",
    code,
  });

 const stripeAccountId = response.stripe_user_id;

if (!stripeAccountId) {
  return NextResponse.json(
    { error: "Stripe account ID missing from OAuth response" },
    { status: 500 }
  );
}


  const user = await prisma.user.findFirst();

  if (!user) {
    return NextResponse.json({ error: "No user found" }, { status: 500 });
  }

await prisma.stripeAccount.upsert({
  where: { stripeAccountId },
  update: {
    status: "active",
  },
  create: {
    stripeAccountId,
    status: "active",
    userId: user.id,
  },
});


  return NextResponse.json({
    success: true,
    stripeAccountId,
  });
}
