import { auth } from "@/auth";
import { formatMoneyAmount } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { subscriptionHealthPreview } from "../previewData";
import InboxReviewClient, { type InboxHistoryItem, type InboxIssueItem } from "./InboxReviewClient";
import styles from "./page.module.css";

type DashboardInboxPageProps = {
  searchParams?: Promise<{
    preview?: string;
    alert?: string;
    account?: string;
  }>;
};

type AccountRecord = {
  stripeAccountId: string;
  name: string | null;
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

type InboxPageViewModel = {
  previewMode: boolean;
  subtitle: string;
  issues: InboxIssueItem[];
  recentReviewed: InboxHistoryItem[];
  reviewedRecentlyCount: number;
  initialSelectedId?: string | null;
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

function previewAccountHref(accountName: string) {
  const slug = accountName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `/dashboard/accounts/${slug}?preview=subscription-health`;
}

function previewWhyFlagged(type: string) {
  if (type === "subscription_canceled") {
    return "This account is low-activity, so a single cancellation is worth reviewing.";
  }
  if (type === "failed_renewal") {
    return "A subscription renewal payment failed and may affect recurring revenue if it is not recovered.";
  }
  if (type === "subscription_drop") {
    return "Active subscriptions dropped enough compared with this account's recent baseline to need attention.";
  }
  return "Parveil detected subscription-health activity that should be reviewed.";
}

function realWhyFlagged(type: string) {
  if (type === "subscription_canceled") return "Single cancellation detected for this account.";
  if (type === "failed_renewal") return "A renewal invoice payment failed for a subscription.";
  if (type === "subscription_drop") {
    return "This passed the threshold for a meaningful active-subscription drop.";
  }
  if (type === "cancellation_spike") {
    return "Cancellations were meaningfully higher than the recent baseline.";
  }
  if (type === "failed_renewal_spike") {
    return "Failed renewals were meaningfully higher than the recent baseline.";
  }
  if (type === "past_due_increase") {
    return "Past-due subscriptions increased above the recent baseline.";
  }
  if (type === "unpaid_increase" || type === "unpaid_subscription") {
    return "Unpaid subscriptions increased and may need review.";
  }
  if (type === "negative_net_subscription_movement") {
    return "Subscription losses outweighed additions during the current monitoring period.";
  }
  if (type === "meaningful_mrr_drop") {
    return "Estimated recurring revenue dropped meaningfully versus the recent baseline.";
  }
  return "Parveil detected subscription-health activity that should be reviewed.";
}

function parseAlertContext(context: string | null) {
  if (!context) return null;
  try {
    return JSON.parse(context) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildRealImpact(alert: ActiveAlertRecord) {
  const context = parseAlertContext(alert.context);
  if (!context) return null;

  if (typeof context.amountDue === "number") {
    return `${formatMoneyAmount(
      context.amountDue,
      typeof context.currency === "string" ? context.currency : "EUR",
    )} monthly amount at risk.`;
  }

  if (typeof context.estimatedMonthlyRevenue === "number") {
    return `${formatMoneyAmount(
      context.estimatedMonthlyRevenue,
      typeof context.currency === "string" ? context.currency : "EUR",
    )} estimated monthly revenue impact.`;
  }

  if (
    typeof context.previousActiveSubscriptions === "number" &&
    typeof context.currentActiveSubscriptions === "number"
  ) {
    return `${context.previousActiveSubscriptions} -> ${context.currentActiveSubscriptions} active subscriptions.`;
  }

  return null;
}

function buildPreviewInboxViewModel(initialSelectedId?: string | null): InboxPageViewModel {
  const issues: InboxIssueItem[] = subscriptionHealthPreview.issues.map((issue) => ({
    id: issue.id,
    type: issue.type,
    title: issue.typeLabel,
    accountName: issue.accountName,
    severity: issue.severityKind,
    severityLabel: issue.severityKind === "critical" ? "Attention needed" : "Review needed",
    detectedLabel: issue.detectedLabel,
    message:
      issue.type === "subscription_canceled"
        ? "A customer canceled a subscription."
        : issue.type === "failed_renewal"
          ? "A subscription renewal payment failed."
          : "Active subscriptions dropped from 10 to 7.",
    impact:
      issue.type === "subscription_canceled"
        ? `${formatMoneyAmount(3900, "EUR")} estimated monthly revenue impact.`
        : issue.type === "failed_renewal"
          ? `${formatMoneyAmount(3900, "EUR")} monthly amount at risk.`
          : "10 -> 7 active subscriptions.",
    whyFlagged: previewWhyFlagged(issue.type),
    accountHref: previewAccountHref(issue.accountName),
  }));

  const recentReviewed: InboxHistoryItem[] = subscriptionHealthPreview.history.map((alert) => ({
    id: alert.id,
    type: alert.type,
    title: alertLabel(alert.type),
    accountName: alert.accountName,
    time: alert.time,
  }));

  return {
    previewMode: true,
    subtitle: "Reviewing 3 items requiring attention across connected accounts.",
    issues,
    recentReviewed,
    reviewedRecentlyCount: subscriptionHealthPreview.inboxSummary.reviewedRecently,
    initialSelectedId,
  };
}

function renderInboxShell(viewModel: InboxPageViewModel) {
  return (
    <section className={styles.shell}>
      <header className={styles.header}>
        <div>
          <div className={styles.headerTitleRow}>
            <h1>Monitoring Inbox</h1>
            {viewModel.previewMode ? <span className={styles.previewBadge}>Preview data</span> : null}
          </div>
          <p>{viewModel.subtitle}</p>
        </div>
      </header>

      <InboxReviewClient
        issues={viewModel.issues}
        recentReviewed={viewModel.recentReviewed}
        reviewedRecentlyCount={viewModel.reviewedRecentlyCount}
        isPreview={viewModel.previewMode}
        initialSelectedId={viewModel.initialSelectedId}
      />
    </section>
  );
}

export default async function DashboardInboxPage({ searchParams }: DashboardInboxPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const isPreviewQuery = params?.preview === "subscription-health";
  const initialSelectedId = params?.alert ?? null;

  const previewInboxViewModel = buildPreviewInboxViewModel(initialSelectedId);

  if (isPreviewQuery) {
    return renderInboxShell(previewInboxViewModel);
  }

  const accounts = (await prisma.stripeAccount.findMany({
    where: { userId: session.user.id },
    select: {
      stripeAccountId: true,
      name: true,
    },
    orderBy: { createdAt: "desc" },
  })) as AccountRecord[];

  const accountIds = accounts.map((account) => account.stripeAccountId);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [alerts, recentReviewed, recentReviewedCount] = await Promise.all([
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
  ]);

  const sortedAlerts = [...alerts].sort((left, right) => {
    const severityDiff = severityRank(left.severity) - severityRank(right.severity);
    if (severityDiff !== 0) return severityDiff;
    return right.createdAt.getTime() - left.createdAt.getTime();
  });

  const inboxIssues: InboxIssueItem[] = sortedAlerts.map((alert) => ({
    id: alert.id,
    accountName: accountDisplayName(
      accounts.find((account) => account.stripeAccountId === alert.stripeAccountId)?.name ?? null,
    ),
    type: alert.type,
    title: alertLabel(alert.type),
    message: alert.message,
    severity: alert.severity === "critical" ? "critical" : "warning",
    severityLabel: alert.severity === "critical" ? "Attention needed" : "Review needed",
    detectedLabel: formatDetectedLabel(alert.createdAt),
    impact: buildRealImpact(alert),
    whyFlagged: realWhyFlagged(alert.type),
    accountHref: alert.stripeAccountId
      ? `/dashboard/accounts/${encodeURIComponent(alert.stripeAccountId)}`
      : "/dashboard/accounts",
    stripeAccountId: alert.stripeAccountId,
  }));

  const hasMeaningfulInboxData =
    inboxIssues.length > 0 || accounts.length > 0 || recentReviewed.length > 0;
  const shouldShowPreview = process.env.NODE_ENV === "development" && !hasMeaningfulInboxData;

  if (shouldShowPreview) {
    return renderInboxShell(previewInboxViewModel);
  }

  return renderInboxShell({
    previewMode: false,
    subtitle:
      inboxIssues.length > 0
        ? `Reviewing ${inboxIssues.length} item${inboxIssues.length === 1 ? "" : "s"} requiring attention across connected accounts.`
        : "No active alerts need review right now. Parveil is monitoring subscription health across your connected Stripe accounts.",
    issues: inboxIssues,
    recentReviewed: recentReviewed.slice(0, 3).map((alert) => ({
      id: alert.id,
      type: alert.type,
      title: alertLabel(alert.type),
      accountName: accountDisplayName(
        accounts.find((account) => account.stripeAccountId === alert.stripeAccountId)?.name ?? null,
      ),
      time: formatLastActivity(alert.createdAt),
    })),
    reviewedRecentlyCount: recentReviewedCount,
    initialSelectedId,
  });
}
