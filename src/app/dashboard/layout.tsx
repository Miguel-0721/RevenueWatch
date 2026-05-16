import { auth, signOut } from "@/auth";
import RevenueWatchLogo from "@/components/RevenueWatchLogo";
import DashboardSidebarNav from "@/components/dashboard/DashboardSidebarNav";
import DashboardViewportLock from "@/components/dashboard/DashboardViewportLock";
import styles from "@/components/dashboard/DashboardShell.module.css";
import Link from "next/link";
import { redirect } from "next/navigation";

function getUserDisplayName(name?: string | null, email?: string | null) {
  return name?.trim() || email?.split("@")[0] || "Signed in";
}

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const sessionDisplayName = getUserDisplayName(session.user.name, session.user.email);
  const sessionInitial =
    (session.user.name?.[0] || session.user.email?.[0] || "U").toUpperCase();

  return (
    <main className={styles.dashboardPage}>
      <DashboardViewportLock />
      <div className={styles.dashboardShell} id="overview-top">
        <div className={styles.sidebarColumn}>
          <aside className={styles.sidebarPanel}>
            <div className={styles.sidebarBrand}>
              <Link href="/dashboard" className={styles.sidebarBrandLink}>
                <div className={styles.sidebarBrandContent}>
                  <RevenueWatchLogo className={styles.sidebarBrandLogo} compact size="sidebar" />
                  <div className={styles.sidebarBrandSub}>MONITORING CENTER</div>
                </div>
              </Link>
            </div>

            <DashboardSidebarNav />

            <div className={styles.sidebarUserArea}>
              <div className={styles.sidebarUserIdentity}>
                <div className={styles.sidebarUserAvatar}>{sessionInitial}</div>
                <div className={styles.sidebarUserMeta}>
                  <span className={styles.sidebarUserName}>{sessionDisplayName}</span>
                  <span className={styles.sidebarUserEmail}>Signed in</span>
                </div>
              </div>

              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button type="submit" className={styles.sidebarSignOut}>
                  Sign out
                </button>
              </form>
            </div>
          </aside>
        </div>

        <div className={styles.mainPanel}>{children}</div>
      </div>
    </main>
  );
}
