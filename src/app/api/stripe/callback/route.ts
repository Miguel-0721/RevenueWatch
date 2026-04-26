import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../auth";

function pickDisplayName(account: {
  business_profile?: { name?: string | null } | null;
  email?: string | null;
}) {
  const businessName = account.business_profile?.name?.trim();

  if (businessName) {
    return businessName;
  }

  const email = account.email?.trim();

  if (email) {
    return email;
  }

  return "Stripe account";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  const clientSecret = process.env.STRIPE_SECRET_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!clientId) {
    return NextResponse.json(
      { error: "Missing STRIPE_CONNECT_CLIENT_ID" },
      { status: 500 }
    );
  }

  if (!clientSecret) {
    return NextResponse.json(
      { error: "Missing STRIPE_SECRET_KEY" },
      { status: 500 }
    );
  }

  if (!appUrl) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_APP_URL" },
      { status: 500 }
    );
  }

  if (!code) {
    return NextResponse.json(
      { error: "Missing OAuth code" },
      { status: 400 }
    );
  }

  const redirectUri = `${appUrl}/api/stripe/callback`;

    const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const response = await fetch("https://connect.stripe.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Stripe OAuth error:", data);

      return NextResponse.json(
        { error: "Stripe OAuth failed", details: data },
        { status: 400 }
      );
    }

    const stripeAccountId = data.stripe_user_id;

    if (!stripeAccountId) {
      return NextResponse.json(
        { error: "No stripe_user_id returned", data },
        { status: 400 }
      );
    }

    const accountResponse = await fetch(
      `https://api.stripe.com/v1/accounts/${stripeAccountId}`,
      {
        headers: {
          Authorization: `Bearer ${clientSecret}`,
        },
      }
    );

    let displayName = "Stripe account";

    if (accountResponse.ok) {
      const accountData = (await accountResponse.json()) as {
        business_profile?: { name?: string | null } | null;
        email?: string | null;
      };

      displayName = pickDisplayName(accountData);
    }

    await prisma.stripeAccount.upsert({
      where: { stripeAccountId },
      update: {
        status: "active",
        userId: session.user.id,
        name: displayName,
      },
      create: {
        stripeAccountId,
        status: "active",
        userId: session.user.id,
        name: displayName,
      },
    });

    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (error) {
    console.error("OAuth exception:", error);

    return NextResponse.json(
      { error: "OAuth exception", message: String(error) },
      { status: 500 }
    );
  }
}
