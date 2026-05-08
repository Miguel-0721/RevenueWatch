import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "./page.module.css";

function formatRelativeTime(date: Date | null | undefined) {
  if (!date) return "No Stripe events yet";

  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) {
    return `Last event ${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `Last event ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `Last event ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export default async function DashboardAccountsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [accounts, lastEvents] = await Promise.all([
    prisma.stripeAccount.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        stripeAccountId: true,
      },
    }),
    prisma.stripeEvent.groupBy({
      by: ["stripeAccountId"],
      _max: { createdAt: true },
    }),
  ]);

  const lastEventByAccount = new Map(
    lastEvents.map((event) => [event.stripeAccountId, event._max.createdAt ?? null])
  );

  return (
    <section className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1>Connected accounts</h1>
          <p>Review the Stripe accounts RevenueWatch is monitoring and open a detailed account view when something needs attention.</p>
        </div>
        <Link href="/dashboard" className={styles.backLink}>
          Back to dashboard
        </Link>
      </header>

      <div className={styles.content}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Accounts</h2>
            <span className={styles.sectionMeta}>{accounts.length} total</span>
          </div>

          {accounts.length === 0 ? (
            <div className={styles.emptyState}>
              No connected Stripe accounts yet.
            </div>
          ) : (
            <div className={styles.list}>
              {accounts.map((account) => {
                const active = account.status === "active";

                return (
                  <article key={account.id} className={styles.card}>
                    <div className={styles.cardMain}>
                      <div className={styles.cardTitle}>
                        {account.name?.trim() || "Stripe account"}
                      </div>
                      <div className={styles.cardMeta}>
                        {formatRelativeTime(lastEventByAccount.get(account.stripeAccountId))}
                      </div>
                    </div>

                    <div className={styles.cardActions}>
                      <span
                        className={`${styles.status} ${
                          active ? styles.statusActive : styles.statusPaused
                        }`}
                      >
                        {active ? "Monitoring active" : "Paused"}
                      </span>
                      <Link
                        href={`/dashboard/accounts/${encodeURIComponent(account.stripeAccountId)}`}
                        className={styles.detailsLink}
                      >
                        View details
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
