import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  const trimmedName = body?.name?.trim();

  if (!trimmedName) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (trimmedName.length > 80) {
    return NextResponse.json(
      { error: "Name must be 80 characters or fewer" },
      { status: 400 }
    );
  }

  const account = await prisma.stripeAccount.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    select: {
      id: true,
    },
  });

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const updatedAccount = await prisma.stripeAccount.update({
    where: { id },
    data: { name: trimmedName },
    select: {
      id: true,
      name: true,
      stripeAccountId: true,
    },
  });

  return NextResponse.json({ account: updatedAccount });
}
