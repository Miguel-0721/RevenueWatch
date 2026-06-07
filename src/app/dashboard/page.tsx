import { auth } from "@/auth";
import ConnectedAccountsTable from "@/components/dashboard/ConnectedAccountsTable";
import {
  getDashboardSparklinePoints,
  MetricCard,
  SecondaryMetricCard,
} from "@/components/dashboard/SubscriptionHealthMetricCards";
import { formatMoneyAmount } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import {
  getLatestSubscriptionHealthSummary,
  getSubscriptionHealthKpiPeriodMetrics,
} from "@/lib/subscription-health-store";
import { syncUserPlanFromStripe } from "@/lib/subscription-sync";
import Link from "next/link";
import { redirect } from "next/navigation";
import { previewAccountDetails, subscriptionHealthPreview } from "./previewData";
import styles from "./page.module.css";

type DashboardPageProps = {
  searchParams?: Promise<{
    billing?: string;
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
  stripeAccountId: string | null;
  createdAt: Date;
  context: string | null;
};

type HistoryAlertRecord = {
  id: string;
  type: string;
  stripeAccountId: string | null;
  createdAt: Date;
};

type OverviewIssueSummary = {
  id: string;
  label: string;
  accountName: string;
  impact: string;
  statusLabel: string;
  detectedAt?: string;
};

type OverviewAccountRow = {
  stripeAccountId: string;
  name: string;
  statusLabel: string;
  activeSubscriptions: number;
  estimatedMrr: string;
  activeAlerts: number;
  lastActivity: string;
  href?: string;
};

type OverviewHistoryRow = {
  id: string;
  label: string;
  accountName: string;
  time: string;
};

type DashboardViewModel = {
  previewMode: boolean;
  scopeCountLabel: string;
  totalActiveIssues: number;
  primaryMetrics: {
    activeSubscriptions: number | string;
    estimatedMrr: string;
    needsReview: number | string;
    failedRenewals: number | string;
  };
  secondaryMetrics: {
    trialing: number | string;
    pastDue: number | string;
    unpaid: number | string;
    canceled: number | string;
    netMovement: number | string;
  };
  issues: OverviewIssueSummary[];
  accounts: OverviewAccountRow[];
  history: OverviewHistoryRow[];
  inboxHref: string;
};

type SummaryRecord = Awaited<ReturnType<typeof getLatestSubscriptionHealthSummary>>;

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

function severityRank(severity: string) {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function issueTypePriority(type: string) {
  if (type === "subscription_drop") return 0;
  if (type === "cancellation_spike") return 1;
  if (type === "past_due_increase") return 2;
  if (type === "unpaid_increase" || type === "unpaid_subscription") return 3;
  if (type === "negative_net_subscription_movement") return 4;
  if (type === "failed_renewal_spike" || type === "failed_renewal") return 5;
  if (type === "meaningful_mrr_drop") return 6;
  if (type === "subscription_canceled") return 7;
  return 8;
}

function statusRank(status: string, severity: string | null) {
  if (status === "paused") return 3;
  if (status !== "active") return 4;
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
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

function formatResolvedTime(date: Date) {
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseAlertContext(context: string | null) {
  if (!context) return null;
  try {
    return JSON.parse(context) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function statusTone(status: string) {
  if (status === "Attention needed") return styles.statusAttention;
  if (status === "Review needed") return styles.statusReview;
  if (status === "Monitoring active") return styles.statusMonitoring;
  return styles.statusNeutral;
}

function getAccountStatusLabel(status: string, severity: string | null) {
  if (status === "paused") return "Paused";
  if (severity === "critical") return "Attention needed";
  if (severity === "warning") return "Review needed";
  return "Monitoring active";
}

function buildAlertImpact(
  alert: Pick<ActiveAlertRecord, "type" | "context">,
  currency: string,
) {
  const context = parseAlertContext(alert.context);

  if (alert.type === "failed_renewal") {
    const amountDue = typeof context?.amountDue === "number" ? context.amountDue : null;
    if (amountDue !== null) return `${formatMoneyAmount(amountDue, currency)} at risk`;
  }

  if (alert.type === "subscription_canceled") {
    const amount =
      typeof context?.estimatedMonthlyRevenue === "number"
        ? context.estimatedMonthlyRevenue
        : null;
    if (amount !== null) return `${formatMoneyAmount(amount, currency)} impact`;
  }

  if (alert.type === "subscription_drop") {
    const previous =
      typeof context?.previousActiveSubscriptions === "number"
        ? context.previousActiveSubscriptions
        : null;
    const current =
      typeof context?.currentActiveSubscriptions === "number"
        ? context.currentActiveSubscriptions
        : null;
    if (previous !== null && current !== null) return `${previous} -> ${current} active`;
  }

  if (alert.type === "cancellation_spike") {
    const baselineCancellations =
      typeof context?.baselineDailyCancellations === "number"
        ? context.baselineDailyCancellations
        : typeof context?.baselineCancellations === "number"
          ? context.baselineCancellations
          : null;
    const currentCancellations =
      typeof context?.currentDayCancellations === "number"
        ? context.currentDayCancellations
        : typeof context?.currentCancellations === "number"
          ? context.currentCancellations
          : null;
    if (baselineCancellations !== null && currentCancellations !== null) {
      return `${Math.round(baselineCancellations)} -> ${currentCancellations} cancels`;
    }
  }

  if (alert.type === "past_due_increase") {
    const previous =
      typeof context?.previousPastDueSubscriptions === "number"
        ? context.previousPastDueSubscriptions
        : 0;
    const current =
      typeof context?.currentPastDueSubscriptions === "number"
        ? context.currentPastDueSubscriptions
        : null;
    if (current !== null) return `${previous} -> ${current} past due`;
  }

  if (alert.type === "unpaid_subscription") {
    const unpaid =
      typeof context?.unpaidSubscriptions === "number" ? context.unpaidSubscriptions : null;
    if (unpaid !== null) return `${unpaid} unpaid`;
  }

  if (alert.type === "unpaid_increase") {
    const unpaid =
      typeof context?.currentUnpaidSubscriptions === "number"
        ? context.currentUnpaidSubscriptions
        : null;
    if (unpaid !== null) return `${unpaid} unpaid`;
  }

  if (alert.type === "failed_renewal_spike") {
    const current =
      typeof context?.currentDayFailedRenewals === "number"
        ? context.currentDayFailedRenewals
        : null;
    const baselineFailedRenewals =
      typeof context?.baselineDailyFailedRenewals === "number"
        ? context.baselineDailyFailedRenewals
        : null;
    if (current !== null && baselineFailedRenewals !== null) {
      return `${Math.round(baselineFailedRenewals)} -> ${current} failed`;
    }
    if (current !== null) return `${current} failed renewals`;
  }

  if (alert.type === "negative_net_subscription_movement") {
    const added =
      typeof context?.currentDayNewSubscriptions === "number"
        ? context.currentDayNewSubscriptions
        : null;
    const lost =
      typeof context?.currentDayCancellations === "number"
        ? context.currentDayCancellations
        : null;
    if (added !== null && lost !== null) return `${added} added · ${lost} lost`;
  }

  if (alert.type === "meaningful_mrr_drop") {
    const current =
      typeof context?.currentEstimatedMonthlyRevenue === "number"
        ? context.currentEstimatedMonthlyRevenue
        : null;
    if (current !== null) return `${formatMoneyAmount(current, currency)} current`;
  }

  return "Needs review";
}

function buildPreviewDashboardViewModel(): DashboardViewModel {
  const previewIssues: OverviewIssueSummary[] = [
    {
      id: "preview-subscription-canceled",
      label: "Subscription canceled",
      accountName: "Northstar Commerce",
      impact: "\u20ac39 impact",
      statusLabel: "Review needed",
      detectedAt: "12m ago",
    },
    {
      id: "preview-failed-renewal",
      label: "Failed renewal",
      accountName: "BluePeak Studio",
      impact: "\u20ac39 at risk",
      statusLabel: "Review needed",
      detectedAt: "45m ago",
    },
    {
      id: "preview-subscription-drop",
      label: "Subscription drop detected",
      accountName: "Cedar Labs",
      impact: "10 -> 7 active",
      statusLabel: "Attention needed",
      detectedAt: "2h ago",
    },
  ];

  const previewHrefByAccountId = new Map(
    Object.values(previewAccountDetails).map((account) => [
      account.stripeAccountId,
      `/dashboard/accounts/${account.slug}?preview=subscription-health`,
    ]),
  );

  const previewAccounts: OverviewAccountRow[] = subscriptionHealthPreview.accounts.map((account) => ({
    stripeAccountId: account.stripeAccountId,
    name: account.name,
    statusLabel: account.status,
    activeSubscriptions: account.activeSubscriptions,
    estimatedMrr: account.estimatedMrr,
    activeAlerts: account.activeAlerts,
    lastActivity: account.lastActivity,
    href: previewHrefByAccountId.get(account.stripeAccountId),
  }));

  const previewHistory: OverviewHistoryRow[] = subscriptionHealthPreview.history.map((alert) => ({
    id: alert.id,
    label: alertLabel(alert.type),
    accountName: alert.accountName,
    time: alert.time,
  }));

  return {
    previewMode: true,
    scopeCountLabel: "3 connected Stripe accounts",
    totalActiveIssues: subscriptionHealthPreview.overview.needsReview,
    primaryMetrics: {
      activeSubscriptions: subscriptionHealthPreview.overview.activeSubscriptions,
      estimatedMrr: subscriptionHealthPreview.overview.estimatedMrr,
      needsReview: subscriptionHealthPreview.overview.needsReview,
      failedRenewals: subscriptionHealthPreview.overview.failedRenewals,
    },
    secondaryMetrics: {
      trialing: subscriptionHealthPreview.overview.trialing,
      pastDue: subscriptionHealthPreview.overview.pastDue,
      unpaid: subscriptionHealthPreview.overview.unpaid,
      canceled: "5",
      netMovement: "+18",
    },
    issues: previewIssues,
    accounts: previewAccounts,
    history: previewHistory,
    inboxHref: "/dashboard/inbox?preview=subscription-health",
  };
}

function buildRealDashboardViewModel({
  orderedAccounts,
  accounts,
  sortedAlerts,
  prioritizedAlerts,
  recentHistory,
  summaryByAccount,
  lastEventByAccount,
  activeAlertCountByAccount,
  topAlertSeverityByAccount,
  totals,
  displayCurrency,
}: {
  orderedAccounts: AccountRecord[];
  accounts: AccountRecord[];
  sortedAlerts: ActiveAlertRecord[];
  prioritizedAlerts: ActiveAlertRecord[];
  recentHistory: HistoryAlertRecord[];
  summaryByAccount: Map<string, SummaryRecord>;
  lastEventByAccount: Map<string, Date | null>;
  activeAlertCountByAccount: Map<string, number>;
  topAlertSeverityByAccount: Map<string, string>;
  totals: {
    activeSubscriptions: number;
    trialingSubscriptions: number;
    pastDueSubscriptions: number;
    unpaidSubscriptions: number;
    cancellationsLast7Days: number;
    failedRenewalsLast7Days: number;
    estimatedMonthlyRevenue: number;
    netSubscriptionsThisMonth: number;
  };
  displayCurrency: string;
}): DashboardViewModel {
  const issueSummaries: OverviewIssueSummary[] = prioritizedAlerts.slice(0, 3).map((alert) => {
    const accountName = accountDisplayName(
      accounts.find((account) => account.stripeAccountId === alert.stripeAccountId)?.name ?? null,
    );
    const accountSummary = summaryByAccount.get(alert.stripeAccountId ?? "");
    const currency = accountSummary?.currency ?? displayCurrency;

    return {
      id: alert.id,
      label: alertLabel(alert.type),
      accountName,
      impact: buildAlertImpact(alert, currency),
      statusLabel: alert.severity === "critical" ? "Attention needed" : "Review needed",
      detectedAt: formatLastActivity(alert.createdAt),
    };
  });

  const overviewAccounts: OverviewAccountRow[] = orderedAccounts.map((account) => {
    const summary = summaryByAccount.get(account.stripeAccountId);
    const severity = topAlertSeverityByAccount.get(account.stripeAccountId) ?? null;

    return {
      stripeAccountId: account.stripeAccountId,
      name: accountDisplayName(account.name),
      statusLabel: getAccountStatusLabel(account.status, severity),
      activeSubscriptions: summary?.activeSubscriptions ?? 0,
      estimatedMrr: summary
        ? formatMoneyAmount(summary.estimatedMonthlyRevenue, summary.currency)
        : "\u2014",
      activeAlerts: activeAlertCountByAccount.get(account.stripeAccountId) ?? 0,
      lastActivity: formatLastActivity(lastEventByAccount.get(account.stripeAccountId)),
      href: `/dashboard/accounts/${account.stripeAccountId}`,
    };
  });

  const overviewHistory: OverviewHistoryRow[] = recentHistory.map((alert) => ({
    id: alert.id,
    label: alertLabel(alert.type),
    accountName: accountDisplayName(
      accounts.find((account) => account.stripeAccountId === alert.stripeAccountId)?.name ?? null,
    ),
    time: formatResolvedTime(alert.createdAt),
  }));

  return {
    previewMode: false,
    scopeCountLabel: `${orderedAccounts.length} connected Stripe account${orderedAccounts.length === 1 ? "" : "s"}`,
    totalActiveIssues: sortedAlerts.length,
    primaryMetrics: {
      activeSubscriptions: totals.activeSubscriptions,
      estimatedMrr: formatMoneyAmount(totals.estimatedMonthlyRevenue, displayCurrency),
      needsReview: sortedAlerts.length,
      failedRenewals: totals.failedRenewalsLast7Days,
    },
    secondaryMetrics: {
      trialing: totals.trialingSubscriptions,
      pastDue: totals.pastDueSubscriptions,
      unpaid: totals.unpaidSubscriptions,
      canceled: totals.cancellationsLast7Days,
      netMovement: `${totals.netSubscriptionsThisMonth >= 0 ? "+" : ""}${totals.netSubscriptionsThisMonth}`,
    },
    issues: issueSummaries,
    accounts: overviewAccounts,
    history: overviewHistory,
    inboxHref: "/dashboard/inbox",
  };
}

function DashboardOverview({
  previewMode,
  scopeCountLabel,
  totalActiveIssues,
  primaryMetrics,
  secondaryMetrics,
  issues,
  accounts,
  history,
  inboxHref,
}: DashboardViewModel) {
  const metricLinks = previewMode
      ? {
        activeSubscriptions: "/dashboard/subscriptions?preview=subscription-health&type=active",
        failedRenewals:
          "/dashboard/subscriptions?preview=subscription-health&type=failed-renewal&window=7d",
        pastDue: "/dashboard/subscriptions?preview=subscription-health&type=past-due",
        trialing: "/dashboard/subscriptions?preview=subscription-health&type=trialing",
        unpaid: "/dashboard/subscriptions?preview=subscription-health&type=unpaid",
        canceled: "/dashboard/subscriptions?preview=subscription-health&type=canceled&window=7d",
      }
    : {
        activeSubscriptions: "/dashboard/subscriptions?type=active",
        failedRenewals: "/dashboard/subscriptions?type=failed-renewal&window=7d",
        pastDue: "/dashboard/subscriptions?type=past-due",
        trialing: "/dashboard/subscriptions?type=trialing",
        unpaid: "/dashboard/subscriptions?type=unpaid",
        canceled: "/dashboard/subscriptions?type=canceled&window=7d",
      };
  const activeSubscriptionsBadge = previewMode ? "+4.2% this month" : "Collecting trend";
  const estimatedMrrBadge = previewMode ? "+1.8% this month" : "Collecting trend";

  return (
    <section className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerIntro}>
            <div className={styles.headerTitleRow}>
              <h1>Subscription health overview</h1>
              {previewMode ? <span className={styles.previewBadge}>Preview data</span> : null}
            </div>
            <p>
              Monitor active subscriptions, MRR, failed renewals, cancellations, and subscription
              movement across your connected Stripe accounts.
            </p>
          </div>

          <div className={styles.scopeSummary}>
            <span className={styles.scopeChip}>All accounts</span>
            <span className={styles.scopeDivider} aria-hidden="true">
              {"\u00b7"}
            </span>
            <span className={styles.scopeMeta}>{scopeCountLabel}</span>
          </div>
        </div>
      </header>

      <section className={styles.primaryMetrics}>
        <MetricCard
          label="Active subscriptions"
          value={primaryMetrics.activeSubscriptions}
          badgeLabel={activeSubscriptionsBadge}
          sparkline={getDashboardSparklinePoints("active")}
          helper="Currently active paid subscriptions"
          href={metricLinks.activeSubscriptions}
        />
        <MetricCard
          label="Estimated MRR"
          value={primaryMetrics.estimatedMrr}
          badgeLabel={estimatedMrrBadge}
          sparkline={getDashboardSparklinePoints("mrr")}
          helper="Active subscriptions only"
          tooltip="Estimated monthly recurring revenue from active subscriptions only. Trials, canceled, unpaid, and past-due subscriptions are not counted."
        />
        <div className={styles.metricStack}>
          <MetricCard
            label="Needs review"
            value={primaryMetrics.needsReview}
            helper="Active issues waiting in Inbox"
            compact
            badgeLabel="Inbox"
            tone="review"
          />
          <MetricCard
            label="Failed renewals"
            value={primaryMetrics.failedRenewals}
            helper="Failed payments · Last 7 days"
            compact
            badgeLabel="At risk"
            tone="risk"
            tooltip="Renewal invoice payments that failed in the last 7 days. For example, a customer's subscription tried to renew, but the payment did not go through."
            href={metricLinks.failedRenewals}
          />
        </div>
      </section>

      <section className={styles.secondaryMetrics}>
        <SecondaryMetricCard
          label="Trials"
          value={secondaryMetrics.trialing}
          helper="Currently in trial"
          toneClassName={styles.secondaryNeutral}
          href={metricLinks.trialing}
          ariaLabel="View trialing subscriptions details"
        />
        <SecondaryMetricCard
          label="Past-due"
          value={secondaryMetrics.pastDue}
          helper="Payment not collected yet"
          toneClassName={styles.secondaryReview}
          tooltip="Subscriptions where Stripe has not collected the latest payment yet. If payment is completed and the subscription becomes active again, this count goes down."
          href={metricLinks.pastDue}
          ariaLabel="View past-due subscriptions details"
        />
        <SecondaryMetricCard
          label="Unpaid"
          value={secondaryMetrics.unpaid}
          helper="Marked unpaid in Stripe"
          toneClassName={styles.secondaryAttention}
          tooltip="Subscriptions Stripe currently marks as unpaid after payment could not be collected. If the status changes, this count updates."
          href={metricLinks.unpaid}
          ariaLabel="View unpaid subscriptions details"
        />
        <SecondaryMetricCard
          label="Canceled"
          value={secondaryMetrics.canceled}
          helper="Canceled · Last 7 days"
          toneClassName={styles.secondaryNeutral}
          href={metricLinks.canceled}
          ariaLabel="View canceled subscriptions details"
        />
        <SecondaryMetricCard
          label="Net subscriptions"
          value={secondaryMetrics.netMovement}
          helper="New minus canceled · This month"
          toneClassName={styles.secondaryPositive}
          tooltip="New subscriptions minus canceled subscriptions during this month. For example, 20 new subscriptions and 2 cancellations means +18 net subscriptions."
        />
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.columnMain}>
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Current issues summary</h2>
                <p>Top active subscription-health alerts across connected accounts.</p>
                <span className={styles.sectionMetaPill}>
                  {totalActiveIssues <= 3
                    ? `${totalActiveIssues} issue${totalActiveIssues === 1 ? "" : "s"} need review`
                    : `${totalActiveIssues} issues need review · Showing top 3 by priority`}
                </span>
              </div>
              <Link href={inboxHref} className={styles.sectionLink}>
                Open Inbox
                <span className={styles.sectionLinkArrow} aria-hidden="true">
                  {"\u203a"}
                </span>
              </Link>
            </div>

            {issues.length === 0 ? (
              <p className={styles.emptyText}>No active alerts need review right now.</p>
            ) : (
              <div className={styles.issueListCard}>
                {issues.map((issue) => (
                  <div key={issue.id} className={styles.issueSummaryCard}>
                    <div className={styles.issueSummaryMain}>
                      <strong>{issue.label}</strong>
                      <span>{issue.accountName}</span>
                    </div>
                    <div className={styles.issueSummaryMeta}>
                      {issue.detectedAt ? (
                        <span className={styles.issueDetected}>{issue.detectedAt}</span>
                      ) : null}
                      <span className={styles.issueImpact}>{issue.impact}</span>
                      <span className={`${styles.statusPill} ${statusTone(issue.statusLabel)}`}>
                        {issue.statusLabel}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Connected accounts overview</h2>
                <p>Subscription-health status across your connected Stripe accounts.</p>
              </div>
              <Link href="/dashboard/accounts" className={styles.sectionLink}>
                View accounts
                <span className={styles.sectionLinkArrow} aria-hidden="true">
                  {"\u203a"}
                </span>
              </Link>
            </div>

            <ConnectedAccountsTable accounts={accounts} />
          </section>
        </div>

        <div className={styles.columnSide}>
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Recent alert history</h2>
                <p>Recent alerts that were reviewed or moved to history.</p>
              </div>
              <Link href="/dashboard/alerts" className={styles.sectionLink}>
                View history
                <span className={styles.sectionLinkArrow} aria-hidden="true">
                  {"\u203a"}
                </span>
              </Link>
            </div>

            {history.length === 0 ? (
              <p className={styles.emptyText}>No alert history yet.</p>
            ) : (
              <div className={styles.historyList}>
                {history.map((alert) => (
                  <div key={alert.id} className={styles.historyItem}>
                    <div className={styles.historyMain}>
                      <span className={styles.historyDot} aria-hidden="true" />
                      <div>
                        <strong>{alert.label}</strong>
                        <span>{alert.accountName}</span>
                      </div>
                    </div>
                    <small>{alert.time}</small>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </section>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const isPreviewQuery = params?.preview === "subscription-health";

  if (params?.billing === "success") {
    await syncUserPlanFromStripe(session.user.id);
  }

  const previewDashboardViewModel = buildPreviewDashboardViewModel();

  if (isPreviewQuery) {
    return <DashboardOverview {...previewDashboardViewModel} />;
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

  const [summaries, periodMetricsEntries, activeAlerts, recentHistory, lastEvents] = await Promise.all([
    Promise.all(
      accountIds.map(async (stripeAccountId) => [
        stripeAccountId,
        await getLatestSubscriptionHealthSummary({ stripeAccountId }),
      ] as const),
    ),
    Promise.all(
      accountIds.map(async (stripeAccountId) => [
        stripeAccountId,
        await getSubscriptionHealthKpiPeriodMetrics({ stripeAccountId }),
      ] as const),
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
      take: 3,
    }) as Promise<HistoryAlertRecord[]>,
    prisma.stripeEvent.groupBy({
      by: ["stripeAccountId"],
      where: { stripeAccountId: { in: accountIds } },
      _max: { createdAt: true },
    }),
  ]);

  const summaryByAccount = new Map<string, SummaryRecord>(summaries);
  const periodMetricsByAccount = new Map(periodMetricsEntries);
  const lastEventEntries = lastEvents.reduce<Array<readonly [string, Date | null]>>(
    (entries, event) => {
      if (typeof event.stripeAccountId === "string") {
        entries.push([event.stripeAccountId, event._max.createdAt ?? null] as const);
      }
      return entries;
    },
    [],
  );
  const lastEventByAccount = new Map<string, Date | null>(lastEventEntries);

  const sortedAlerts = [...activeAlerts].sort((left, right) => {
    const severityDiff = severityRank(left.severity) - severityRank(right.severity);
    if (severityDiff !== 0) return severityDiff;
    return right.createdAt.getTime() - left.createdAt.getTime();
  });

  const activeAlertCountByAccount = new Map<string, number>();
  const topAlertSeverityByAccount = new Map<string, string>();

  for (const alert of sortedAlerts) {
    if (!alert.stripeAccountId) continue;
    activeAlertCountByAccount.set(
      alert.stripeAccountId,
      (activeAlertCountByAccount.get(alert.stripeAccountId) ?? 0) + 1,
    );
    if (!topAlertSeverityByAccount.has(alert.stripeAccountId)) {
      topAlertSeverityByAccount.set(alert.stripeAccountId, alert.severity);
    }
  }

  const totals = summaries.reduce(
    (accumulator, entry) => {
      const summary = entry[1];
      if (!summary) return accumulator;
      const periodMetrics = periodMetricsByAccount.get(entry[0]);
      accumulator.activeSubscriptions += summary.activeSubscriptions;
      accumulator.trialingSubscriptions += summary.trialingSubscriptions;
      accumulator.pastDueSubscriptions += summary.pastDueSubscriptions;
      accumulator.unpaidSubscriptions += summary.unpaidSubscriptions;
      accumulator.cancellationsLast7Days += periodMetrics?.cancellationsLast7Days ?? 0;
      accumulator.failedRenewalsLast7Days += periodMetrics?.failedRenewalsLast7Days ?? 0;
      accumulator.estimatedMonthlyRevenue += summary.estimatedMonthlyRevenue;
      accumulator.netSubscriptionsThisMonth += periodMetrics?.netSubscriptionsThisMonth ?? 0;
      return accumulator;
    },
    {
      activeSubscriptions: 0,
      trialingSubscriptions: 0,
      pastDueSubscriptions: 0,
      unpaidSubscriptions: 0,
      cancellationsLast7Days: 0,
      failedRenewalsLast7Days: 0,
      estimatedMonthlyRevenue: 0,
      netSubscriptionsThisMonth: 0,
    },
  );

  const displayCurrency = summaries.find((entry) => entry[1]?.currency)?.[1]?.currency ?? "EUR";
  const hasMeaningfulSubscriptionData =
    totals.activeSubscriptions > 0 ||
    totals.trialingSubscriptions > 0 ||
    totals.pastDueSubscriptions > 0 ||
    totals.unpaidSubscriptions > 0 ||
    totals.cancellationsLast7Days > 0 ||
    totals.failedRenewalsLast7Days > 0 ||
    totals.estimatedMonthlyRevenue > 0 ||
    totals.netSubscriptionsThisMonth !== 0;
  const isRealDashboardEmpty =
    !hasMeaningfulSubscriptionData && sortedAlerts.length === 0 && recentHistory.length === 0;
  const shouldShowPreview = process.env.NODE_ENV === "development" && isRealDashboardEmpty;

  if (shouldShowPreview) {
    return <DashboardOverview {...previewDashboardViewModel} />;
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

  const prioritizedAlerts = [...sortedAlerts].sort((left, right) => {
    const typeDiff = issueTypePriority(left.type) - issueTypePriority(right.type);
    if (typeDiff !== 0) return typeDiff;
    const severityDiff = severityRank(left.severity) - severityRank(right.severity);
    if (severityDiff !== 0) return severityDiff;
    return right.createdAt.getTime() - left.createdAt.getTime();
  });

  const realDashboardViewModel = buildRealDashboardViewModel({
    orderedAccounts,
    accounts,
    sortedAlerts,
    prioritizedAlerts,
    recentHistory,
    summaryByAccount,
    lastEventByAccount,
    activeAlertCountByAccount,
    topAlertSeverityByAccount,
    totals,
    displayCurrency,
  });

  return <DashboardOverview {...realDashboardViewModel} />;
}


