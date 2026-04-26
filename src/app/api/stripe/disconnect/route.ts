import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { stripeAccountId } = await req.json();

  if (!stripeAccountId) {
    return NextResponse.json(
      { error: "Missing stripeAccountId" },
      { status: 400 }
    );
  }

  try {
    const existingAccount = await prisma.stripeAccount.findFirst({
      where: {
        stripeAccountId,
        userId: session.user.id,
      },
      select: {
        status: true,
      },
    });

    if (!existingAccount) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    const nextStatus = existingAccount.status === "paused" ? "active" : "paused";

    const updated = await prisma.stripeAccount.updateMany({
      where: {
        stripeAccountId,
        userId: session.user.id,
      },
      data: { status: nextStatus },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, status: nextStatus });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update account status" },
      { status: 500 }
    );
  }
}
