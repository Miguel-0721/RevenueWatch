import { NextResponse } from "next/server";

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;

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