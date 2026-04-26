import { auth } from "@/auth";
import { getPlanLimit } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", appUrl ?? "http://localhost:3000"));
  }

  if (!appUrl) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_APP_URL" },
      { status: 500 }
    );
  }

  if (!clientId) {
    return NextResponse.json(
      { error: "Missing STRIPE_CONNECT_CLIENT_ID" },
      { status: 500 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      plan: true,
      stripeAccounts: {
        where: { status: "active" },
        select: { id: true },
      },
    },
  });

  if (!user) {
    return NextResponse.redirect(new URL("/login", appUrl));
  }

  const accountLimit = getPlanLimit(user.plan);
  const connectedAccountCount = user.stripeAccounts.length;

  if (connectedAccountCount >= accountLimit) {
    return NextResponse.redirect(new URL("/billing?limitReached=1", appUrl));
  }

  const redirectUri = `${appUrl}/api/stripe/callback`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "read_write",
    redirect_uri: redirectUri,
  });

  return NextResponse.redirect(
    `https://connect.stripe.com/oauth/authorize?${params.toString()}`
  );
}
