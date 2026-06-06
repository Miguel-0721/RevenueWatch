"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { markAlertReviewedAction } from "../accounts/[accountId]/actions";
import styles from "./page.module.css";

export type InboxIssueItem = {
  id: string;
  type: string;
  title: string;
  accountName: string;
  severity: "warning" | "critical";
  severityLabel: "Review needed" | "Attention needed";
  detectedLabel: string;
  message: string;
  impact?: string | null;
  whyFlagged?: string | null;
  accountHref: string;
  stripeAccountId?: string | null;
};

export type InboxHistoryItem = {
  id: string;
  type: string;
  title: string;
  accountName: string;
  time: string;
};

function severityTone(severity: InboxIssueItem["severity"]) {
  return severity === "critical" ? styles.issueSeverityCritical : styles.issueSeverityWarning;
}

function severityCardTone(severity: InboxIssueItem["severity"]) {
  return severity === "critical" ? styles.issueCardCritical : styles.issueCardWarning;
}

function deriveIssueSummary(count: number) {
  if (count === 0) return "No active issues";
  if (count === 1) return "1 issue needs review";
  return `${count} issues need review`;
}

function nextCheckCopy(type: InboxIssueItem["type"]) {
  if (type === "subscription_canceled") {
    return "Open the Stripe customer or subscription record to understand which plan was canceled and whether this is expected.";
  }

  if (type === "failed_renewal") {
    return "Review the failed invoice in Stripe and check whether Stripe’s retry or dunning flow is already handling it.";
  }

  if (type === "subscription_drop") {
    return "Review recent cancellations, failed renewals, and subscription status changes to understand what caused the drop.";
  }

  return "Review the related Stripe account context to understand what changed and whether follow-up is needed.";
}

export default function InboxReviewClient({
  issues,
  recentReviewed,
  reviewedRecentlyCount,
  isPreview,
  initialSelectedId,
}: {
  issues: InboxIssueItem[];
  recentReviewed: InboxHistoryItem[];
  reviewedRecentlyCount: number;
  isPreview: boolean;
  initialSelectedId?: string | null;
}) {
  const initialIndex = useMemo(() => {
    if (issues.length === 0) return -1;
    if (!initialSelectedId) return 0;
    const matchIndex = issues.findIndex((issue) => issue.id === initialSelectedId);
    return matchIndex >= 0 ? matchIndex : 0;
  }, [issues, initialSelectedId]);

  const [previewIssues, setPreviewIssues] = useState(issues);
  const [previewReviewed, setPreviewReviewed] = useState(recentReviewed);
  const [previewReviewedCount, setPreviewReviewedCount] = useState(reviewedRecentlyCount);
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [showPreviewReviewNote, setShowPreviewReviewNote] = useState(false);

  const currentIssues = isPreview ? previewIssues : issues;
  const currentReviewed = isPreview ? previewReviewed : recentReviewed;
  const reviewNeededCount = currentIssues.length;
  const attentionNeededCount = currentIssues.filter((issue) => issue.severity === "critical").length;
  const currentReviewedRecentlyCount = isPreview ? previewReviewedCount : reviewedRecentlyCount;

  const safeSelectedIndex =
    currentIssues.length === 0 ? -1 : Math.min(Math.max(selectedIndex, 0), currentIssues.length - 1);
  const selectedIssue = safeSelectedIndex >= 0 ? currentIssues[safeSelectedIndex] : null;

  const handlePreviewReview = () => {
    if (!selectedIssue) return;

    setPreviewIssues((current) => {
      const next = current.filter((issue) => issue.id !== selectedIssue.id);
      const nextSelectedIndex = next.length === 0 ? -1 : Math.min(safeSelectedIndex, next.length - 1);
      setSelectedIndex(nextSelectedIndex);
      return next;
    });

    setPreviewReviewed((current) => [
      {
        id: `${selectedIssue.id}-reviewed`,
        type: selectedIssue.type,
        title: selectedIssue.title,
        accountName: selectedIssue.accountName,
        time: "Just now",
      },
      ...current,
    ]);
    setPreviewReviewedCount((current) => current + 1);

    setShowPreviewReviewNote(true);
  };

  return (
    <section className={styles.reviewLayout}>
      <section className={styles.summaryStrip} aria-label="Inbox summary">
        <article className={styles.summaryCard}>
          <span>Needs review</span>
          <strong>{reviewNeededCount}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span>Attention needed</span>
          <strong>{attentionNeededCount}</strong>
        </article>
        <article className={styles.summaryCard}>
          <div className={styles.summaryCardHeader}>
            <span>Reviewed recently</span>
            <small className={styles.summaryMeta}>Last 7 days</small>
          </div>
          <strong>{currentReviewedRecentlyCount}</strong>
        </article>
      </section>

      {currentIssues.length === 0 ? (
        <div className={styles.emptyStateCard}>
          <div className={styles.emptyStateCopy}>
            <h2>No active issues</h2>
            <p>Parveil is monitoring subscription health across your connected Stripe accounts.</p>
            {isPreview && showPreviewReviewNote ? (
              <small className={styles.previewReviewNote}>
                Preview only. This reviewed state resets when you leave or refresh.
              </small>
            ) : null}
          </div>
          <div className={styles.reviewedPanel}>
            <div className={styles.reviewedHeader}>
              <div>
                <h3>Recently reviewed</h3>
                <p>Recent alerts that were reviewed or moved to history.</p>
              </div>
              <Link href="/dashboard/alerts" className={styles.sectionLink}>
                View history
              </Link>
            </div>
            <div className={styles.reviewedList}>
              {currentReviewed.slice(0, 3).map((item) => (
                <article key={item.id} className={styles.reviewedItem}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.accountName}</span>
                  </div>
                  <small>{item.time}</small>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.reviewGrid}>
          <section className={styles.issueListPanel}>
            <div className={styles.issueListHeader}>
              <h2>Active issues</h2>
              <p>What active subscription-health issues need review right now.</p>
            </div>

            <div className={styles.issueList}>
              {currentIssues.map((issue, index) => (
                <button
                  key={issue.id}
                  type="button"
                  className={`${styles.issueCardButton}${
                    index === safeSelectedIndex ? ` ${styles.issueCardButtonSelected}` : ""
                  }`}
                  onClick={() => setSelectedIndex(index)}
                >
                  <article
                    className={`${styles.issueCard} ${severityCardTone(issue.severity)}${
                      index === safeSelectedIndex ? ` ${styles.issueCardSelected}` : ""
                    }`}
                  >
                    <div className={styles.issueCardTop}>
                      <div>
                        <h3>{issue.title}</h3>
                        <p>{issue.accountName}</p>
                      </div>
                      <small>{issue.detectedLabel}</small>
                    </div>
                    <div className={styles.issueCardMeta}>
                      {issue.impact ? <span className={styles.impactPill}>{issue.impact}</span> : null}
                      <span className={`${styles.severityPill} ${severityTone(issue.severity)}`}>
                        {issue.severityLabel}
                      </span>
                    </div>
                  </article>
                </button>
              ))}
            </div>
          </section>

          <aside className={styles.issueDetailPanel}>
            {selectedIssue ? (
              <>
                <section className={styles.issueDetailsCard}>
                  <div className={styles.issueDetailHeader}>
                    <div>
                      <h2 className={styles.issueSectionTitle}>Issue details</h2>
                      <div className={styles.detailTitleRow}>
                        <h3>{selectedIssue.title}</h3>
                        <span className={`${styles.severityPill} ${severityTone(selectedIssue.severity)}`}>
                          {selectedIssue.severityLabel}
                        </span>
                      </div>
                      <div className={styles.detailMetaRow}>
                        <p className={styles.detailAccount}>{selectedIssue.accountName}</p>
                        <p className={styles.detailDetected}>Detected {selectedIssue.detectedLabel}</p>
                      </div>
                    </div>
                  </div>

                  <div className={styles.issueDetailCard}>
                    <div className={styles.detailBlock}>
                      <span className={styles.detailLabel}>Issue</span>
                      <p>{selectedIssue.message}</p>
                    </div>
                    {selectedIssue.impact ? (
                      <div className={styles.detailBlock}>
                        <span className={styles.detailLabel}>Impact</span>
                        <p>{selectedIssue.impact}</p>
                      </div>
                    ) : null}
                    {selectedIssue.whyFlagged ? (
                      <div className={styles.detailBlock}>
                        <span className={styles.detailLabel}>Why flagged</span>
                        <p>{selectedIssue.whyFlagged}</p>
                      </div>
                    ) : null}
                    <div className={styles.detailBlock}>
                      <span className={styles.detailLabel}>What to check next</span>
                      <p>{nextCheckCopy(selectedIssue.type)}</p>
                    </div>
                    <div className={styles.detailBlock}>
                      <span className={styles.detailLabel}>Monitoring note</span>
                      <p>
                        {selectedIssue.type === "failed_renewal"
                          ? "Parveil only monitors this issue. No payment retries or customer emails are sent by Parveil."
                          : "Parveil only monitors this issue. No Stripe changes are made."}
                      </p>
                    </div>
                  </div>

                  <div className={styles.issueActions}>
                    <Link href={selectedIssue.accountHref} className={styles.sectionLink}>
                      View account
                    </Link>
                    {isPreview ? (
                      <button
                        type="button"
                        className={styles.primaryAction}
                        onClick={handlePreviewReview}
                      >
                        Mark as reviewed
                      </button>
                    ) : selectedIssue.stripeAccountId ? (
                      <form action={markAlertReviewedAction}>
                        <input type="hidden" name="alertId" value={selectedIssue.id} />
                        <input
                          type="hidden"
                          name="stripeAccountId"
                          value={selectedIssue.stripeAccountId}
                        />
                        <button type="submit" className={styles.primaryAction}>
                          Mark as reviewed
                        </button>
                      </form>
                    ) : null}
                  </div>

                  {isPreview && showPreviewReviewNote ? (
                    <p className={styles.previewReviewNote}>
                      Preview only. This reviewed state resets when you leave or refresh.
                    </p>
                  ) : null}
                </section>

                <section className={styles.reviewedPanel}>
                  <div className={styles.reviewedHeader}>
                    <div>
                      <h3>Recently reviewed</h3>
                      <p>Recent alerts that were reviewed or moved to history.</p>
                    </div>
                    <Link href="/dashboard/alerts" className={styles.sectionLink}>
                      View history
                    </Link>
                  </div>
                  <div className={styles.reviewedList}>
                    {currentReviewed.slice(0, 3).map((item) => (
                      <article key={item.id} className={styles.reviewedItem}>
                        <div>
                          <strong>{item.title}</strong>
                          <span>{item.accountName}</span>
                        </div>
                        <small>{item.time}</small>
                      </article>
                    ))}
                  </div>
                </section>
              </>
            ) : null}
          </aside>
        </div>
      )}
    </section>
  );
}
