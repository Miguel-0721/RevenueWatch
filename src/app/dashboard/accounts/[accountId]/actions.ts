"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type RenameAccountState = {
  error?: string;
  success?: boolean;
};

export type MarkAlertReviewedState = {
  error?: string;
  success?: boolean;
};

export async function renameAccountAction(
  _previousState: RenameAccountState,
  formData: FormData
): Promise<RenameAccountState> {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "You must be signed in to rename an account." };
  }

  const accountId = formData.get("accountId");
  const name = formData.get("name");

  if (typeof accountId !== "string" || !accountId.trim()) {
    return { error: "Account not found." };
  }

  if (typeof name !== "string") {
    return { error: "Enter a valid account name." };
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return { error: "Account name cannot be empty." };
  }

  const result = await prisma.stripeAccount.updateMany({
    where: {
      stripeAccountId: accountId,
      userId: session.user.id,
    },
    data: {
      name: trimmedName,
    },
  });

  if (result.count === 0) {
    return { error: "We couldn't update that account." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
  revalidatePath(`/dashboard/accounts/${accountId}`);
  revalidatePath("/dashboard/alerts");
  revalidatePath("/alerts");

  return { success: true };
}

export async function markAlertReviewedAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const alertId = formData.get("alertId");
  const stripeAccountId = formData.get("stripeAccountId");

  if (typeof alertId !== "string" || !alertId.trim()) {
    redirect("/dashboard/accounts");
  }

  if (typeof stripeAccountId !== "string" || !stripeAccountId.trim()) {
    redirect("/dashboard/accounts");
  }

  const account = await prisma.stripeAccount.findFirst({
    where: {
      stripeAccountId,
      userId: session.user.id,
    },
    select: {
      stripeAccountId: true,
    },
  });

  if (!account) {
    redirect("/dashboard/accounts");
  }

  await prisma.alert.updateMany({
    where: {
      id: alertId,
      stripeAccountId,
      status: "active",
    },
    data: {
      status: "resolved",
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
  revalidatePath(`/dashboard/accounts/${stripeAccountId}`);
  revalidatePath("/dashboard/alerts");
  revalidatePath("/alerts");

  redirect(`/dashboard/accounts/${stripeAccountId}`);
}
