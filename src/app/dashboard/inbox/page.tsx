import { auth } from "@/auth";
import InboxReviewClient, { type InboxHistoryItem, type InboxIssueItem } from "./InboxReviewClient";
import { subscriptionHealthPreview } from "../previewData";
import { formatMoneyAmount } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
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
  if (type === "subscription_canceled")
    return "This account is low-activity, so a single cancellation is worth reviewing.";
  if (type === "failed_renewal")
    return "A subscription renewal payment failed and may affect recurring revenue if it is not recovered.";
  if (type === "subscription_drop")
    return "Active subscriptions dropped enough compared with this account’s recent baseline to need attention.";
  return "Parveil detected subscription-health activity that should be reviewed.";
}

function realWhyFlagged(type: string) {
  if (type === "subscription_canceled") return "Single cancellation detected for this account.";
  if (type === "failed_renewal") return "A renewal invoice payment failed for a subscription.";
  if (type === "subscription_drop")
    return "This passed the threshold for a meaningful active-subscription drop.";
  if (type === "cancellation_spike")
    return "Cancellations were meaningfully higher than the recent baseline.";
  if (type === "failed_renewal_spike")
    return "Failed renewals were meaningfully higher than the recent baseline.";
  if (type === "past_due_increase")
    return "Past-due subscriptions increased above the recent baseline.";
  if (type === "unpaid_increase" || type === "unpaid_subscription")
    return "Unpaid subscriptions increased and may need review.";
  if (type === "negative_net_subscription_movement")
    return "Subscription losses outweighed additions during the current monitoring period.";
  if (type === "meaningful_mrr_drop")
    return "Estimated recurring revenue dropped meaningfully versus the recent baseline.";
  return "Parveil detected subscription-health activity that should be reviewed.";
}

export default async function DashboardInboxPage({ searchParams }: DashboardInboxPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const isPreviewQuery = params?.preview === "subscription-health";
  const initialSelectedId = params?.alert ?? null;

  if (isPreviewQuery) {
    const previewIssues: InboxIssueItem[] = subscriptionHealthPreview.issues.map((issue) => ({
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
            : "10 → 7 active subscriptions.",
      whyFlagged: previewWhyFlagged(issue.type),
      accountHref: previewAccountHref(issue.accountName),
    }));

    const previewReviewed: InboxHistoryItem[] = subscriptionHealthPreview.history.map((alert) => ({
      id: alert.id,
      type: alert.type,
      title: alertLabel(alert.type),
      accountName: alert.accountName,
      time: alert.time,
    }));

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

        <InboxReviewClient
          issues={previewIssues}
          recentReviewed={previewReviewed}
          isPreview
          initialSelectedId={initialSelectedId}
        />
      </section>
    );
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

  const attentionCount = sortedAlerts.filter((alert) => alert.severity === "critical").length;

  const inboxIssues: InboxIssueItem[] = sortedAlerts.map((alert) => ({
    id: alert.id,
    accountName: accountDisplayName(
      accounts.find((account) => account.stripeAccountId === alert.stripeAccountId)?.name ?? null
    ),
    type: alert.type,
    title: alertLabel(alert.type),
    message: alert.message,
    severity: alert.severity === "critical" ? ("critical" as const) : ("warning" as const),
    severityLabel: alert.severity === "critical" ? "Attention needed" : "Review needed",
    detectedLabel: formatDetectedLabel(alert.createdAt),
    impact:
      alert.context && alert.context.includes("amountDue")
        ? `${formatMoneyAmount(JSON.parse(alert.context).amountDue as number, typeof JSON.parse(alert.context).currency === "string" ? JSON.parse(alert.context).currency : "EUR")} monthly amount at risk.`
        : alert.context && alert.context.includes("estimatedMonthlyRevenue")
          ? `${formatMoneyAmount(JSON.parse(alert.context).estimatedMonthlyRevenue as number, typeof JSON.parse(alert.context).currency === "string" ? JSON.parse(alert.context).currency : "EUR")} estimated monthly revenue impact.`
          : alert.context &&
              alert.context.includes("previousActiveSubscriptions") &&
              alert.context.includes("currentActiveSubscriptions")
            ? `${JSON.parse(alert.context).previousActiveSubscriptions} → ${JSON.parse(alert.context).currentActiveSubscriptions} active subscriptions.`
            : null,
    whyFlagged: realWhyFlagged(alert.type),
    accountHref: alert.stripeAccountId
      ? `/dashboard/accounts/${encodeURIComponent(alert.stripeAccountId)}`
      : "/dashboard/accounts",
    stripeAccountId: alert.stripeAccountId,
  }));
  const hasMeaningfulInboxData =
    inboxIssues.length > 0 ||
    accounts.length > 0 ||
    recentReviewed.length > 0 ||
    false;
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
            <span>Attention needed</span>
            <strong>{subscriptionHealthPreview.inboxSummary.attentionNeeded}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>Reviewed recently</span>
            <strong>{subscriptionHealthPreview.inboxSummary.reviewedRecently}</strong>
          </article>
        </section>

        <InboxReviewClient
          issues={subscriptionHealthPreview.issues.map((issue) => ({
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
                  : "10 → 7 active subscriptions.",
            whyFlagged: previewWhyFlagged(issue.type),
            accountHref: previewAccountHref(issue.accountName),
          }))}
          recentReviewed={subscriptionHealthPreview.history.map((alert) => ({
            id: alert.id,
            type: alert.type,
            title: alertLabel(alert.type),
            accountName: alert.accountName,
            time: alert.time,
          }))}
          isPreview
          initialSelectedId={initialSelectedId}
        />
      </section>
    );
  }

  return (
    <section className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1>Monitoring Inbox</h1>
          <p>
            {inboxIssues.length > 0
              ? `Reviewing ${inboxIssues.length} item${inboxIssues.length === 1 ? "" : "s"} requiring attention across connected accounts.`
              : "No active alerts need review right now. Parveil is monitoring subscription health across your connected Stripe accounts."}
          </p>
        </div>
      </header>

        <section className={styles.summaryStrip} aria-label="Inbox summary">
          <article className={styles.summaryCard}>
            <span>Needs review</span>
            <strong>{inboxIssues.length}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>Attention needed</span>
            <strong>{attentionCount}</strong>
          </article>
          <article className={styles.summaryCard}>
            <div className={styles.summaryCardHeader}>
              <span>Reviewed recently</span>
              <small className={styles.summaryMeta}>Last 7 days</small>
            </div>
            <strong>{recentReviewedCount}</strong>
          </article>
        </section>

      <InboxReviewClient
        issues={inboxIssues}
        recentReviewed={recentReviewed.slice(0, 3).map((alert) => ({
          id: alert.id,
          type: alert.type,
          title: alertLabel(alert.type),
          accountName: accountDisplayName(
            accounts.find((account) => account.stripeAccountId === alert.stripeAccountId)?.name ?? null
          ),
          time: formatLastActivity(alert.createdAt),
        }))}
        isPreview={false}
        initialSelectedId={initialSelectedId}
      />
    </section>
  );
}
