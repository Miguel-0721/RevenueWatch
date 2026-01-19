/**
 * Stripe Connect — OAuth Entry Point
 *
 * This route redirects the user to Stripe's OAuth authorization page.
 *
 * IMPORTANT:
 * - OAuth CANNOT be enabled until KVK + Stripe business activation
 * - Client ID is NOT available yet (post-KVK)
 * - This route is intentionally inert until OAuth is unlocked
 *
 * After KVK:
 * - Insert Stripe Connect Client ID
 * - Enable OAuth in Stripe dashboard
 * - Verify redirect URI matches this route
 *
 * Scope policy:
 * - Read-only access only
 * - No write permissions
 * - No money movement
 */



import { NextResponse } from "next/server";


// Stripe requires `read_write` scope for Connect OAuth.
// We enforce read-only behavior at the application level.
// No write actions are ever performed.


export async function GET() {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.STRIPE_CONNECT_CLIENT_ID!,
    scope: "read_write", // required by Stripe
    redirect_uri: "http://localhost:3000/api/stripe/callback",
  });


// TODO (post-KVK):
// Replace placeholder client_id with real Stripe Connect Client ID
// Client ID becomes available only after:
// 1. KVK registration
// 2. Stripe business activation
// 3. OAuth enabled in Stripe dashboard


  return NextResponse.redirect(
    "https://connect.stripe.com/oauth/authorize?" +
      params.toString()
  );
}
