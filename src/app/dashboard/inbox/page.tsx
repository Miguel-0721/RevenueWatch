import { auth } from "@/auth";
import CurrentAlertsRail from "@/components/dashboard/CurrentAlertsRail";
import { subscriptionHealthPreview } from "../previewData";
import { formatMoneyAmount } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { getLatestSubscriptionHealthSummary } from "@/lib/subscription-health-store";
import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "./page.module.css";

type DashboardInboxPageProps = {
  searchParams?: Promise<{
    preview?: string;
  }>;
};

type AccountRecord = {
  stripeAccountId: string;
  name: string | null;
  status: string;
};

type ActiveAlertRecord = {
  id: string;
  type: string;
  severity: string;
  message: string;
  stripeAccountId: string | null;
  createdAt: Date;
  context: string | null;
};

function accountDisplayName(name: string | null) {
  return name?.trim() || "Stripe account";
}

function alertLabel(type: string) {
  if (type === "revenue_drop") return "Revenue drop";
  if (type === "payment_failed") return "Payment failures";
  if (type === "subscription_canceled") return "Subscription canceled";
  if (type === "failed_renewal") return "Failed renewal";
  if (type === "subscription_drop") return "Subscription drop";
  if (type === "cancellation_spike") return "Cancellation spike";
  if (type === "failed_renewal_spike") return "Failed renewal spike";
  if (type === "past_due_increase") return "Past-due increase";
  if (type === "unpaid_subscription") return "Unpaid subscription";
  if (type === "unpaid_increase") return "Unpaid increase";
  if (type === "negative_net_subscription_movement") return "Negative net movement";
  if (type === "meaningful_mrr_drop") return "Meaningful MRR drop";
  return type.replace(/_/g, " ");
}

function formatDetectedLabel(date: Date) {
  const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatLastActivity(date: Date | null | undefined) {
  if (!date) return "No Stripe events yet";
  const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} days ago`;
}

function severityRank(severity: string) {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function typeColor(type: string, severity: string) {
  if (
    type === "failed_renewal" ||
    type === "failed_renewal_spike" ||
    type === "past_due_increase" ||
    type === "unpaid_subscription" ||
    type === "unpaid_increase"
  ) {
    return "#9a6700";
  }

  if (
    severity === "critical" ||
    type === "subscription_drop" ||
    type === "cancellation_spike" ||
    type === "negative_net_subscription_movement" ||
    type === "meaningful_mrr_drop"
  ) {
    return "#b42318";
  }

  return "#475569";
}

function statusRank(status: string, severity: string | null) {
  if (status === "paused") return 3;
  if (status !== "active") return 4;
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function getAccountStatusLabel(status: string, severity: string | null) {
  if (status === "paused") return "Paused";
  if (severity === "critical") return "Attention needed";
  if (severity === "warning") return "Review needed";
  return "Monitoring active";
}

function statusTone(status: string) {
  if (status === "Attention needed") return styles.statusAttention;
  if (status === "Review needed") return styles.statusReview;
  if (status === "Monitoring active") return styles.statusMonitoring;
  return styles.statusNeutral;
}

export default async function DashboardInboxPage({ searchParams }: DashboardInboxPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const isPreviewQuery = params?.preview === "subscription-health";

  if (isPreviewQuery) {
    return (
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <div className={styles.headerTitleRow}>
              <h1>Monitoring Inbox</h1>
              <span className={styles.previewBadge}>Preview data</span>
            </div>
            <p>Reviewing 3 items requiring attention across connected accounts.</p>
          </div>
        </header>

        <section className={styles.summaryStrip} aria-label="Inbox summary">
          <article className={styles.summaryCard}>
            <span>Needs review</span>
            <strong>{subscriptionHealthPreview.inboxSummary.needsReview}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>Failed renewals</span>
            <strong>{subscriptionHealthPreview.inboxSummary.failedRenewals}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>Attention needed</span>
            <strong>{subscriptionHealthPreview.inboxSummary.attentionNeeded}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>Reviewed recently</span>
            <strong>{subscriptionHealthPreview.inboxSummary.reviewedRecently}</strong>
          </article>
        </section>

        <CurrentAlertsRail
          alerts={subscriptionHealthPreview.issues}
          pendingLabel={String(subscriptionHealthPreview.inboxSummary.needsReview)}
          detailPlaceholder={
            <div className={styles.placeholder}>
              <h3>Select an issue to review details.</h3>
              <p>
                Open an alert from Needs Review to see account context, current impact, and the
                monitoring-only review actions for that issue.
              </p>
            </div>
          }
        />

        <section className={styles.lowerSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Monitored accounts</h2>
              <p>A compact subscription-health snapshot for each connected Stripe account.</p>
            </div>
            <Link href="/dashboard/accounts" className={styles.sectionLink}>
              View all accounts
            </Link>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.accountsTable}>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Status</th>
                  <th>Active subscriptions</th>
                  <th>Estimated MRR</th>
                  <th>Active alerts</th>
                </tr>
              </thead>
              <tbody>
                {subscriptionHealthPreview.accounts.map((account) => (
                  <tr key={account.stripeAccountId}>
                    <td>
                      <span className={styles.accountLink}>{account.name}</span>
                    </td>
                    <td>
                      <span className={`${styles.statusPill} ${statusTone(account.status)}`}>
                        {account.status}
                      </span>
                    </td>
                    <td>{account.activeSubscriptions}</td>
                    <td>{account.estimatedMrr}</td>
                    <td>{account.activeAlerts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.lowerSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Alert history</h2>
              <p>Recent reviewed alerts stay visible here without competing with Needs Review.</p>
            </div>
            <Link href="/dashboard/alerts" className={styles.sectionLink}>
              Open Alerts
            </Link>
          </div>

          <div className={styles.historyCard}>
            {subscriptionHealthPreview.history.map((alert) => (
              <div key={alert.id} className={styles.historyItem}>
                <div>
                  <strong>{alertLabel(alert.type)}</strong>
                  <span>{alert.accountName}</span>
                </div>
                <small>{alert.time}</small>
              </div>
            ))}
          </div>
        </section>
      </section>
    );
  }

  const accounts = (await prisma.stripeAccount.findMany({
    where: { userId: session.user.id },
    select: {
      stripeAccountId: true,
      name: true,
      status: true,
    },
    orderBy: { createdAt: "desc" },
  })) as AccountRecord[];

  const accountIds = accounts.map((account) => account.stripeAccountId);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [summaries, alerts, recentReviewed, recentReviewedCount, lastEvents] = await Promise.all([
    Promise.all(
      accountIds.map(async (stripeAccountId) => [
        stripeAccountId,
        await getLatestSubscriptionHealthSummary({ stripeAccountId }),
      ] as const)
    ),
    prisma.alert.findMany({
      where: {
        stripeAccountId: { in: accountIds },
        status: "active",
      },
      select: {
        id: true,
        type: true,
        severity: true,
        message: true,
        stripeAccountId: true,
        createdAt: true,
        context: true,
      },
      orderBy: { createdAt: "desc" },
    }) as Promise<ActiveAlertRecord[]>,
    prisma.alert.findMany({
      where: {
        stripeAccountId: { in: accountIds },
        status: { not: "active" },
      },
      select: {
        id: true,
        type: true,
        stripeAccountId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    prisma.alert.count({
      where: {
        stripeAccountId: { in: accountIds },
        status: { not: "active" },
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.stripeEvent.groupBy({
      by: ["stripeAccountId"],
      where: { stripeAccountId: { in: accountIds } },
      _max: { createdAt: true },
    }),
  ]);

  const summaryByAccount = new Map(summaries);
  const lastEventByAccount = new Map(
    lastEvents.map((event) => [event.stripeAccountId, event._max.createdAt ?? null])
  );

  const sortedAlerts = [...alerts].sort((left, right) => {
    const severityDiff = severityRank(left.severity) - severityRank(right.severity);
    if (severityDiff !== 0) return severityDiff;
    return right.createdAt.getTime() - left.createdAt.getTime();
  });

  const alertCountByAccount = new Map<string, number>();
  const topAlertSeverityByAccount = new Map<string, string>();

  for (const alert of sortedAlerts) {
    if (!alert.stripeAccountId) continue;
    alertCountByAccount.set(
      alert.stripeAccountId,
      (alertCountByAccount.get(alert.stripeAccountId) ?? 0) + 1
    );
    if (!topAlertSeverityByAccount.has(alert.stripeAccountId)) {
      topAlertSeverityByAccount.set(alert.stripeAccountId, alert.severity);
    }
  }

  const orderedAccounts = [...accounts]
    .filter((account) => account.status !== "disconnected")
    .sort((left, right) => {
      const rankDiff =
        statusRank(left.status, topAlertSeverityByAccount.get(left.stripeAccountId) ?? null) -
        statusRank(right.status, topAlertSeverityByAccount.get(right.stripeAccountId) ?? null);
      if (rankDiff !== 0) return rankDiff;
      return accountDisplayName(left.name).localeCompare(accountDisplayName(right.name));
    });

  const failedRenewalsCount = sortedAlerts.filter(
    (alert) => alert.type === "failed_renewal" || alert.type === "failed_renewal_spike"
  ).length;
  const attentionCount = sortedAlerts.filter((alert) => alert.severity === "critical").length;

  const railAlerts = sortedAlerts.map((alert) => ({
    id: alert.id,
    accountName: accountDisplayName(
      accounts.find((account) => account.stripeAccountId === alert.stripeAccountId)?.name ?? null
    ),
    type: alert.type,
    typeLabel: alertLabel(alert.type),
    message: alert.message,
    severityKind: alert.severity === "critical" ? ("critical" as const) : ("warning" as const),
    severityLabel: alert.severity === "critical" ? "Attention needed" : "Review needed",
    severityTextColor: alert.severity === "critical" ? "#b42318" : "#9a6700",
    severityBgColor: alert.severity === "critical" ? "#FEF3F2" : "#FFF7E6",
    typeColor: typeColor(alert.type, alert.severity),
    detectedLabel: formatDetectedLabel(alert.createdAt),
    href: alert.stripeAccountId
      ? `/dashboard/accounts/${encodeURIComponent(alert.stripeAccountId)}`
      : "/dashboard/accounts",
    context: alert.context,
    createdAt: alert.createdAt.toISOString(),
  }));
  const hasMeaningfulInboxData =
    railAlerts.length > 0 ||
    orderedAccounts.length > 0 ||
    recentReviewed.length > 0 ||
    summaries.some((entry) => {
      const summary = entry[1];
      return summary
        ? summary.activeSubscriptions > 0 ||
            summary.trialingSubscriptions > 0 ||
            summary.pastDueSubscriptions > 0 ||
            summary.unpaidSubscriptions > 0 ||
            summary.canceledSubscriptions > 0 ||
            summary.failedRenewalPayments > 0 ||
            summary.estimatedMonthlyRevenue > 0 ||
            summary.netSubscriptionMovement !== 0
        : false;
    });
  const shouldShowPreview =
    process.env.NODE_ENV === "development" && !hasMeaningfulInboxData;

  if (shouldShowPreview) {
    return (
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <div className={styles.headerTitleRow}>
              <h1>Monitoring Inbox</h1>
              <span className={styles.previewBadge}>Preview data</span>
            </div>
            <p>Reviewing 3 items requiring attention across connected accounts.</p>
          </div>
        </header>

        <section className={styles.summaryStrip} aria-label="Inbox summary">
          <article className={styles.summaryCard}>
            <span>Needs review</span>
            <strong>{subscriptionHealthPreview.inboxSummary.needsReview}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>Failed renewals</span>
            <strong>{subscriptionHealthPreview.inboxSummary.failedRenewals}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>Attention needed</span>
            <strong>{subscriptionHealthPreview.inboxSummary.attentionNeeded}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>Reviewed recently</span>
            <strong>{subscriptionHealthPreview.inboxSummary.reviewedRecently}</strong>
          </article>
        </section>

        <CurrentAlertsRail
          alerts={subscriptionHealthPreview.issues}
          pendingLabel={String(subscriptionHealthPreview.inboxSummary.needsReview)}
          detailPlaceholder={
            <div className={styles.placeholder}>
              <h3>Select an issue to review details.</h3>
              <p>
                Open an alert from Needs Review to see account context, current impact, and the
                monitoring-only review actions for that issue.
              </p>
            </div>
          }
        />

        <section className={styles.lowerSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Monitored accounts</h2>
              <p>A compact subscription-health snapshot for each connected Stripe account.</p>
            </div>
            <Link href="/dashboard/accounts" className={styles.sectionLink}>
              View all accounts
            </Link>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.accountsTable}>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Status</th>
                  <th>Active subscriptions</th>
                  <th>Estimated MRR</th>
                  <th>Active alerts</th>
                </tr>
              </thead>
              <tbody>
                {subscriptionHealthPreview.accounts.map((account) => (
                  <tr key={account.stripeAccountId}>
                    <td>
                      <span className={styles.accountLink}>{account.name}</span>
                    </td>
                    <td>{account.status}</td>
                    <td>{account.activeSubscriptions}</td>
                    <td>{account.estimatedMrr}</td>
                    <td>{account.activeAlerts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.lowerSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Alert history</h2>
              <p>Recent reviewed alerts stay visible here without competing with Needs Review.</p>
            </div>
            <Link href="/dashboard/alerts" className={styles.sectionLink}>
              Open Alerts
            </Link>
          </div>

          <div className={styles.historyCard}>
            {subscriptionHealthPreview.history.map((alert) => (
              <div key={alert.id} className={styles.historyItem}>
                <div>
                  <strong>{alertLabel(alert.type)}</strong>
                  <span>{alert.accountName}</span>
                </div>
                <small>{alert.time}</small>
              </div>
            ))}
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1>Monitoring Inbox</h1>
          <p>
            {railAlerts.length > 0
              ? `Reviewing ${railAlerts.length} item${railAlerts.length === 1 ? "" : "s"} requiring attention across connected accounts.`
              : "No active alerts need review right now. Parveil is monitoring subscription health across your connected Stripe accounts."}
          </p>
        </div>
      </header>

      <section className={styles.summaryStrip} aria-label="Inbox summary">
        <article className={styles.summaryCard}>
          <span>Needs review</span>
          <strong>{railAlerts.length}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span>Failed renewals</span>
          <strong>{failedRenewalsCount}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span>Attention needed</span>
          <strong>{attentionCount}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span>Reviewed recently</span>
          <strong>{recentReviewedCount}</strong>
        </article>
      </section>

      <CurrentAlertsRail
        alerts={railAlerts}
        pendingLabel={String(railAlerts.length)}
        detailPlaceholder={
          <div className={styles.placeholder}>
            <h3>Select an issue to review details.</h3>
            <p>
              Open an alert from Needs Review to see account context, current impact, and the
              monitoring-only review actions for that issue.
            </p>
          </div>
        }
      />

      <section className={styles.lowerSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Monitored accounts</h2>
            <p>A compact subscription-health snapshot for each connected Stripe account.</p>
          </div>
          <Link href="/dashboard/accounts" className={styles.sectionLink}>
            View all accounts
          </Link>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.accountsTable}>
            <thead>
              <tr>
                <th>Account</th>
                <th>Status</th>
                <th>Active subscriptions</th>
                <th>Estimated MRR</th>
                <th>Active alerts</th>
              </tr>
            </thead>
            <tbody>
              {orderedAccounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.emptyRow}>
                    No connected Stripe accounts yet.
                  </td>
                </tr>
              ) : (
                orderedAccounts.slice(0, 5).map((account) => {
                  const summary = summaryByAccount.get(account.stripeAccountId);
                  const severity = topAlertSeverityByAccount.get(account.stripeAccountId) ?? null;
                  const statusLabel =
                    getAccountStatusLabel(account.status, severity);

                  return (
                    <tr key={account.stripeAccountId}>
                      <td>
                        <Link
                          href={`/dashboard/accounts/${encodeURIComponent(account.stripeAccountId)}`}
                          className={styles.accountLink}
                        >
                          {accountDisplayName(account.name)}
                        </Link>
                      </td>
                      <td>
                        <span className={`${styles.statusPill} ${statusTone(statusLabel)}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td>{summary?.activeSubscriptions ?? 0}</td>
                      <td>
                        {summary
                          ? formatMoneyAmount(summary.estimatedMonthlyRevenue, summary.currency)
                          : "\u2014"}
                      </td>
                      <td>{alertCountByAccount.get(account.stripeAccountId) ?? 0}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.lowerSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Alert history</h2>
            <p>Recent reviewed alerts stay visible here without competing with Needs Review.</p>
          </div>
          <Link href="/dashboard/alerts" className={styles.sectionLink}>
            Open Alerts
          </Link>
        </div>

        <div className={styles.historyCard}>
          {recentReviewed.length === 0 ? (
            <p className={styles.emptyText}>No reviewed alerts yet.</p>
          ) : (
            recentReviewed.map((alert) => (
              <div key={alert.id} className={styles.historyItem}>
                <div>
                  <strong>{alertLabel(alert.type)}</strong>
                  <span>
                    {accountDisplayName(
                      accounts.find((account) => account.stripeAccountId === alert.stripeAccountId)?.name ??
                        null
                    )}
                  </span>
                </div>
                <small>{formatLastActivity(alert.createdAt)}</small>
              </div>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
