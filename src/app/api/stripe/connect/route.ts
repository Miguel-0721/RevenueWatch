import { NextResponse } from "next/server";

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.STRIPE_CONNECT_CLIENT_ID!,
    scope: "read_write",
    response_type: "code",
    redirect_uri: `${process.env.APP_URL}/api/stripe/callback`,
  });

  const url = `https://connect.stripe.com/oauth/authorize?${params.toString()}`;

  return NextResponse.redirect(url);
}
