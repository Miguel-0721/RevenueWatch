import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type AccountStatusAction = "pause" | "resume" | "disconnect";
type StripeAccountStatus = "active" | "paused" | "disconnected";

const NEXT_STATUS_BY_ACTION: Record<AccountStatusAction, StripeAccountStatus> = {
  pause: "paused",
  resume: "active",
  disconnect: "disconnected",
};

const ALLOWED_TRANSITIONS: Record<StripeAccountStatus, AccountStatusAction[]> = {
  active: ["pause", "disconnect"],
  paused: ["resume", "disconnect"],
  disconnected: [],
};

function isValidAction(value: unknown): value is AccountStatusAction {
  return value === "pause" || value === "resume" || value === "disconnect";
}

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { stripeAccountId?: string; action?: string } | null = null;

  try {
    body = (await req.json()) as { stripeAccountId?: string; action?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const stripeAccountId = body?.stripeAccountId?.trim();
  const action = body?.action;

  if (!stripeAccountId) {
    return NextResponse.json({ ok: false, error: "Missing stripeAccountId" }, { status: 400 });
  }

  if (!isValidAction(action)) {
    return NextResponse.json({ ok: false, error: "Invalid account action" }, { status: 400 });
  }

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
    return NextResponse.json({ ok: false, error: "Account not found" }, { status: 404 });
  }

  const currentStatus = existingAccount.status as StripeAccountStatus;
  const allowedActions = ALLOWED_TRANSITIONS[currentStatus] ?? [];

  if (!allowedActions.includes(action)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Cannot ${action} an account with status ${currentStatus}`,
        currentStatus,
      },
      { status: 400 }
    );
  }

  const nextStatus = NEXT_STATUS_BY_ACTION[action];

  const updated = await prisma.stripeAccount.updateMany({
    where: {
      stripeAccountId,
      userId: session.user.id,
      status: currentStatus,
    },
    data: {
      status: nextStatus,
    },
  });

  if (updated.count === 0) {
    return NextResponse.json(
      { ok: false, error: "Account status update failed" },
      { status: 409 }
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
  revalidatePath(`/dashboard/accounts/${stripeAccountId}`);
  revalidatePath("/dashboard/alerts");
  revalidatePath("/alerts");

  return NextResponse.json({
    ok: true,
    stripeAccountId,
    action,
    status: nextStatus,
  });
}
