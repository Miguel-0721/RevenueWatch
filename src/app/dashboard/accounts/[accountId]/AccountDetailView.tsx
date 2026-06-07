"use client";

import Link from "next/link";
import dashboardStyles from "@/app/dashboard/page.module.css";
import {
  MetricCard,
  SecondaryMetricCard,
} from "@/components/dashboard/SubscriptionHealthMetricCards";
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
  activeSubscriptionsHref?: string;
  failedRenewalsHref?: string;
  trialsHref?: string;
  pastDueHref?: string;
  unpaidHref?: string;
  canceledHref?: string;
  activeSubscriptionsSparkline?: number[];
  estimatedMrrSparkline?: number[];
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

        <section className={dashboardStyles.primaryMetrics}>
          <MetricCard
            label="Active subscriptions"
            value={viewModel.activeSubscriptions}
            helper="Currently active paid subscriptions"
            badgeLabel={viewModel.activeSubscriptionsBadge}
            sparkline={viewModel.activeSubscriptionsSparkline}
            href={viewModel.activeSubscriptionsHref}
            ariaLabel="View active subscriptions details"
          />
          <MetricCard
            label="Estimated MRR"
            value={viewModel.estimatedMrr}
            helper="Active subscriptions only"
            badgeLabel={viewModel.estimatedMrrBadge}
            sparkline={viewModel.estimatedMrrSparkline}
            tooltip="Estimated monthly recurring revenue from active subscriptions only. Trials, canceled, unpaid, and past-due subscriptions are not counted."
          />
          <div className={dashboardStyles.metricStack}>
            <MetricCard
              label="Needs review"
              value={viewModel.needsReview}
              helper="Active issues waiting in Inbox"
              compact
              badgeLabel="Inbox"
              tone="review"
            />
            <MetricCard
              label="Failed renewals"
              value={viewModel.failedRenewals}
              helper="Failed payments · Last 7 days"
              compact
              badgeLabel="At risk"
              tone="risk"
              tooltip="Renewal invoice payments that failed in the last 7 days. For example, a customer's subscription tried to renew, but the payment did not go through."
              href={viewModel.failedRenewalsHref}
              ariaLabel="View failed renewals details"
            />
          </div>
        </section>

        <section className={dashboardStyles.secondaryMetrics}>
          <SecondaryMetricCard
            label="Trials"
            value={viewModel.trials}
            helper="Currently in trial"
            toneClassName={dashboardStyles.secondaryNeutral}
            href={viewModel.trialsHref}
            ariaLabel="View trialing subscriptions details"
          />
          <SecondaryMetricCard
            label="Past-due"
            value={viewModel.pastDue}
            helper="Payment not collected yet"
            toneClassName={dashboardStyles.secondaryReview}
            tooltip="Subscriptions where Stripe has not collected the latest payment yet. If payment is completed and the subscription becomes active again, this count goes down."
            href={viewModel.pastDueHref}
            ariaLabel="View past-due subscriptions details"
          />
          <SecondaryMetricCard
            label="Unpaid"
            value={viewModel.unpaid}
            helper="Marked unpaid in Stripe"
            toneClassName={dashboardStyles.secondaryAttention}
            tooltip="Subscriptions Stripe currently marks as unpaid after payment could not be collected. If the status changes, this count updates."
            href={viewModel.unpaidHref}
            ariaLabel="View unpaid subscriptions details"
          />
          <SecondaryMetricCard
            label="Canceled"
            value={viewModel.canceled}
            helper="Canceled · Last 7 days"
            toneClassName={dashboardStyles.secondaryNeutral}
            href={viewModel.canceledHref}
            ariaLabel="View canceled subscriptions details"
          />
          <SecondaryMetricCard
            label="Net subscriptions"
            value={viewModel.netSubscriptions}
            helper="New minus canceled · This month"
            toneClassName={dashboardStyles.secondaryPositive}
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
