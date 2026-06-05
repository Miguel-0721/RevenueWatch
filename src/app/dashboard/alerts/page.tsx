import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  getActiveDemoAlerts,
  getDemoAccountById,
  getDemoAlertHistory,
  hasDemoAccount,
} from "@/lib/demoData";
import { prisma } from "@/lib/prisma";

import styles from "./page.module.css";

type DashboardAlertsPageProps = {
  searchParams?: Promise<{
    preview?: string;
    account?: string;
    status?: string;
    type?: string;
    date?: string;
    page?: string;
  }>;
};

type AlertRow = {
  id: string;
  title: string;
  accountName: string;
  typeLabel: string;
  severity: "warning" | "critical";
  severityLabel: string;
  impact: string;
  statusLabel: "Active" | "Reviewed";
  detectedLabel: string;
  reviewedLabel: string;
  actionLabel: string;
  href: string;
  previewDateBucket?: "today" | "last7" | "last30" | "thisMonth" | "thisYear";
};

const PAST_ALERTS_PAGE_SIZE = 10;

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

function previewAccountHref(accountName: string) {
  const slug = accountName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `/dashboard/accounts/${slug}?preview=subscription-health`;
}

function formatDetectedLabel(date: Date) {
  const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatHistoryTime(date: Date) {
  const target = new Date(date);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  );
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfTarget.getTime()) / 86400000
  );

  if (diffDays === 0) {
    return target.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  if (diffDays === 1) {
    return `Yesterday, ${target.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  return target.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function safeParseContext(input?: string | null) {
  if (!input) return null;
  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildImpact(type: string, context?: string | null) {
  const parsed = safeParseContext(context);
  if (!parsed) return "Monitoring active";

  if (typeof parsed.impactLabel === "string") return parsed.impactLabel;

  if (type === "subscription_canceled" && typeof parsed.estimatedMonthlyRevenue === "number") {
    const amount = Math.round(parsed.estimatedMonthlyRevenue / 100);
    return `€${amount} MRR impact`;
  }

  if (type === "failed_renewal" && typeof parsed.amountDue === "number") {
    const amount = Math.round(parsed.amountDue / 100);
    return `€${amount} at risk`;
  }

  if (
    type === "subscription_drop" &&
    typeof parsed.previousActiveSubscriptions === "number" &&
    typeof parsed.currentActiveSubscriptions === "number"
  ) {
    return `${parsed.previousActiveSubscriptions} → ${parsed.currentActiveSubscriptions} active`;
  }

  if (
    type === "past_due_increase" &&
    typeof parsed.previousPastDueSubscriptions === "number" &&
    typeof parsed.currentPastDueSubscriptions === "number"
  ) {
    return `${parsed.previousPastDueSubscriptions} → ${parsed.currentPastDueSubscriptions} subscriptions`;
  }

  if (type === "unpaid_subscription" && typeof parsed.unpaidSubscriptions === "number") {
    return `${parsed.unpaidSubscriptions} subscriptions`;
  }

  return "Monitoring active";
}

function severityLabel(severity: string) {
  return severity === "critical" ? "Attention needed" : "Review needed";
}

function severityClassName(severity: "warning" | "critical") {
  return severity === "critical" ? styles.attentionPill : styles.reviewPill;
}

function typeLabel(type: string) {
  if (type === "subscription_canceled") return "Cancellation";
  if (type === "failed_renewal" || type === "failed_renewal_spike") return "Failed renewal";
  if (type === "subscription_drop") return "Subscription trend";
  if (type === "cancellation_spike") return "Cancellation trend";
  if (type === "past_due_increase") return "Past-due";
  if (type === "unpaid_subscription" || type === "unpaid_increase") return "Unpaid";
  if (type === "meaningful_mrr_drop") return "Revenue trend";
  if (type === "negative_net_subscription_movement") return "Net movement";
  return alertLabel(type);
}

function typeFilterValues(type: string) {
  if (type === "all") return null;
  if (type === "Cancellation") return ["subscription_canceled"];
  if (type === "Failed renewal") return ["failed_renewal", "failed_renewal_spike"];
  if (type === "Subscription trend") return ["subscription_drop"];
  if (type === "Past-due") return ["past_due_increase"];
  if (type === "Unpaid") return ["unpaid_subscription", "unpaid_increase"];
  if (type === "Cancellation trend") return ["cancellation_spike"];
  if (type === "Revenue trend") return ["meaningful_mrr_drop"];
  return null;
}

function dateFilterStart(date: string) {
  const now = new Date();

  if (date === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  if (date === "last-7-days") {
    return new Date(now.getTime() - 7 * 86400000);
  }

  if (date === "last-30-days") {
    return new Date(now.getTime() - 30 * 86400000);
  }

  if (date === "this-month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  if (date === "this-year") {
    return new Date(now.getFullYear(), 0, 1);
  }

  return null;
}

function dateFilterLabel(date: string) {
  if (date === "today") return "Today";
  if (date === "last-7-days") return "Last 7 days";
  if (date === "last-30-days") return "Last 30 days";
  if (date === "this-month") return "This month";
  if (date === "this-year") return "This year";
  return "All time";
}

function renderCurrentRow(row: AlertRow) {
  return (
    <article key={row.id} className={`${styles.feedRow} ${styles.currentFeedRow}`}>
      <div className={styles.feedCellPrimary}>
        <h3 className={styles.feedTitle}>{row.title}</h3>
        <p className={styles.feedMeta}>{row.accountName}</p>
      </div>
      <div className={styles.feedCellImpact}>
        <span className={styles.impactTag}>{row.impact}</span>
      </div>
      <div className={styles.feedCellStatus}>
        <span className={`${styles.inlinePill} ${severityClassName(row.severity)}`}>
          {row.severityLabel}
        </span>
      </div>
      <div className={styles.feedCellTime}>
        <span className={styles.feedTimeValue}>Detected {row.detectedLabel}</span>
      </div>
      <Link href={row.href} className={styles.rowAction}>
        {row.actionLabel}
      </Link>
    </article>
  );
}

function renderHistoryRow(row: AlertRow) {
  return (
    <article key={row.id} className={`${styles.feedRow} ${styles.historyFeedRow}`}>
      <div className={styles.feedCellPrimary}>
        <h3 className={styles.feedTitle}>{row.title}</h3>
        <p className={styles.feedMeta}>{row.accountName}</p>
      </div>
      <div className={styles.feedCellImpact}>
        <span className={styles.impactTag}>{row.impact}</span>
      </div>
      <div className={styles.feedCellStatus}>
        <span className={`${styles.inlinePill} ${styles.reviewedStatusPill}`}>Reviewed</span>
      </div>
      <div className={styles.feedCellTime}>
        <span className={styles.feedTimeValue}>Detected {row.detectedLabel}</span>
        <span className={styles.feedTimeValue}>Reviewed {row.reviewedLabel}</span>
      </div>
      <Link href={row.href} className={styles.rowAction}>
        {row.actionLabel}
      </Link>
    </article>
  );
}

export default async function DashboardAlertsPage({
  searchParams,
}: DashboardAlertsPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const isPreviewMode = params?.preview === "subscription-health";
  const selectedAccount = params?.account ?? "all";
  const selectedType = params?.type ?? "all";
  const selectedDate = params?.date ?? "all-time";
  const selectedPage = Math.max(1, Number.parseInt(params?.page ?? "1", 10) || 1);

  let activeRows: AlertRow[] = [];
  let reviewedRows: AlertRow[] = [];
  let totalPastAlerts = 0;
  let currentPastPage = 1;
  let compactSummaryLine = "Showing alert history across connected accounts";
  let accountOptions: string[] = [];

  if (isPreviewMode) {
    accountOptions = ["Northstar Commerce", "BluePeak Studio", "Cedar Labs"];

    activeRows = [
      {
        id: "preview-subscription-canceled",
        title: "Subscription canceled",
        accountName: "Northstar Commerce",
        typeLabel: "Cancellation",
        severity: "warning",
        severityLabel: "Review needed",
        impact: "€39 MRR impact",
        statusLabel: "Active",
        detectedLabel: "12m ago",
        reviewedLabel: "—",
        actionLabel: "Review in Inbox",
        href: "/dashboard/inbox?preview=subscription-health",
        previewDateBucket: "today",
      },
      {
        id: "preview-failed-renewal",
        title: "Failed renewal",
        accountName: "BluePeak Studio",
        typeLabel: "Failed renewal",
        severity: "warning",
        severityLabel: "Review needed",
        impact: "€39 at risk",
        statusLabel: "Active",
        detectedLabel: "45m ago",
        reviewedLabel: "—",
        actionLabel: "Review in Inbox",
        href: "/dashboard/inbox?preview=subscription-health",
        previewDateBucket: "today",
      },
      {
        id: "preview-subscription-drop",
        title: "Subscription drop",
        accountName: "Cedar Labs",
        typeLabel: "Subscription trend",
        severity: "critical",
        severityLabel: "Attention needed",
        impact: "10 → 7 active",
        statusLabel: "Active",
        detectedLabel: "2h ago",
        reviewedLabel: "—",
        actionLabel: "Review in Inbox",
        href: "/dashboard/inbox?preview=subscription-health",
        previewDateBucket: "today",
      },
    ];

    const previewHistoryRows: AlertRow[] = [
      {
        id: "preview-history-past-due",
        title: "Past-due increase",
        accountName: "BluePeak Studio",
        typeLabel: "Past-due",
        severity: "critical",
        severityLabel: "Attention needed",
        impact: "2 → 4 subscriptions",
        statusLabel: "Reviewed",
        detectedLabel: "Yesterday, 16:20",
        reviewedLabel: "Yesterday, 16:35",
        actionLabel: "View account",
        href: previewAccountHref("BluePeak Studio"),
        previewDateBucket: "last7",
      },
      {
        id: "preview-history-unpaid",
        title: "Unpaid subscription",
        accountName: "Cedar Labs",
        typeLabel: "Unpaid",
        severity: "warning",
        severityLabel: "Review needed",
        impact: "2 subscriptions",
        statusLabel: "Reviewed",
        detectedLabel: "Yesterday, 09:45",
        reviewedLabel: "Yesterday, 10:02",
        actionLabel: "View account",
        href: previewAccountHref("Cedar Labs"),
        previewDateBucket: "last7",
      },
      {
        id: "preview-history-canceled",
        title: "Subscription canceled",
        accountName: "Northstar Commerce",
        typeLabel: "Cancellation",
        severity: "warning",
        severityLabel: "Review needed",
        impact: "€39 MRR impact",
        statusLabel: "Reviewed",
        detectedLabel: "May 21, 4:34 PM",
        reviewedLabel: "May 21, 4:48 PM",
        actionLabel: "View account",
        href: previewAccountHref("Northstar Commerce"),
        previewDateBucket: "last30",
      },
      {
        id: "preview-history-failed-renewal-spike",
        title: "Failed renewal spike",
        accountName: "BluePeak Studio",
        typeLabel: "Failed renewal",
        severity: "critical",
        severityLabel: "Attention needed",
        impact: "8 failed renewals",
        statusLabel: "Reviewed",
        detectedLabel: "May 20, 11:15 AM",
        reviewedLabel: "May 20, 11:42 AM",
        actionLabel: "View account",
        href: previewAccountHref("BluePeak Studio"),
        previewDateBucket: "last30",
      },
      {
        id: "preview-history-cancellation-spike",
        title: "Cancellation spike",
        accountName: "Cedar Labs",
        typeLabel: "Cancellation trend",
        severity: "critical",
        severityLabel: "Attention needed",
        impact: "5 cancellations",
        statusLabel: "Reviewed",
        detectedLabel: "May 19, 3:20 PM",
        reviewedLabel: "May 19, 3:55 PM",
        actionLabel: "View account",
        href: previewAccountHref("Cedar Labs"),
        previewDateBucket: "last30",
      },
      {
        id: "preview-history-mrr-drop",
        title: "Meaningful MRR drop",
        accountName: "Northstar Commerce",
        typeLabel: "Revenue trend",
        severity: "critical",
        severityLabel: "Attention needed",
        impact: "€420 MRR drop",
        statusLabel: "Reviewed",
        detectedLabel: "May 18, 9:10 AM",
        reviewedLabel: "May 18, 9:38 AM",
        actionLabel: "View account",
        href: previewAccountHref("Northstar Commerce"),
        previewDateBucket: "last30",
      },
      {
        id: "preview-history-canceled-2",
        title: "Subscription canceled",
        accountName: "BluePeak Studio",
        typeLabel: "Cancellation",
        severity: "warning",
        severityLabel: "Review needed",
        impact: "€117 MRR impact",
        statusLabel: "Reviewed",
        detectedLabel: "May 17, 2:18 PM",
        reviewedLabel: "May 17, 2:33 PM",
        actionLabel: "View account",
        href: previewAccountHref("BluePeak Studio"),
        previewDateBucket: "last30",
      },
      {
        id: "preview-history-failed-renewal-2",
        title: "Failed renewal",
        accountName: "Northstar Commerce",
        typeLabel: "Failed renewal",
        severity: "warning",
        severityLabel: "Review needed",
        impact: "€39 at risk",
        statusLabel: "Reviewed",
        detectedLabel: "May 16, 8:42 AM",
        reviewedLabel: "May 16, 9:04 AM",
        actionLabel: "View account",
        href: previewAccountHref("Northstar Commerce"),
        previewDateBucket: "last30",
      },
      {
        id: "preview-history-subscription-drop-2",
        title: "Subscription drop",
        accountName: "Cedar Labs",
        typeLabel: "Subscription trend",
        severity: "critical",
        severityLabel: "Attention needed",
        impact: "14 → 10 active",
        statusLabel: "Reviewed",
        detectedLabel: "May 15, 4:12 PM",
        reviewedLabel: "May 15, 4:41 PM",
        actionLabel: "View account",
        href: previewAccountHref("Cedar Labs"),
        previewDateBucket: "last30",
      },
      {
        id: "preview-history-past-due-2",
        title: "Past-due increase",
        accountName: "Northstar Commerce",
        typeLabel: "Past-due",
        severity: "critical",
        severityLabel: "Attention needed",
        impact: "1 → 3 subscriptions",
        statusLabel: "Reviewed",
        detectedLabel: "May 14, 10:05 AM",
        reviewedLabel: "May 14, 10:29 AM",
        actionLabel: "View account",
        href: previewAccountHref("Northstar Commerce"),
        previewDateBucket: "last30",
      },
      {
        id: "preview-history-unpaid-2",
        title: "Unpaid subscription",
        accountName: "BluePeak Studio",
        typeLabel: "Unpaid",
        severity: "warning",
        severityLabel: "Review needed",
        impact: "1 subscription",
        statusLabel: "Reviewed",
        detectedLabel: "May 13, 6:20 PM",
        reviewedLabel: "May 13, 6:36 PM",
        actionLabel: "View account",
        href: previewAccountHref("BluePeak Studio"),
        previewDateBucket: "last30",
      },
      {
        id: "preview-history-failed-renewal-spike-2",
        title: "Failed renewal spike",
        accountName: "Cedar Labs",
        typeLabel: "Failed renewal",
        severity: "critical",
        severityLabel: "Attention needed",
        impact: "11 failed renewals",
        statusLabel: "Reviewed",
        detectedLabel: "May 12, 1:10 PM",
        reviewedLabel: "May 12, 1:34 PM",
        actionLabel: "View account",
        href: previewAccountHref("Cedar Labs"),
        previewDateBucket: "last30",
      },
      {
        id: "preview-history-cancellation-spike-2",
        title: "Cancellation spike",
        accountName: "Northstar Commerce",
        typeLabel: "Cancellation trend",
        severity: "critical",
        severityLabel: "Attention needed",
        impact: "4 cancellations",
        statusLabel: "Reviewed",
        detectedLabel: "May 11, 11:45 AM",
        reviewedLabel: "May 11, 12:03 PM",
        actionLabel: "View account",
        href: previewAccountHref("Northstar Commerce"),
        previewDateBucket: "last30",
      },
      {
        id: "preview-history-mrr-drop-2",
        title: "Meaningful MRR drop",
        accountName: "BluePeak Studio",
        typeLabel: "Revenue trend",
        severity: "critical",
        severityLabel: "Attention needed",
        impact: "€260 MRR drop",
        statusLabel: "Reviewed",
        detectedLabel: "May 10, 9:25 AM",
        reviewedLabel: "May 10, 9:51 AM",
        actionLabel: "View account",
        href: previewAccountHref("BluePeak Studio"),
        previewDateBucket: "last30",
      },
      {
        id: "preview-history-canceled-3",
        title: "Subscription canceled",
        accountName: "Cedar Labs",
        typeLabel: "Cancellation",
        severity: "warning",
        severityLabel: "Review needed",
        impact: "€78 MRR impact",
        statusLabel: "Reviewed",
        detectedLabel: "May 9, 5:14 PM",
        reviewedLabel: "May 9, 5:30 PM",
        actionLabel: "View account",
        href: previewAccountHref("Cedar Labs"),
        previewDateBucket: "last30",
      },
      {
        id: "preview-history-failed-renewal-3",
        title: "Failed renewal",
        accountName: "BluePeak Studio",
        typeLabel: "Failed renewal",
        severity: "warning",
        severityLabel: "Review needed",
        impact: "€117 at risk",
        statusLabel: "Reviewed",
        detectedLabel: "May 8, 3:08 PM",
        reviewedLabel: "May 8, 3:19 PM",
        actionLabel: "View account",
        href: previewAccountHref("BluePeak Studio"),
        previewDateBucket: "last30",
      },
      {
        id: "preview-history-subscription-drop-3",
        title: "Subscription drop",
        accountName: "Northstar Commerce",
        typeLabel: "Subscription trend",
        severity: "critical",
        severityLabel: "Attention needed",
        impact: "9 → 6 active",
        statusLabel: "Reviewed",
        detectedLabel: "May 7, 2:02 PM",
        reviewedLabel: "May 7, 2:28 PM",
        actionLabel: "View account",
        href: previewAccountHref("Northstar Commerce"),
        previewDateBucket: "last30",
      },
      {
        id: "preview-history-past-due-3",
        title: "Past-due increase",
        accountName: "Cedar Labs",
        typeLabel: "Past-due",
        severity: "critical",
        severityLabel: "Attention needed",
        impact: "3 → 5 subscriptions",
        statusLabel: "Reviewed",
        detectedLabel: "May 6, 10:44 AM",
        reviewedLabel: "May 6, 11:01 AM",
        actionLabel: "View account",
        href: previewAccountHref("Cedar Labs"),
        previewDateBucket: "last30",
      },
      {
        id: "preview-history-unpaid-3",
        title: "Unpaid subscription",
        accountName: "Northstar Commerce",
        typeLabel: "Unpaid",
        severity: "warning",
        severityLabel: "Review needed",
        impact: "2 subscriptions",
        statusLabel: "Reviewed",
        detectedLabel: "May 5, 8:57 AM",
        reviewedLabel: "May 5, 9:15 AM",
        actionLabel: "View account",
        href: previewAccountHref("Northstar Commerce"),
        previewDateBucket: "last30",
      },
      {
        id: "preview-history-failed-renewal-spike-3",
        title: "Failed renewal spike",
        accountName: "BluePeak Studio",
        typeLabel: "Failed renewal",
        severity: "critical",
        severityLabel: "Attention needed",
        impact: "6 failed renewals",
        statusLabel: "Reviewed",
        detectedLabel: "May 4, 1:26 PM",
        reviewedLabel: "May 4, 1:49 PM",
        actionLabel: "View account",
        href: previewAccountHref("BluePeak Studio"),
        previewDateBucket: "last30",
      },
      {
        id: "preview-history-cancellation-spike-3",
        title: "Cancellation spike",
        accountName: "Cedar Labs",
        typeLabel: "Cancellation trend",
        severity: "critical",
        severityLabel: "Attention needed",
        impact: "7 cancellations",
        statusLabel: "Reviewed",
        detectedLabel: "May 3, 4:33 PM",
        reviewedLabel: "May 3, 4:58 PM",
        actionLabel: "View account",
        href: previewAccountHref("Cedar Labs"),
        previewDateBucket: "last30",
      },
      {
        id: "preview-history-mrr-drop-3",
        title: "Meaningful MRR drop",
        accountName: "Northstar Commerce",
        typeLabel: "Revenue trend",
        severity: "critical",
        severityLabel: "Attention needed",
        impact: "€180 MRR drop",
        statusLabel: "Reviewed",
        detectedLabel: "May 2, 9:40 AM",
        reviewedLabel: "May 2, 10:05 AM",
        actionLabel: "View account",
        href: previewAccountHref("Northstar Commerce"),
        previewDateBucket: "last30",
      },
      {
        id: "preview-history-canceled-4",
        title: "Subscription canceled",
        accountName: "BluePeak Studio",
        typeLabel: "Cancellation",
        severity: "warning",
        severityLabel: "Review needed",
        impact: "€39 MRR impact",
        statusLabel: "Reviewed",
        detectedLabel: "Apr 30, 3:47 PM",
        reviewedLabel: "Apr 30, 4:02 PM",
        actionLabel: "View account",
        href: previewAccountHref("BluePeak Studio"),
        previewDateBucket: "thisYear",
      },
      {
        id: "preview-history-failed-renewal-4",
        title: "Failed renewal",
        accountName: "Cedar Labs",
        typeLabel: "Failed renewal",
        severity: "warning",
        severityLabel: "Review needed",
        impact: "€78 at risk",
        statusLabel: "Reviewed",
        detectedLabel: "Apr 29, 12:11 PM",
        reviewedLabel: "Apr 29, 12:28 PM",
        actionLabel: "View account",
        href: previewAccountHref("Cedar Labs"),
        previewDateBucket: "thisYear",
      },
      {
        id: "preview-history-subscription-drop-4",
        title: "Subscription drop",
        accountName: "BluePeak Studio",
        typeLabel: "Subscription trend",
        severity: "critical",
        severityLabel: "Attention needed",
        impact: "12 → 8 active",
        statusLabel: "Reviewed",
        detectedLabel: "Apr 27, 2:52 PM",
        reviewedLabel: "Apr 27, 3:18 PM",
        actionLabel: "View account",
        href: previewAccountHref("BluePeak Studio"),
        previewDateBucket: "thisYear",
      },
      {
        id: "preview-history-past-due-4",
        title: "Past-due increase",
        accountName: "Northstar Commerce",
        typeLabel: "Past-due",
        severity: "critical",
        severityLabel: "Attention needed",
        impact: "2 → 5 subscriptions",
        statusLabel: "Reviewed",
        detectedLabel: "Apr 24, 9:16 AM",
        reviewedLabel: "Apr 24, 9:34 AM",
        actionLabel: "View account",
        href: previewAccountHref("Northstar Commerce"),
        previewDateBucket: "thisYear",
      },
      {
        id: "preview-history-unpaid-4",
        title: "Unpaid subscription",
        accountName: "BluePeak Studio",
        typeLabel: "Unpaid",
        severity: "warning",
        severityLabel: "Review needed",
        impact: "3 subscriptions",
        statusLabel: "Reviewed",
        detectedLabel: "Apr 22, 11:38 AM",
        reviewedLabel: "Apr 22, 11:55 AM",
        actionLabel: "View account",
        href: previewAccountHref("BluePeak Studio"),
        previewDateBucket: "thisYear",
      },
      {
        id: "preview-history-mrr-drop-4",
        title: "Meaningful MRR drop",
        accountName: "Cedar Labs",
        typeLabel: "Revenue trend",
        severity: "critical",
        severityLabel: "Attention needed",
        impact: "€540 MRR drop",
        statusLabel: "Reviewed",
        detectedLabel: "Apr 18, 8:22 AM",
        reviewedLabel: "Apr 18, 8:47 AM",
        actionLabel: "View account",
        href: previewAccountHref("Cedar Labs"),
        previewDateBucket: "thisYear",
      },
    ];

    const filteredReviewedRows = previewHistoryRows.filter((row) => {
      if (selectedAccount !== "all" && row.accountName !== selectedAccount) return false;
      if (selectedType !== "all" && row.typeLabel !== selectedType) return false;
      if (selectedDate !== "all-time") {
        if (selectedDate === "today" && row.previewDateBucket !== "today") return false;
        if (
          selectedDate === "last-7-days" &&
          !["today", "last7"].includes(row.previewDateBucket ?? "")
        ) {
          return false;
        }
        if (
          selectedDate === "last-30-days" &&
          !["today", "last7", "last30"].includes(row.previewDateBucket ?? "")
        ) {
          return false;
        }
        if (
          selectedDate === "this-month" &&
          !["today", "last7"].includes(row.previewDateBucket ?? "")
        ) {
          return false;
        }
        if (
          selectedDate === "this-year" &&
          !["today", "last7", "last30", "thisMonth", "thisYear"].includes(
            row.previewDateBucket ?? ""
          )
        ) {
          return false;
        }
      }

      return true;
    });

    totalPastAlerts = filteredReviewedRows.length;
    currentPastPage = Math.min(
      selectedPage,
      Math.max(1, Math.ceil(totalPastAlerts / PAST_ALERTS_PAGE_SIZE))
    );
    reviewedRows = filteredReviewedRows.slice(
      (currentPastPage - 1) * PAST_ALERTS_PAGE_SIZE,
      currentPastPage * PAST_ALERTS_PAGE_SIZE
    );
    compactSummaryLine = `${activeRows.length} current alert${
      activeRows.length === 1 ? "" : "s"
    } · ${totalPastAlerts} past alert${totalPastAlerts === 1 ? "" : "s"} · ${dateFilterLabel(
      selectedDate
    )}`;
  } else {
    const stripeAccounts = await prisma.stripeAccount.findMany({
      where: { userId: session.user.id },
      select: { stripeAccountId: true, name: true },
      orderBy: { createdAt: "desc" },
    });

    const accountIds = stripeAccounts.map((account) => account.stripeAccountId);
    const demoMode = hasDemoAccount(accountIds);
    const accountNameById = new Map(
      stripeAccounts.map((account) => [
        account.stripeAccountId,
        account.name?.trim() ||
          getDemoAccountById(account.stripeAccountId)?.name ||
          "Stripe account",
      ])
    );

    accountOptions = stripeAccounts
      .map(
        (account) =>
          account.name?.trim() ||
          getDemoAccountById(account.stripeAccountId)?.name ||
          "Stripe account"
      )
      .filter((value, index, values) => values.indexOf(value) === index);

    if (demoMode) {
      activeRows = getActiveDemoAlerts()
        .filter((account) => accountIds.some((id) => getDemoAccountById(id)?.id === account.id))
        .map((account) => ({
          id: `demo-alert-${account.id}`,
          title: alertLabel(account.alertType),
          accountName: getDemoAccountById(account.id)?.name ?? "Stripe account",
          typeLabel: typeLabel(account.alertType),
          severity: account.severity === "high" ? ("critical" as const) : ("warning" as const),
          severityLabel: account.severity === "high" ? "Attention needed" : "Review needed",
          impact: "Monitoring active",
          statusLabel: "Active" as const,
          detectedLabel: account.detectedAt ?? account.lastEvent,
          reviewedLabel: "—",
          actionLabel: "Review in Inbox",
          href: "/dashboard/inbox",
        }))
        .sort((left, right) => severityRank(left.severity) - severityRank(right.severity));

      const filteredReviewedRows = getDemoAlertHistory().map((entry, index) => {
        const severity =
          entry.type === "revenue_drop" || entry.type === "payment_failed"
            ? ("critical" as const)
            : ("warning" as const);

        const impact =
          entry.type === "revenue_drop"
            ? "Revenue drop detected"
            : entry.type === "payment_failed"
              ? "Failed payments elevated"
              : "Monitoring active";

        return {
          id: `demo-history-${index}`,
          title: alertLabel(entry.type),
          accountName: entry.accountName,
          typeLabel: typeLabel(entry.type),
          severity,
          severityLabel: severityLabel(severity),
          impact,
          statusLabel: "Reviewed" as const,
          detectedLabel: entry.timestamp,
          reviewedLabel: entry.timestamp,
          actionLabel: "View account",
          href: "/dashboard/accounts",
        };
      });

      totalPastAlerts = filteredReviewedRows.length;
      currentPastPage = Math.min(
        selectedPage,
        Math.max(1, Math.ceil(totalPastAlerts / PAST_ALERTS_PAGE_SIZE))
      );
      reviewedRows = filteredReviewedRows.slice(
        (currentPastPage - 1) * PAST_ALERTS_PAGE_SIZE,
        currentPastPage * PAST_ALERTS_PAGE_SIZE
      );
      compactSummaryLine = `${activeRows.length} current alert${
        activeRows.length === 1 ? "" : "s"
      } · ${totalPastAlerts} past alert${totalPastAlerts === 1 ? "" : "s"} · All time`;
    } else {
      const activeAlerts = await prisma.alert.findMany({
        where: {
          stripeAccountId: {
            in: accountIds,
          },
          status: "active",
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      const selectedAccountIds =
        selectedAccount === "all"
          ? accountIds
          : stripeAccounts
              .filter((account) => {
                const name =
                  account.name?.trim() ||
                  getDemoAccountById(account.stripeAccountId)?.name ||
                  "Stripe account";
                return name === selectedAccount;
              })
              .map((account) => account.stripeAccountId);
      const reviewedTypeValues = typeFilterValues(selectedType);
      const reviewedDateStart = dateFilterStart(selectedDate);

      const reviewedWhere = {
        stripeAccountId: {
          in: selectedAccountIds,
        },
        status: {
          not: "active" as const,
        },
        ...(reviewedTypeValues ? { type: { in: reviewedTypeValues } } : {}),
        ...(reviewedDateStart ? { createdAt: { gte: reviewedDateStart } } : {}),
      };

      totalPastAlerts = await prisma.alert.count({
        where: reviewedWhere,
      });

      currentPastPage = Math.min(
        selectedPage,
        Math.max(1, Math.ceil(totalPastAlerts / PAST_ALERTS_PAGE_SIZE))
      );

      const reviewedAlerts = await prisma.alert.findMany({
        where: reviewedWhere,
        orderBy: { createdAt: "desc" },
        skip: (currentPastPage - 1) * PAST_ALERTS_PAGE_SIZE,
        take: PAST_ALERTS_PAGE_SIZE,
      });

      activeRows = activeAlerts
        .sort((left, right) => {
          const severityDiff = severityRank(left.severity) - severityRank(right.severity);
          if (severityDiff !== 0) return severityDiff;
          return right.createdAt.getTime() - left.createdAt.getTime();
        })
        .map((alert) => ({
          id: alert.id,
          title: alertLabel(alert.type),
          accountName: alert.stripeAccountId
            ? accountNameById.get(alert.stripeAccountId) ?? "Stripe account"
            : "Stripe account",
          typeLabel: typeLabel(alert.type),
          severity: alert.severity === "critical" ? "critical" : "warning",
          severityLabel: severityLabel(alert.severity),
          impact: buildImpact(alert.type, alert.context),
          statusLabel: "Active",
          detectedLabel: formatDetectedLabel(alert.createdAt),
          reviewedLabel: "—",
          actionLabel: "Review in Inbox",
          href: "/dashboard/inbox",
        }));

      reviewedRows = reviewedAlerts.map((alert) => ({
        id: alert.id,
        title: alertLabel(alert.type),
        accountName: alert.stripeAccountId
          ? accountNameById.get(alert.stripeAccountId) ?? "Stripe account"
          : "Stripe account",
        typeLabel: typeLabel(alert.type),
        severity: alert.severity === "critical" ? "critical" : "warning",
        severityLabel: severityLabel(alert.severity),
        impact: buildImpact(alert.type, alert.context),
        statusLabel: "Reviewed",
        detectedLabel: formatHistoryTime(alert.createdAt),
        reviewedLabel: formatHistoryTime(alert.createdAt),
        actionLabel: "View account",
        href: alert.stripeAccountId
          ? `/dashboard/accounts/${encodeURIComponent(alert.stripeAccountId)}`
          : "/dashboard/accounts",
      }));

      compactSummaryLine = activeRows.length + totalPastAlerts
        ? `${activeRows.length} current alert${activeRows.length === 1 ? "" : "s"} · ${totalPastAlerts} past alert${totalPastAlerts === 1 ? "" : "s"} · ${dateFilterLabel(selectedDate)}`
        : "Showing alert history across connected accounts";
    }
  }

  const totalPastPages = Math.max(1, Math.ceil(totalPastAlerts / PAST_ALERTS_PAGE_SIZE));
  const pastStart = totalPastAlerts === 0 ? 0 : (currentPastPage - 1) * PAST_ALERTS_PAGE_SIZE + 1;
  const pastEnd =
    totalPastAlerts === 0
      ? 0
      : Math.min(totalPastAlerts, currentPastPage * PAST_ALERTS_PAGE_SIZE);
  const pageNumbers = Array.from({ length: totalPastPages }, (_, index) => index + 1).slice(
    Math.max(0, currentPastPage - 3),
    Math.min(totalPastPages, currentPastPage + 2)
  );
  const buildPastAlertsHref = (page: number) => {
    const query = new URLSearchParams();
    if (isPreviewMode) query.set("preview", "subscription-health");
    if (selectedAccount !== "all") query.set("account", selectedAccount);
    if (selectedType !== "all") query.set("type", selectedType);
    if (selectedDate !== "all-time") query.set("date", selectedDate);
    if (page > 1) query.set("page", String(page));
    const queryString = query.toString();
    return queryString ? `/dashboard/alerts?${queryString}#past-alerts` : "/dashboard/alerts#past-alerts";
  };

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <div className={styles.headerTitleRow}>
            <h1>Alerts</h1>
            {isPreviewMode ? <span className={styles.previewBadge}>PREVIEW DATA</span> : null}
          </div>
          <p>Browse subscription-health alert history across connected Stripe accounts.</p>
          <p className={styles.compactSummaryLine}>{compactSummaryLine}</p>
        </div>
      </header>

      <section className={styles.currentCard}>
        <div className={styles.logHeader}>
          <div>
            <h2>Current alerts</h2>
            <p>These alerts are still open and can be reviewed in Inbox.</p>
          </div>
        </div>

        {activeRows.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>No current alerts</strong>
            <p>Parveil is monitoring subscription health across your connected Stripe accounts.</p>
          </div>
        ) : (
          <div className={styles.feedSections}>
            <div className={styles.feedHeaderRowCurrent}>
              <span>Alert</span>
              <span>Impact</span>
              <span>Status</span>
              <span>Detected</span>
              <span>Action</span>
            </div>
            <div className={styles.feedList}>{activeRows.map((row) => renderCurrentRow(row))}</div>
          </div>
        )}
      </section>

      <section id="past-alerts" className={styles.logCard}>
        <div className={styles.logHeader}>
          <div>
            <h2>Past alerts</h2>
            <p>Reviewed alerts are kept here for history.</p>
          </div>
        </div>

        <section className={styles.filterBarCard} aria-label="Past alert filters">
          <form className={styles.filterBar} method="get">
            {isPreviewMode ? <input type="hidden" name="preview" value="subscription-health" /> : null}
            <label className={styles.filterSelectWrap}>
              <span className={styles.filterLabel}>Account</span>
              <select name="account" defaultValue={selectedAccount} className={styles.filterSelect}>
                <option value="all">All accounts</option>
                {accountOptions.map((accountName) => (
                  <option key={accountName} value={accountName}>
                    {accountName}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.filterSelectWrap}>
              <span className={styles.filterLabel}>Type</span>
              <select name="type" defaultValue={selectedType} className={styles.filterSelect}>
                <option value="all">All alert types</option>
                <option value="Cancellation">Cancellation</option>
                <option value="Failed renewal">Failed renewal</option>
                <option value="Subscription trend">Subscription trend</option>
                <option value="Past-due">Past-due</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Cancellation trend">Cancellation trend</option>
                <option value="Revenue trend">Revenue trend</option>
              </select>
            </label>
            <label className={styles.filterSelectWrap}>
              <span className={styles.filterLabel}>Date</span>
              <select name="date" defaultValue={selectedDate} className={styles.filterSelect}>
                <option value="all-time">All time</option>
                <option value="today">Today</option>
                <option value="last-7-days">Last 7 days</option>
                <option value="last-30-days">Last 30 days</option>
                <option value="this-month">This month</option>
                <option value="this-year">This year</option>
              </select>
            </label>
            <button type="submit" className={`${styles.filterControl} ${styles.filterApply}`}>
              Apply
            </button>
          </form>
        </section>

        {reviewedRows.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>{isPreviewMode ? "No alerts found" : "No past alerts"}</strong>
            <p>
              {isPreviewMode
                ? "Try changing the account, type, or date filter."
                : "Parveil is monitoring subscription health across your connected Stripe accounts."}
            </p>
          </div>
        ) : (
          <>
            <div className={styles.feedSections}>
              <div className={styles.feedHeaderRow}>
                <span>Alert</span>
                <span>Impact / Change</span>
                <span>Status</span>
                <span>Detected / Reviewed</span>
                <span>Action</span>
              </div>
              <div className={styles.feedList}>{reviewedRows.map((row) => renderHistoryRow(row))}</div>
            </div>
            <div className={styles.feedFooter}>
              <span>
                Showing {pastStart}–{pastEnd} of {totalPastAlerts} past alerts
              </span>
              {totalPastPages > 1 ? (
                <nav className={styles.pagination} aria-label="Past alerts pagination">
                  {currentPastPage > 1 ? (
                    <Link href={buildPastAlertsHref(currentPastPage - 1)} className={styles.paginationButton}>
                      Previous
                    </Link>
                  ) : (
                    <span className={`${styles.paginationButton} ${styles.paginationButtonDisabled}`}>
                      Previous
                    </span>
                  )}
                  <div className={styles.paginationPages}>
                    {pageNumbers.map((pageNumber) =>
                      pageNumber === currentPastPage ? (
                        <span
                          key={pageNumber}
                          className={`${styles.paginationButton} ${styles.paginationButtonActive}`}
                          aria-current="page"
                        >
                          {pageNumber}
                        </span>
                      ) : (
                        <Link
                          key={pageNumber}
                          href={buildPastAlertsHref(pageNumber)}
                          className={styles.paginationButton}
                        >
                          {pageNumber}
                        </Link>
                      )
                    )}
                  </div>
                  {currentPastPage < totalPastPages ? (
                    <Link href={buildPastAlertsHref(currentPastPage + 1)} className={styles.paginationButton}>
                      Next
                    </Link>
                  ) : (
                    <span className={`${styles.paginationButton} ${styles.paginationButtonDisabled}`}>
                      Next
                    </span>
                  )}
                </nav>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
