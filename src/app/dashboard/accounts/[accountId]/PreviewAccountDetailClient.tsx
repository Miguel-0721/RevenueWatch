"use client";

import { useMemo, useState } from "react";
import {
  type PreviewAccountDetail,
} from "@/app/dashboard/previewData";
import { buildDashboardSparklineSeries } from "@/components/dashboard/SubscriptionHealthMetricCards";
import AccountDetailView, {
  type AccountDetailCurrentIssue,
  type AccountDetailHistoryEntry,
  type AccountDetailStatus,
  type AccountDetailViewModel,
} from "./AccountDetailView";

type PreviewIssue = PreviewAccountDetail["currentIssue"];
type PreviewHistoryEntry = PreviewAccountDetail["history"][number];

function alertLabel(type: PreviewIssue["type"] | PreviewHistoryEntry["type"]) {
  if (type === "subscription_canceled") return "Subscription canceled";
  if (type === "failed_renewal") return "Failed renewal";
  if (type === "subscription_drop") return "Subscription drop";
  if (type === "past_due_increase") return "Past-due increase";
  if (type === "unpaid_subscription") return "Unpaid subscription";
  return (type as string).replace(/_/g, " ");
}

function derivePreviewStatus(issue: PreviewIssue | null): AccountDetailStatus {
  if (!issue) return "Monitoring active";
  return issue.severity === "critical" ? "Attention needed" : "Review needed";
}

function formatIssueCount(count: number) {
  if (count === 0) return "No active issues";
  if (count === 1) return "1 issue needs review";
  return `${count} issues need review`;
}

function parsePreviewMoneyAmount(value: string) {
  return Number.parseInt(value.replace(/[^0-9-]/g, ""), 10) || 0;
}

export default function PreviewAccountDetailClient({
  previewAccount,
}: {
  previewAccount: PreviewAccountDetail;
}) {
  const [activeIssue, setActiveIssue] = useState<PreviewIssue | null>(previewAccount.currentIssue);
  const [historyEntries, setHistoryEntries] = useState<PreviewHistoryEntry[]>(previewAccount.history);
  const [showPreviewReviewNote, setShowPreviewReviewNote] = useState(false);

  const primaryTrendByAccount: Record<string, { active: string; mrr: string }> = {
    "northstar-commerce": {
      active: "+3.4% this month",
      mrr: "+2.1% this month",
    },
    "bluepeak-studio": {
      active: "+2.6% this month",
      mrr: "+1.8% this month",
    },
    "cedar-labs": {
      active: "+4.1% this month",
      mrr: "+2.7% this month",
    },
  };

  const primaryTrend =
    primaryTrendByAccount[previewAccount.slug] ?? primaryTrendByAccount["northstar-commerce"];
  const previewEstimatedMrrAmount = parsePreviewMoneyAmount(previewAccount.estimatedMrr);
  const previewNetMovement = Number.parseInt(previewAccount.netSubscriptions, 10) || 0;
  const reviewCount = activeIssue ? 1 : 0;
  const accountStatus = derivePreviewStatus(activeIssue);
  const issueContextText = useMemo(() => formatIssueCount(reviewCount), [reviewCount]);

  const reviewInInboxHref = `/dashboard/inbox?preview=subscription-health&account=${encodeURIComponent(
    previewAccount.slug,
  )}${activeIssue ? `&alert=${encodeURIComponent(activeIssue.id)}` : ""}`;

  const handleMarkReviewed = () => {
    if (!activeIssue) return;

    const reviewedEntry: PreviewHistoryEntry = {
      id: `${activeIssue.id}-reviewed`,
      type: activeIssue.type,
      message: activeIssue.message,
      timestamp: "Just now",
    };

    setHistoryEntries((current) => [reviewedEntry, ...current]);
    setActiveIssue(null);
    setShowPreviewReviewNote(true);
  };

  const currentIssue: AccountDetailCurrentIssue = activeIssue
    ? {
        title: alertLabel(activeIssue.type),
        detectedLabel: activeIssue.detectedLabel,
        message: activeIssue.message,
        impact: activeIssue.impact,
        status: accountStatus,
        reviewInInboxHref,
        reviewAction: { kind: "preview", onMarkReviewed: handleMarkReviewed },
      }
    : null;

  const history: AccountDetailHistoryEntry[] = historyEntries.map((entry) => ({
    id: entry.id,
    typeLabel: alertLabel(entry.type),
    message: entry.message,
    timestamp: entry.timestamp,
  }));

  const viewModel: AccountDetailViewModel = {
    name: previewAccount.name,
    status: accountStatus,
    backHref: "/dashboard?preview=subscription-health",
    backLabel: "Back to dashboard",
    activeSubscriptions: previewAccount.activeSubscriptions,
    estimatedMrr: previewAccount.estimatedMrr,
    needsReview: reviewCount,
    failedRenewals: previewAccount.failedRenewals,
    trials: previewAccount.trials,
    pastDue: previewAccount.pastDue,
    unpaid: previewAccount.unpaid,
    canceled: previewAccount.canceledThisWeek,
    netSubscriptions: previewNetMovement > 0 ? `+${previewNetMovement}` : previewNetMovement,
    activeSubscriptionsHref: `/dashboard/subscriptions?preview=subscription-health&account=${encodeURIComponent(
      previewAccount.slug,
    )}&type=active`,
    failedRenewalsHref: `/dashboard/subscriptions?preview=subscription-health&account=${encodeURIComponent(
      previewAccount.slug,
    )}&type=failed-renewal&window=7d`,
    trialsHref: `/dashboard/subscriptions?preview=subscription-health&account=${encodeURIComponent(
      previewAccount.slug,
    )}&type=trialing`,
    pastDueHref: `/dashboard/subscriptions?preview=subscription-health&account=${encodeURIComponent(
      previewAccount.slug,
    )}&type=past-due`,
    unpaidHref: `/dashboard/subscriptions?preview=subscription-health&account=${encodeURIComponent(
      previewAccount.slug,
    )}&type=unpaid`,
    canceledHref: `/dashboard/subscriptions?preview=subscription-health&account=${encodeURIComponent(
      previewAccount.slug,
    )}&type=canceled&window=7d`,
    activeSubscriptionsSparkline: buildDashboardSparklineSeries({
      variant: "active",
      finalValue: previewAccount.activeSubscriptions,
    }),
    estimatedMrrSparkline: buildDashboardSparklineSeries({
      variant: "mrr",
      finalValue: previewEstimatedMrrAmount,
    }),
    currentIssueCountText: issueContextText,
    currentIssueTitle: reviewCount > 1 ? "Current issues" : "Current issue",
    currentIssue,
    history,
    previewReviewNote: showPreviewReviewNote
      ? "Preview only. This reviewed state resets when you leave or refresh."
      : null,
    activeSubscriptionsBadge: primaryTrend.active,
    estimatedMrrBadge: primaryTrend.mrr,
  };

  return <AccountDetailView viewModel={viewModel} />;
}
