import { auth } from "@/auth";
import { getActiveDemoAlerts, hasDemoAccount } from "@/lib/demoData";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "./page.module.css";

type AccountAlertSummary = {
  type: string;
  severity: "critical" | "warning";
  createdAt: Date | null;
};

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

function alertLabel(type: string) {
  if (type === "revenue_drop") return "Revenue Drop Detected";
  if (type === "payment_failed") return "Payment Failure Spike";
  return type.replace(/_/g, " ");
}

function severityRank(severity: "critical" | "warning" | string) {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function statusRank(
  accountStatus: string,
  topAlert: AccountAlertSummary | null
) {
  if (accountStatus !== "active") return 3;
  if (topAlert?.severity === "critical") return 0;
  if (topAlert?.severity === "warning") return 1;
  return 2;
}

function accountDisplayName(name: string | null) {
  return name?.trim() || "Stripe account";
}

export default async function DashboardAccountsPage({
  searchParams,
}: {
  searchParams?: Promise<{ connect?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const connectStatus = resolvedSearchParams?.connect;

  const accounts = await prisma.stripeAccount.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      stripeAccountId: true,
    },
  });

  const accountIds = accounts.map((account) => account.stripeAccountId);

  const [lastEvents, alerts] = await Promise.all([
    prisma.stripeEvent.groupBy({
      by: ["stripeAccountId"],
      where: {
        stripeAccountId: { in: accountIds },
      },
      _max: { createdAt: true },
    }),
    prisma.alert.findMany({
      where: {
        stripeAccountId: { in: accountIds },
        windowEnd: { gt: new Date() },
      },
      select: {
        stripeAccountId: true,
        type: true,
        severity: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);

  const lastEventByAccount = new Map(
    lastEvents.map((event) => [event.stripeAccountId, event._max.createdAt ?? null])
  );
  const demoAccountIds = new Set(accountIds.filter((id) => hasDemoAccount([id])));
  const topAlertByAccount = new Map<string, AccountAlertSummary>();

  if (demoAccountIds.size > 0) {
    for (const [index, alert] of getActiveDemoAlerts().entries()) {
      if (!demoAccountIds.has(alert.id)) continue;
      topAlertByAccount.set(alert.id, {
        type: alert.alertType,
        severity: alert.severity === "high" ? "critical" : "warning",
        createdAt: new Date(Date.now() - index * 60000),
      });
    }
  }

  const activeAlertRecords = alerts
    .filter((alert) => alert.stripeAccountId && !demoAccountIds.has(alert.stripeAccountId))
    .sort((left, right) => {
      const severityDifference = severityRank(left.severity) - severityRank(right.severity);
      if (severityDifference !== 0) return severityDifference;
      return right.createdAt.getTime() - left.createdAt.getTime();
    });

  for (const alert of activeAlertRecords) {
    if (!alert.stripeAccountId || topAlertByAccount.has(alert.stripeAccountId)) continue;
    topAlertByAccount.set(alert.stripeAccountId, {
      type: alert.type,
      severity: alert.severity === "critical" ? "critical" : "warning",
      createdAt: alert.createdAt,
    });
  }

  const sortedAccounts = [...accounts].sort((left, right) => {
    const leftAlert = left.status === "active" ? topAlertByAccount.get(left.stripeAccountId) ?? null : null;
    const rightAlert =
      right.status === "active" ? topAlertByAccount.get(right.stripeAccountId) ?? null : null;

    const rankDifference = statusRank(left.status, leftAlert) - statusRank(right.status, rightAlert);
    if (rankDifference !== 0) return rankDifference;

    if (leftAlert || rightAlert) {
      const leftAlertTime = leftAlert?.createdAt?.getTime() ?? 0;
      const rightAlertTime = rightAlert?.createdAt?.getTime() ?? 0;
      if (leftAlertTime !== rightAlertTime) return rightAlertTime - leftAlertTime;
    }

    const leftLastEvent = lastEventByAccount.get(left.stripeAccountId)?.getTime() ?? 0;
    const rightLastEvent = lastEventByAccount.get(right.stripeAccountId)?.getTime() ?? 0;
    if (leftLastEvent !== rightLastEvent) return rightLastEvent - leftLastEvent;

    return accountDisplayName(left.name).localeCompare(accountDisplayName(right.name));
  });

  return (
    <section className={styles.shell}>
      <div className={styles.stickyIntro}>
        <header className={styles.header}>
          <div>
            <h1>Connected accounts</h1>
            <p>Review the Stripe accounts RevenueWatch is monitoring and open a detailed account view when something needs attention.</p>
          </div>
          <Link href="/api/stripe/connect" className={styles.addAccountLink}>
            Add account
          </Link>
        </header>

        <div className={`${styles.sectionHeader} ${styles.stickySectionHeader}`}>
          <h2>Accounts</h2>
          <span className={styles.sectionMeta}>{accounts.length} total</span>
        </div>
      </div>

      <div className={styles.content}>
        <section className={styles.section}>
          {connectStatus === "cancelled" ? (
            <div className={styles.connectNotice}>
              Stripe connection cancelled. No account was connected.
            </div>
          ) : null}
          <p className={styles.helperText}>Accounts needing review are shown first.</p>
          {accounts.length === 0 ? (
            <div className={styles.emptyState}>
              No connected Stripe accounts yet.
            </div>
          ) : (
            <div className={styles.list}>
              {sortedAccounts.map((account) => {
                const active = account.status === "active";
                const topAlert = active
                  ? topAlertByAccount.get(account.stripeAccountId) ?? null
                  : null;
                const statusVariant = !active
                  ? "paused"
                  : topAlert?.severity === "critical"
                    ? "attention"
                    : topAlert?.severity === "warning"
                      ? "review"
                      : "active";
                const statusLabel =
                  statusVariant === "paused"
                    ? "Monitoring paused"
                    : statusVariant === "attention"
                      ? "Attention needed"
                      : statusVariant === "review"
                        ? "Review needed"
                        : "Monitoring active";
                const cardVariantClass =
                  statusVariant === "attention"
                    ? styles.cardAttention
                    : statusVariant === "review"
                      ? styles.cardReview
                      : statusVariant === "paused"
                        ? styles.cardPaused
                        : "";
                const statusClass =
                  statusVariant === "attention"
                    ? styles.statusAttention
                    : statusVariant === "review"
                      ? styles.statusReview
                      : statusVariant === "paused"
                        ? styles.statusPaused
                        : styles.statusActive;

                return (
                  <article
                    key={account.id}
                    className={`${styles.card}${cardVariantClass ? ` ${cardVariantClass}` : ""}`}
                  >
                    <div className={styles.cardMain}>
                      <div className={styles.cardTitle}>
                        {accountDisplayName(account.name)}
                      </div>
                      <div className={styles.cardMeta}>
                        {formatRelativeTime(lastEventByAccount.get(account.stripeAccountId))}
                      </div>
                      {topAlert ? (
                        <div className={styles.cardSignal}>{alertLabel(topAlert.type)}</div>
                      ) : null}
                    </div>

                    <div className={styles.cardActions}>
                      <span className={`${styles.status} ${statusClass}`}>
                        <span className={styles.statusDot} />
                        {statusLabel}
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
