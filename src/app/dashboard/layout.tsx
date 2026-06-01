import { auth } from "@/auth";
import StitchIcon from "@/components/dashboard/StitchIcon";
import DashboardSidebarNav from "@/components/dashboard/DashboardSidebarNav";
import DashboardViewportLock from "@/components/dashboard/DashboardViewportLock";
import styles from "@/components/dashboard/DashboardShell.module.css";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <main className={styles.dashboardPage}>
      <DashboardViewportLock />
      <div className={styles.dashboardShell} id="overview-top">
        <div className={styles.sidebarColumn}>
          <aside className={styles.sidebarPanel}>
            <div className={styles.sidebarBrand}>
              <Link href="/dashboard" className={styles.sidebarBrandLink}>
                <div className={styles.sidebarBrandContent}>
                  <div className={styles.sidebarBrandMark}>
                    <StitchIcon name="analytics" className={styles.sidebarBrandMarkIcon} />
                  </div>
                  <div>
                    <div className={styles.sidebarBrandTitle}>Parveil</div>
                    <div className={styles.sidebarBrandSub}>Subscription Health</div>
                  </div>
                </div>
              </Link>
            </div>

            <DashboardSidebarNav />

            <div className={styles.sidebarUserArea}>
              <div className={styles.sidebarProfileLink}>
                <StitchIcon name="account_circle" className={styles.sidebarIcon} />
                <span>Profile</span>
              </div>
            </div>
          </aside>
        </div>

        <div className={styles.mainPanel}>{children}</div>
      </div>
    </main>
  );
}
