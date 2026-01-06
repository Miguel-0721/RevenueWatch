import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await prisma.user.create({
    data: {
      email: "test@example.com",
    },
  });

  return NextResponse.json(user);
}
