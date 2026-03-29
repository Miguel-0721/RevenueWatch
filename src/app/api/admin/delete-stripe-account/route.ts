import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { stripeAccountId } = await req.json();

    if (!stripeAccountId) {
      return NextResponse.json(
        { error: "Missing stripeAccountId" },
        { status: 400 }
      );
    }

    await prisma.alert.deleteMany({
      where: { stripeAccountId },
    });

    await prisma.revenueMetric.deleteMany({
      where: { stripeAccountId },
    });

    await prisma.stripeEvent.deleteMany({
      where: { stripeAccountId },
    });

    await prisma.stripeAccount.deleteMany({
      where: { stripeAccountId },
    });

    return NextResponse.json({
      success: true,
      deletedStripeAccountId: stripeAccountId,
    });
  } catch (error) {
    console.error("Delete stripe account cleanup failed:", error);

    return NextResponse.json(
      { error: "Failed to delete Stripe account data" },
      { status: 500 }
    );
  }
}