"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import dashboardStyles from "@/app/dashboard/page.module.css";
import {
  type PreviewAccountDetail,
} from "@/app/dashboard/previewData";
import styles from "./page.module.css";

type PreviewAccountStatus = "Review needed" | "Monitoring active" | "Attention needed";

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

function previewStatusTone(status: PreviewAccountStatus) {
  if (status === "Attention needed") return styles.previewStatusAttention;
  if (status === "Review needed") return styles.previewStatusReview;
  return styles.previewStatusMonitoring;
}

function previewIssueTone(status: PreviewAccountStatus) {
  if (status === "Attention needed") return styles.previewIssueAttention;
  if (status === "Review needed") return styles.previewIssueReview;
  return styles.previewIssueMonitoring;
}

function previewSecondaryTone(label: string) {
  if (label === "Past-due") return dashboardStyles.secondaryReview;
  if (label === "Unpaid") return dashboardStyles.secondaryAttention;
  if (label === "Net subscriptions") return dashboardStyles.secondaryPositive;
  return dashboardStyles.secondaryNeutral;
}

function derivePreviewStatus(issue: PreviewIssue | null): PreviewAccountStatus {
  if (!issue) return "Monitoring active";
  return issue.severity === "critical" ? "Attention needed" : "Review needed";
}

function formatIssueCount(count: number) {
  if (count === 0) return "No active issues";
  if (count === 1) return "1 issue needs review";
  return `${count} issues need review`;
}

function PreviewMetricSparkline({ points }: { points: number[] }) {
  const width = 216;
  const height = 44;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(1, max - min);
  const step = width / Math.max(1, points.length - 1);

  const coordinates = points.map((point, index) => {
    const x = index * step;
    const y = height - ((point - min) / range) * (height - 8) - 4;
    return { x, y };
  });

  const linePath = coordinates.reduce((accumulator, point, index, array) => {
    if (index === 0) {
      return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }

    const previous = array[index - 1];
    const midpointX = ((previous.x + point.x) / 2).toFixed(2);
    return `${accumulator} Q ${previous.x.toFixed(2)} ${previous.y.toFixed(2)} ${midpointX} ${(
      (previous.y + point.y) / 2
    ).toFixed(2)} T ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }, "");

  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1]?.x.toFixed(2)} ${height} L ${coordinates[0]?.x.toFixed(2)} ${height} Z`;

  return (
    <svg
      className={styles.previewSparkline}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      <path className={styles.previewSparklineArea} d={areaPath} />
      <path className={styles.previewSparklineLine} d={linePath} />
    </svg>
  );
}

function PreviewInfoTooltip({ text }: { text: string }) {
  const tooltipId = `account-preview-tooltip-${text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;

  return (
    <span className={dashboardStyles.infoTooltipWrap}>
      <button
        type="button"
        className={dashboardStyles.infoTooltip}
        aria-label={text}
        aria-describedby={tooltipId}
      >
        i
      </button>
      <span id={tooltipId} role="tooltip" className={dashboardStyles.infoTooltipBubble}>
        {text}
      </span>
    </span>
  );
}

function PreviewLargeMetricCard({
  label,
  value,
  helper,
  badge,
  points,
  tooltip,
}: {
  label: string;
  value: string | number;
  helper: string;
  badge: string;
  points: number[];
  tooltip?: string;
}) {
  return (
    <article className={`${dashboardStyles.metricCard} ${dashboardStyles.metricCardLarge}`}>
      <div className={dashboardStyles.metricCardHeader}>
        <span className={dashboardStyles.metricLabelRow}>
          <span className={dashboardStyles.metricLabel}>{label}</span>
          {tooltip ? <PreviewInfoTooltip text={tooltip} /> : null}
        </span>
        <span className={dashboardStyles.metricTrendPill}>{badge}</span>
      </div>
      <strong className={dashboardStyles.metricValue}>{value}</strong>
      <div className={dashboardStyles.metricSparklineWrap}>
        <PreviewMetricSparkline points={points} />
      </div>
      <small className={dashboardStyles.metricHelper}>{helper}</small>
    </article>
  );
}

function PreviewCompactMetricCard({
  label,
  value,
  helper,
  pill,
  tone,
  tooltip,
}: {
  label: string;
  value: string | number;
  helper: string;
  pill: string;
  tone: "review" | "risk";
  tooltip?: string;
}) {
  return (
    <article className={`${dashboardStyles.metricCard} ${dashboardStyles.metricCardCompact}`}>
      <div className={dashboardStyles.metricCardHeader}>
        <span className={dashboardStyles.metricLabelRow}>
          <span className={dashboardStyles.metricLabel}>{label}</span>
          {tooltip ? <PreviewInfoTooltip text={tooltip} /> : null}
        </span>
        <span
          className={
            tone === "risk" ? dashboardStyles.metricBadgeRisk : dashboardStyles.metricBadgeReview
          }
        >
          {pill}
        </span>
      </div>
      <strong className={dashboardStyles.metricValueSmall}>{value}</strong>
      <small className={dashboardStyles.metricHelper}>{helper}</small>
    </article>
  );
}

function PreviewSupportingMetricCard({
  label,
  value,
  helper,
  tooltip,
}: {
  label: string;
  value: string | number;
  helper: string;
  tooltip?: string;
}) {
  return (
    <article className={`${dashboardStyles.secondaryCard} ${previewSecondaryTone(label)}`}>
      <span className={dashboardStyles.secondaryLabelRow}>
        <span>{label}</span>
        {tooltip ? <PreviewInfoTooltip text={tooltip} /> : null}
      </span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

export default function PreviewAccountDetailClient({
  previewAccount,
}: {
  previewAccount: PreviewAccountDetail;
}) {
  const [activeIssue, setActiveIssue] = useState<PreviewIssue | null>(previewAccount.currentIssue);
  const [historyEntries, setHistoryEntries] = useState<PreviewHistoryEntry[]>(previewAccount.history);
  const [showPreviewReviewNote, setShowPreviewReviewNote] = useState(false);

  const primaryTrendByAccount: Record<
    string,
    { active: string; mrr: string; activePoints: number[]; mrrPoints: number[] }
  > = {
    "northstar-commerce": {
      active: "+3.4% this month",
      mrr: "+2.1% this month",
      activePoints: [92, 98, 101, 109, 112, 124],
      mrrPoints: [5400, 5520, 5660, 5890, 6110, 6420],
    },
    "bluepeak-studio": {
      active: "+2.6% this month",
      mrr: "+1.8% this month",
      activePoints: [74, 76, 79, 81, 84, 88],
      mrrPoints: [3320, 3390, 3510, 3600, 3720, 3900],
    },
    "cedar-labs": {
      active: "+4.1% this month",
      mrr: "+2.7% this month",
      activePoints: [182, 188, 194, 201, 207, 216],
      mrrPoints: [7240, 7380, 7520, 7710, 7890, 8100],
    },
  };

  const primaryTrend =
    primaryTrendByAccount[previewAccount.slug] ?? primaryTrendByAccount["northstar-commerce"];
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

  return (
    <main className={styles.page}>
      <div className={`${styles.shell} ${styles.previewShell}`}>
        <header className={styles.previewHeader}>
          <div className={styles.previewHeaderCopy}>
            <div className={styles.previewTitleRow}>
              <h1 className={styles.previewPageTitle}>{previewAccount.name}</h1>
              <span className={`${styles.previewStatusPill} ${previewStatusTone(accountStatus)}`}>
                {accountStatus}
              </span>
            </div>
            <p className={styles.previewHeaderSubtitle}>
              Subscription-health monitoring for this connected Stripe account.
            </p>
          </div>

          <div className={styles.previewHeaderActions}>
            <Link href="/dashboard?preview=subscription-health" className={styles.previewHeaderAction}>
              Back to dashboard
            </Link>
          </div>
        </header>

        <section className={styles.previewPrimaryMetrics}>
          <PreviewLargeMetricCard
            label="Active subscriptions"
            value={previewAccount.activeSubscriptions}
            helper="Currently active paid subscriptions"
            badge={primaryTrend.active}
            points={primaryTrend.activePoints}
          />
          <PreviewLargeMetricCard
            label="Estimated MRR"
            value={previewAccount.estimatedMrr}
            helper="Active subscriptions only"
            badge={primaryTrend.mrr}
            points={primaryTrend.mrrPoints}
            tooltip="Estimated monthly recurring revenue from active subscriptions only. Trials, canceled, unpaid, and past-due subscriptions are not counted."
          />
          <div className={dashboardStyles.metricStack}>
            <PreviewCompactMetricCard
              label="Needs review"
              value={reviewCount}
              helper="Active issues waiting in Inbox"
              pill="Inbox"
              tone="review"
            />
            <PreviewCompactMetricCard
              label="Failed renewals"
              value={previewAccount.failedRenewals}
              helper="Failed payments · Last 7 days"
              pill="At risk"
              tone="risk"
              tooltip="Renewal invoice payments that failed in the last 7 days. For example, a customer's subscription tried to renew, but the payment did not go through."
            />
          </div>
        </section>

        <section className={styles.previewSecondaryMetrics}>
          <PreviewSupportingMetricCard
            label="Trials"
            value={previewAccount.trials}
            helper="Currently in trial"
          />
          <PreviewSupportingMetricCard
            label="Past-due"
            value={previewAccount.pastDue}
            helper="Payment not collected yet"
            tooltip="Subscriptions where Stripe has not collected the latest payment yet. If payment is completed and the subscription becomes active again, this count goes down."
          />
          <PreviewSupportingMetricCard
            label="Unpaid"
            value={previewAccount.unpaid}
            helper="Marked unpaid in Stripe"
            tooltip="Subscriptions Stripe currently marks as unpaid after payment could not be collected. If the status changes, this count updates."
          />
          <PreviewSupportingMetricCard
            label="Canceled"
            value={previewAccount.canceledThisWeek}
            helper="Canceled · Last 7 days"
          />
          <PreviewSupportingMetricCard
            label="Net subscriptions"
            value={previewNetMovement > 0 ? `+${previewNetMovement}` : previewNetMovement}
            helper="New minus canceled · This month"
            tooltip="New subscriptions minus canceled subscriptions during this month. For example, 20 new subscriptions and 2 cancellations means +18 net subscriptions."
          />
        </section>

        <section className={styles.previewLowerGrid}>
          <section className={styles.previewSectionCard}>
            <div className={styles.previewSectionHeader}>
              <div>
                <h2>{reviewCount > 1 ? "Current issues" : "Current issue"}</h2>
                <p>{issueContextText}</p>
              </div>
            </div>

            {activeIssue ? (
              <article className={`${styles.previewIssueCard} ${previewIssueTone(accountStatus)}`}>
                <div className={styles.previewIssueHeader}>
                  <div>
                    <strong>{alertLabel(activeIssue.type)}</strong>
                    <span>{activeIssue.detectedLabel}</span>
                  </div>
                </div>
                <p>{activeIssue.message}</p>
                <div className={styles.previewIssuePills}>
                  <span className={styles.previewIssueImpact}>{activeIssue.impact}</span>
                  <span className={`${styles.previewStatusPill} ${previewStatusTone(accountStatus)}`}>
                    {accountStatus}
                  </span>
                </div>
                <div className={styles.previewIssueActions}>
                  <Link href={reviewInInboxHref} className={styles.previewActionSecondary}>
                    Review in Inbox
                  </Link>
                  <button type="button" className={styles.previewActionPrimary} onClick={handleMarkReviewed}>
                    Mark as reviewed
                  </button>
                </div>
              </article>
            ) : (
              <div className={styles.previewEmptyState}>
                <strong>No active issues</strong>
                <p>Parveil is monitoring subscription health for this account.</p>
                {showPreviewReviewNote ? (
                  <small className={styles.previewReviewNote}>
                    Preview only. This reviewed state resets when you leave or refresh.
                  </small>
                ) : null}
              </div>
            )}
          </section>

          <section className={styles.previewSectionCard}>
            <div className={styles.previewSectionHeader}>
              <div>
                <h2>Alert history</h2>
                <p>Recent alerts that were reviewed or moved to history.</p>
              </div>
            </div>

            <div className={styles.previewHistoryList}>
              {historyEntries.map((entry) => (
                <article key={entry.id} className={styles.previewHistoryItem}>
                  <div className={styles.previewHistoryMain}>
                    <span className={styles.previewHistoryDot} aria-hidden="true" />
                    <div>
                      <strong>{alertLabel(entry.type)}</strong>
                      <p>{entry.message}</p>
                    </div>
                  </div>
                  <div className={styles.previewHistoryMeta}>
                    <span className={styles.previewHistoryPill}>Reviewed</span>
                    <small>{entry.timestamp}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

