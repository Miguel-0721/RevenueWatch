import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { stripeAccountId } = await req.json();

  if (!stripeAccountId) {
    return NextResponse.json(
      { error: "Missing stripeAccountId" },
      { status: 400 }
    );
  }

  try {
    await prisma.stripeAccount.update({
      where: { stripeAccountId },
      data: { status: "disconnected" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to disconnect account" },
      { status: 500 }
    );
  }
}