"use client";

import Link from "next/link";
import dashboardStyles from "@/app/dashboard/page.module.css";
import { markAlertReviewedAction } from "./actions";
import styles from "./page.module.css";

export type AccountDetailStatus = "Review needed" | "Monitoring active" | "Attention needed";

export type AccountDetailHistoryEntry = {
  id: string;
  typeLabel: string;
  message: string;
  timestamp: string;
};

export type AccountDetailCurrentIssue =
  | {
      title: string;
      detectedLabel: string;
      message: string;
      impact: string;
      status: AccountDetailStatus;
      reviewInInboxHref?: string;
      reviewAction?:
        | { kind: "preview"; onMarkReviewed: () => void }
        | { kind: "real"; alertId: string; stripeAccountId: string };
    }
  | null;

export type AccountDetailViewModel = {
  name: string;
  status: AccountDetailStatus;
  backHref: string;
  backLabel: string;
  activeSubscriptions: string | number;
  estimatedMrr: string | number;
  needsReview: string | number;
  failedRenewals: string | number;
  trials: string | number;
  pastDue: string | number;
  unpaid: string | number;
  canceled: string | number;
  netSubscriptions: string | number;
  currentIssueCountText: string;
  currentIssueTitle: string;
  currentIssue: AccountDetailCurrentIssue;
  history: AccountDetailHistoryEntry[];
  previewReviewNote?: string | null;
  activeSubscriptionsBadge?: string;
  estimatedMrrBadge?: string;
};

function statusTone(status: AccountDetailStatus) {
  if (status === "Attention needed") return styles.previewStatusAttention;
  if (status === "Review needed") return styles.previewStatusReview;
  return styles.previewStatusMonitoring;
}

function issueTone(status: AccountDetailStatus) {
  if (status === "Attention needed") return styles.previewIssueAttention;
  if (status === "Review needed") return styles.previewIssueReview;
  return styles.previewIssueMonitoring;
}

function secondaryTone(label: string) {
  if (label === "Past-due") return dashboardStyles.secondaryReview;
  if (label === "Unpaid") return dashboardStyles.secondaryAttention;
  if (label === "Net subscriptions") return dashboardStyles.secondaryPositive;
  return dashboardStyles.secondaryNeutral;
}

function InfoTooltip({ text }: { text: string }) {
  const tooltipId = `account-detail-tooltip-${text
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

function LargeMetricCard({
  label,
  value,
  helper,
  badge,
  tooltip,
}: {
  label: string;
  value: string | number;
  helper: string;
  badge?: string;
  tooltip?: string;
}) {
  return (
    <article className={`${dashboardStyles.metricCard} ${dashboardStyles.metricCardLarge}`}>
      <div className={dashboardStyles.metricCardHeader}>
        <span className={dashboardStyles.metricLabelRow}>
          <span className={dashboardStyles.metricLabel}>{label}</span>
          {tooltip ? <InfoTooltip text={tooltip} /> : null}
        </span>
        {badge ? <span className={dashboardStyles.metricTrendPill}>{badge}</span> : null}
      </div>
      <strong className={dashboardStyles.metricValue}>{value}</strong>
      <small className={dashboardStyles.metricHelper}>{helper}</small>
    </article>
  );
}

function CompactMetricCard({
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
          {tooltip ? <InfoTooltip text={tooltip} /> : null}
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

function SupportingMetricCard({
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
    <article className={`${dashboardStyles.secondaryCard} ${secondaryTone(label)}`}>
      <span className={dashboardStyles.secondaryLabelRow}>
        <span>{label}</span>
        {tooltip ? <InfoTooltip text={tooltip} /> : null}
      </span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

export default function AccountDetailView({
  viewModel,
}: {
  viewModel: AccountDetailViewModel;
}) {
  return (
    <main className={styles.page}>
      <div className={`${styles.shell} ${styles.previewShell}`}>
        <header className={styles.previewHeader}>
          <div className={styles.previewHeaderCopy}>
            <div className={styles.previewTitleRow}>
              <h1 className={styles.previewPageTitle}>{viewModel.name}</h1>
              <span className={`${styles.previewStatusPill} ${statusTone(viewModel.status)}`}>
                {viewModel.status}
              </span>
            </div>
            <p className={styles.previewHeaderSubtitle}>
              Subscription-health monitoring for this connected Stripe account.
            </p>
          </div>

          <div className={styles.previewHeaderActions}>
            <Link href={viewModel.backHref} className={styles.previewHeaderAction}>
              {viewModel.backLabel}
            </Link>
          </div>
        </header>

        <section className={styles.previewPrimaryMetrics}>
          <LargeMetricCard
            label="Active subscriptions"
            value={viewModel.activeSubscriptions}
            helper="Currently active paid subscriptions"
            badge={viewModel.activeSubscriptionsBadge}
          />
          <LargeMetricCard
            label="Estimated MRR"
            value={viewModel.estimatedMrr}
            helper="Active subscriptions only"
            badge={viewModel.estimatedMrrBadge}
            tooltip="Estimated monthly recurring revenue from active subscriptions only. Trials, canceled, unpaid, and past-due subscriptions are not counted."
          />
          <div className={dashboardStyles.metricStack}>
            <CompactMetricCard
              label="Needs review"
              value={viewModel.needsReview}
              helper="Active issues waiting in Inbox"
              pill="Inbox"
              tone="review"
            />
            <CompactMetricCard
              label="Failed renewals"
              value={viewModel.failedRenewals}
              helper="Failed payments · Last 7 days"
              pill="At risk"
              tone="risk"
              tooltip="Renewal invoice payments that failed in the last 7 days. For example, a customer's subscription tried to renew, but the payment did not go through."
            />
          </div>
        </section>

        <section className={styles.previewSecondaryMetrics}>
          <SupportingMetricCard label="Trials" value={viewModel.trials} helper="Currently in trial" />
          <SupportingMetricCard
            label="Past-due"
            value={viewModel.pastDue}
            helper="Payment not collected yet"
            tooltip="Subscriptions where Stripe has not collected the latest payment yet. If payment is completed and the subscription becomes active again, this count goes down."
          />
          <SupportingMetricCard
            label="Unpaid"
            value={viewModel.unpaid}
            helper="Marked unpaid in Stripe"
            tooltip="Subscriptions Stripe currently marks as unpaid after payment could not be collected. If the status changes, this count updates."
          />
          <SupportingMetricCard label="Canceled" value={viewModel.canceled} helper="Canceled · Last 7 days" />
          <SupportingMetricCard
            label="Net subscriptions"
            value={viewModel.netSubscriptions}
            helper="New minus canceled · This month"
            tooltip="New subscriptions minus canceled subscriptions during this month. For example, 20 new subscriptions and 2 cancellations means +18 net subscriptions."
          />
        </section>

        <section className={styles.previewLowerGrid}>
          <section className={styles.previewSectionCard}>
            <div className={styles.previewSectionHeader}>
              <div>
                <h2>{viewModel.currentIssueTitle}</h2>
                <p>{viewModel.currentIssueCountText}</p>
              </div>
            </div>

            {viewModel.currentIssue ? (
              <article
                className={`${styles.previewIssueCard} ${issueTone(viewModel.currentIssue.status)}`}
              >
                <div className={styles.previewIssueHeader}>
                  <div>
                    <strong>{viewModel.currentIssue.title}</strong>
                    <span>{viewModel.currentIssue.detectedLabel}</span>
                  </div>
                </div>
                <p>{viewModel.currentIssue.message}</p>
                <div className={styles.previewIssuePills}>
                  <span className={styles.previewIssueImpact}>{viewModel.currentIssue.impact}</span>
                  <span
                    className={`${styles.previewStatusPill} ${statusTone(viewModel.currentIssue.status)}`}
                  >
                    {viewModel.currentIssue.status}
                  </span>
                </div>
                <div className={styles.inlineMonitoringNote}>
                  Parveil only monitors this issue. No Stripe changes are made.
                </div>
                <div className={styles.previewIssueActions}>
                  {viewModel.currentIssue.reviewInInboxHref ? (
                    <Link
                      href={viewModel.currentIssue.reviewInInboxHref}
                      className={styles.previewActionSecondary}
                    >
                      Review in Inbox
                    </Link>
                  ) : null}
                  {viewModel.currentIssue.reviewAction?.kind === "preview" ? (
                    <button
                      type="button"
                      className={styles.previewActionPrimary}
                      onClick={viewModel.currentIssue.reviewAction.onMarkReviewed}
                    >
                      Mark as reviewed
                    </button>
                  ) : viewModel.currentIssue.reviewAction?.kind === "real" ? (
                    <form action={markAlertReviewedAction} className={styles.alertRowActions}>
                      <input
                        type="hidden"
                        name="alertId"
                        value={viewModel.currentIssue.reviewAction.alertId}
                      />
                      <input
                        type="hidden"
                        name="stripeAccountId"
                        value={viewModel.currentIssue.reviewAction.stripeAccountId}
                      />
                      <button type="submit" className={styles.previewActionPrimary}>
                        Mark as reviewed
                      </button>
                    </form>
                  ) : null}
                </div>
              </article>
            ) : (
              <div className={styles.previewEmptyState}>
                <strong>No active issues</strong>
                <p>Parveil is monitoring subscription health for this account.</p>
                {viewModel.previewReviewNote ? (
                  <small className={styles.previewReviewNote}>{viewModel.previewReviewNote}</small>
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
              {viewModel.history.length > 0 ? (
                viewModel.history.map((entry) => (
                  <article key={entry.id} className={styles.previewHistoryItem}>
                    <div className={styles.previewHistoryMain}>
                      <span className={styles.previewHistoryDot} aria-hidden="true" />
                      <div>
                        <strong>{entry.typeLabel}</strong>
                        <p>{entry.message}</p>
                      </div>
                    </div>
                    <div className={styles.previewHistoryMeta}>
                      <span className={styles.previewHistoryPill}>Reviewed</span>
                      <small>{entry.timestamp}</small>
                    </div>
                  </article>
                ))
              ) : (
                <div className={styles.previewEmptyState}>
                  <strong>No alert history</strong>
                  <p>Reviewed alerts will appear here after issues are resolved.</p>
                </div>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
