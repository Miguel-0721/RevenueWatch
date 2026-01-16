import { NextResponse } from "next/server";

export async function GET() {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.STRIPE_CONNECT_CLIENT_ID!,
    scope: "read_write", // required by Stripe
    redirect_uri: "http://localhost:3000/api/stripe/callback",
  });

  return NextResponse.redirect(
    "https://connect.stripe.com/oauth/authorize?" +
      params.toString()
  );
}
