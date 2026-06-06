import { auth } from "@/auth";
import { AutoBackfillTrigger } from "./AutoBackfillTrigger";
import { previewAccountDetails, subscriptionHealthPreview } from "../previewData";
import { getActiveDemoAlerts, hasDemoAccount } from "@/lib/demoData";
import { prisma } from "@/lib/prisma";
import {
  getLatestSubscriptionHealthSummary,
  type SubscriptionHealthSummary,
} from "@/lib/subscription-health-store";
import { formatMoneyAmount } from "@/lib/currency";
import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "./page.module.css";

type AccountAlertSummary = {
  type: string;
  severity: "critical" | "warning";
  createdAt: Date | null;
};

type AccountBackfillStatus = "pending" | "running" | "completed" | "failed";

type AccountListItem = {
  id: string;
  name: string | null;
  status: string;
  stripeAccountId: string;
  backfillStatus: AccountBackfillStatus;
  backfillStartedAt: Date | null;
  lastBackfilledAt: Date | null;
};

type AccountsOverviewRow = {
  key: string;
  name: string;
  status: string;
  statusClassName: string;
  topIssue: string;
  activeSubscriptions: string | number;
  estimatedMrr: string;
  activeAlerts: string | number;
  lastActivity: string;
  href: string;
};

type AccountsOverviewViewModel = {
  showPreviewBadge: boolean;
  addAccountHref: string;
  summary: Array<{ label: string; value: string | number }>;
  rows: AccountsOverviewRow[];
  emptyState: string | null;
  connectNotice: string | null;
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

function severityRank(severity: "critical" | "warning" | string) {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function statusRank(accountStatus: string, topAlert: AccountAlertSummary | null) {
  if (accountStatus !== "active") return 3;
  if (topAlert?.severity === "critical") return 0;
  if (topAlert?.severity === "warning") return 1;
  return 2;
}

function accountDisplayName(name: string | null) {
  return name?.trim() || "Stripe account";
}

function realAccountStatusLabel(account: AccountListItem, topAlert: AccountAlertSummary | null) {
  if (account.status === "paused") return "Paused";
  if (topAlert?.severity === "critical") return "Attention needed";
  if (topAlert?.severity === "warning") return "Review needed";
  if (account.backfillStatus === "pending" || account.backfillStatus === "running") {
    return "Importing history";
  }
  return "Monitoring active";
}

function realAccountTopIssue(account: AccountListItem, topAlert: AccountAlertSummary | null) {
  if (topAlert) return alertLabel(topAlert.type);
  if (account.status === "paused") return "Monitoring paused";
  if (account.backfillStatus === "pending" || account.backfillStatus === "running") {
    return "Importing history";
  }
  return "Monitoring active";
}

function renderAccountsOverview(viewModel: AccountsOverviewViewModel) {
  return (
    <section className={styles.previewShell}>
      <header className={styles.previewHeader}>
        <div className={styles.previewHeaderCopy}>
          <div className={styles.previewHeaderTitleRow}>
            <h1>Monitored accounts</h1>
            {viewModel.showPreviewBadge ? (
              <span className={styles.previewBadge}>Preview data</span>
            ) : null}
          </div>
          <p>
            Review subscription health, monitoring status, and current issues for each connected
            Stripe account.
          </p>
        </div>
        <Link href={viewModel.addAccountHref} className={styles.previewAddAccountLink}>
          Add account
        </Link>
      </header>

      <section className={styles.previewSummaryStrip} aria-label="Accounts summary">
        {viewModel.summary.map((item) => (
          <article key={item.label} className={styles.previewSummaryCard}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className={styles.previewAccountsSection}>
        <div className={styles.previewSectionHeader}>
          <div>
            <h2>Accounts overview</h2>
            <p>Accounts with active issues appear first. Healthy monitored accounts stay visible below.</p>
          </div>
        </div>

        {viewModel.connectNotice ? (
          <div className={styles.connectNotice}>{viewModel.connectNotice}</div>
        ) : null}

        {viewModel.emptyState ? (
          <div className={styles.emptyState}>{viewModel.emptyState}</div>
        ) : (
          <div className={styles.previewAccountsTable}>
            <div className={styles.previewAccountsTableHeader}>
              <span>Account</span>
              <span>Status</span>
              <span>Top issue</span>
              <span>Active subscriptions</span>
              <span>Estimated MRR</span>
              <span>Active alerts</span>
              <span>Last activity</span>
              <span>Action</span>
            </div>

            <div className={styles.previewAccountsRows}>
              {viewModel.rows.map((account) => (
                <Link
                  key={account.key}
                  href={account.href}
                  className={styles.previewAccountRow}
                  aria-label={`Open details for ${account.name}`}
                >
                  <span className={styles.previewAccountName}>{account.name}</span>
                  <span className={`${styles.previewStatusPill} ${account.statusClassName}`}>
                    {account.status}
                  </span>
                  <span className={styles.previewTopIssue}>{account.topIssue}</span>
                  <span>{account.activeSubscriptions}</span>
                  <span>{account.estimatedMrr}</span>
                  <span>{account.activeAlerts}</span>
                  <span className={styles.previewLastActivity}>{account.lastActivity}</span>
                  <span className={styles.previewDetailsButton}>View details</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </section>
  );
}

export default async function DashboardAccountsPage({
  searchParams,
}: {
  searchParams?: Promise<{ connect?: string; preview?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const connectStatus = resolvedSearchParams?.connect;
  const isPreviewMode = resolvedSearchParams?.preview === "subscription-health";

  if (isPreviewMode) {
    const previewRows: AccountsOverviewRow[] = subscriptionHealthPreview.accounts.map((account) => {
      const slug = account.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const topIssue =
        previewAccountDetails[slug]?.currentIssue.type === "subscription_canceled"
          ? "Subscription canceled"
          : previewAccountDetails[slug]?.currentIssue.type === "failed_renewal"
            ? "Failed renewal"
            : previewAccountDetails[slug]?.currentIssue.type === "subscription_drop"
              ? "Subscription drop"
              : "Monitoring active";

      return {
        key: account.stripeAccountId,
        name: account.name,
        status: account.status,
        statusClassName:
          account.status === "Attention needed"
            ? styles.previewStatusAttention
            : account.status === "Review needed"
              ? styles.previewStatusReview
              : styles.previewStatusMonitoring,
        topIssue,
        activeSubscriptions: account.activeSubscriptions,
        estimatedMrr: account.estimatedMrr,
        activeAlerts: account.activeAlerts,
        lastActivity: account.lastActivity,
        href: `/dashboard/accounts/${slug}?preview=subscription-health`,
      };
    });

    return renderAccountsOverview({
      showPreviewBadge: true,
      addAccountHref: "/api/stripe/connect",
      summary: [
        { label: "Connected accounts", value: 3 },
        { label: "Needs review", value: 2 },
        { label: "Attention needed", value: 1 },
        { label: "Estimated MRR", value: subscriptionHealthPreview.overview.estimatedMrr },
      ],
      rows: previewRows,
      emptyState: null,
      connectNotice: null,
    });
  }

  const accounts = (await (prisma as any).stripeAccount.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      stripeAccountId: true,
      backfillStatus: true,
      backfillStartedAt: true,
      lastBackfilledAt: true,
    },
  })) as AccountListItem[];

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
        status: "active",
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
    lastEvents.map((event) => [event.stripeAccountId, event._max.createdAt ?? null]),
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
    const leftAlert =
      left.status === "active" ? topAlertByAccount.get(left.stripeAccountId) ?? null : null;
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

  const visibleAccounts = sortedAccounts.filter((account) => account.status !== "disconnected");
  const summaryEntries = await Promise.all(
    visibleAccounts.map(
      async (account): Promise<[string, SubscriptionHealthSummary | null]> => [
        account.stripeAccountId,
        await getLatestSubscriptionHealthSummary({
          stripeAccountId: account.stripeAccountId,
        }),
      ],
    ),
  );
  const summaryByAccount = new Map<string, SubscriptionHealthSummary | null>(summaryEntries);
  const activeAlertCountByAccount = new Map<string, number>();

  for (const alert of activeAlertRecords) {
    if (!alert.stripeAccountId) continue;
    activeAlertCountByAccount.set(
      alert.stripeAccountId,
      (activeAlertCountByAccount.get(alert.stripeAccountId) ?? 0) + 1,
    );
  }

  const totalEstimatedMrr = summaryEntries.reduce((total, [, summary]) => {
    return total + (summary?.estimatedMonthlyRevenue ?? 0);
  }, 0);
  const displayCurrency =
    summaryEntries.find(([, summary]) => summary?.currency)?.[1]?.currency ?? "EUR";
  const needsReviewCount = visibleAccounts.filter((account) => {
    const topAlert =
      account.status === "active" ? topAlertByAccount.get(account.stripeAccountId) ?? null : null;
    return topAlert?.severity === "warning";
  }).length;
  const attentionNeededCount = visibleAccounts.filter((account) => {
    const topAlert =
      account.status === "active" ? topAlertByAccount.get(account.stripeAccountId) ?? null : null;
    return topAlert?.severity === "critical";
  }).length;

  const realRows: AccountsOverviewRow[] = visibleAccounts.map((account) => {
    const topAlert =
      account.status === "active" ? topAlertByAccount.get(account.stripeAccountId) ?? null : null;
    const summary = summaryByAccount.get(account.stripeAccountId) ?? null;
    const activeAlertCount = activeAlertCountByAccount.get(account.stripeAccountId) ?? 0;
    const statusLabel = realAccountStatusLabel(account, topAlert);
    const topIssue = realAccountTopIssue(account, topAlert);
    const statusClassName =
      statusLabel === "Attention needed"
        ? styles.previewStatusAttention
        : statusLabel === "Review needed"
          ? styles.previewStatusReview
          : statusLabel === "Paused" || statusLabel === "Importing history"
            ? styles.previewStatusPaused
            : styles.previewStatusMonitoring;

    return {
      key: account.id,
      name: accountDisplayName(account.name),
      status: statusLabel,
      statusClassName,
      topIssue,
      activeSubscriptions: summary ? summary.activeSubscriptions : "—",
      estimatedMrr: summary
        ? formatMoneyAmount(summary.estimatedMonthlyRevenue, summary.currency)
        : "—",
      activeAlerts: activeAlertCount,
      lastActivity: formatRelativeTime(lastEventByAccount.get(account.stripeAccountId)),
      href: `/dashboard/accounts/${encodeURIComponent(account.stripeAccountId)}`,
    };
  });

  return (
    <>
      <AutoBackfillTrigger
        stripeAccountIds={visibleAccounts
          .filter((account) => account.status === "active" && account.backfillStatus === "pending")
          .map((account) => account.stripeAccountId)}
      />
      {renderAccountsOverview({
        showPreviewBadge: false,
        addAccountHref: "/api/stripe/connect",
        summary: [
          { label: "Connected accounts", value: visibleAccounts.length },
          { label: "Needs review", value: needsReviewCount },
          { label: "Attention needed", value: attentionNeededCount },
          { label: "Estimated MRR", value: formatMoneyAmount(totalEstimatedMrr, displayCurrency) },
        ],
        rows: realRows,
        emptyState:
          visibleAccounts.length === 0
            ? "No active or paused Stripe accounts to manage right now."
            : null,
        connectNotice:
          connectStatus === "cancelled"
            ? "Stripe connection cancelled. No account was connected."
            : null,
      })}
    </>
  );
}
