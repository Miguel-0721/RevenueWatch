import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";

export async function getLeadsAdminSession() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  if (!isAdminEmail(session.user.email)) {
    return null;
  }

  return session;
}
