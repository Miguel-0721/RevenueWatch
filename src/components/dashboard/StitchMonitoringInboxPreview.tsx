"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import StitchIcon from "./StitchIcon";
import styles from "./StitchMonitoringInboxPreview.module.css";

const EURO = "\u20AC";
const RIGHT_ARROW = "\u2192";

type IssueTone = "neutral" | "warning" | "critical";

type PreviewIssue = {
  id: string;
  title: string;
  account: string;
  time: string;
  chips: Array<{ label: string; tone: IssueTone }>;
  icon: "cancel" | "error" | "trending_down";
  badge: string;
  summary: string;
  note: string;
  meta: Array<{ label: string; value: string; statusDot?: boolean }>;
  activity: Array<{ label: string; time: string }>;
};

const issues: PreviewIssue[] = [
  {
    id: "canceled",
    title: "Subscription canceled",
    account: "Northstar Commerce",
    time: "12m ago",
    chips: [
      { label: `${EURO}39 impact`, tone: "neutral" },
      { label: "Normal", tone: "neutral" },
    ],
    icon: "cancel",
    badge: "Monitoring active",
    summary:
      "A subscription was canceled. Parveil is monitoring the revenue impact and showing account context for review.",
    note: "Parveil only monitors this issue. No Stripe changes are made.",
    meta: [
      { label: "Revenue impact", value: `${EURO}39.00 / mo` },
      { label: "Status", value: "Canceled" },
      { label: "Plan", value: "Starter" },
      { label: "Detected", value: "Today, 11:18 UTC" },
    ],
    activity: [
      { label: "Subscription canceled", time: "Today, 11:18 UTC" },
      { label: "Account snapshot refreshed", time: "Today, 11:17 UTC" },
    ],
  },
  {
    id: "failed-renewal",
    title: "Failed renewal",
    account: "BluePeak Studio",
    time: "45m ago",
    chips: [
      { label: `${EURO}39 at risk`, tone: "warning" },
      { label: "Review needed", tone: "warning" },
    ],
    icon: "error",
    badge: "Review needed",
    summary:
      "A subscription renewal payment failed. The subscription is now past due and the monthly amount is at risk. Parveil is monitoring the issue and showing account context for review.",
    note: "Parveil only monitors this issue. No Stripe changes are made.",
    meta: [
      { label: "Amount at risk", value: `${EURO}39.00 / mo` },
      { label: "Status", value: "Past due", statusDot: true },
      { label: "Plan", value: "Growth" },
      { label: "Detected", value: "Today, 14:32 UTC" },
    ],
    activity: [
      { label: "Payment attempt failed", time: "Today, 14:32 UTC" },
      { label: "Invoice created", time: "Today, 14:30 UTC" },
    ],
  },
  {
    id: "subscription-drop",
    title: "Subscription drop detected",
    account: "Cedar Labs",
    time: "2h ago",
    chips: [
      { label: `10 ${RIGHT_ARROW} 7 active`, tone: "critical" },
      { label: "Attention needed", tone: "critical" },
    ],
    icon: "trending_down",
    badge: "Attention needed",
    summary:
      "Active subscriptions dropped from 10 to 7. Parveil is monitoring the change and showing recent account context for review.",
    note: "Parveil only monitors this issue. No Stripe changes are made.",
    meta: [
      { label: "Previous active", value: "10" },
      { label: "Current active", value: "7" },
      { label: "Drop", value: "3 subscriptions" },
      { label: "Detected", value: "Today, 12:25 UTC" },
    ],
    activity: [
      { label: "Snapshot recorded", time: "Today, 12:25 UTC" },
      { label: "Trend alert created", time: "Today, 12:24 UTC" },
    ],
  },
];

const monitoredAccounts = [
  {
    name: "Northstar Commerce",
    status: "Review needed",
    tone: "warning" as const,
    active: "124",
    mrr: `${EURO}6,420`,
  },
  {
    name: "BluePeak Studio",
    status: "Monitoring active",
    tone: "healthy" as const,
    active: "88",
    mrr: `${EURO}3,900`,
  },
  {
    name: "Cedar Labs",
    status: "Attention needed",
    tone: "critical" as const,
    active: "216",
    mrr: `${EURO}8,100`,
  },
];

const alertHistory = [
  {
    label: "Subscription canceled reviewed",
    account: "Northstar Commerce",
    time: "Yesterday, 16:10 UTC",
  },
  {
    label: "Failed renewal reviewed",
    account: "BluePeak Studio",
    time: "Yesterday, 13:42 UTC",
  },
  {
    label: "Cancellation spike reviewed",
    account: "Cedar Labs",
    time: "May 28, 11:06 UTC",
  },
];

function MetricSparkline({
  path,
  tone = "primary",
}: {
  path: string;
  tone?: "primary" | "critical";
}) {
  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className={`${styles.sparkline} ${
        tone === "critical" ? styles.sparklineCritical : styles.sparklinePrimary
      }`}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

export default function StitchMonitoringInboxPreview() {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const selectedIssue = useMemo(
    () => issues.find((issue) => issue.id === selectedIssueId) ?? null,
    [selectedIssueId]
  );

  return (
    <section className={styles.previewRoot}>
      <header className={styles.previewHeader}>
        <h1 className={styles.previewTitle}>Monitoring Inbox</h1>
        <p className={styles.previewSubtitle}>
          Reviewing 3 items requiring attention across connected accounts.
        </p>
      </header>

      <section className={styles.metricsBand} aria-label="Subscription health summary">
        <div className={styles.primaryMetrics}>
          <article className={styles.metricCard}>
            <div className={styles.metricCardHeader}>
              <div>
                <p className={styles.metricCardLabel}>Active Subscriptions</p>
                <h3 className={styles.metricCardValue}>428</h3>
              </div>
              <span className={styles.metricPillPositive}>
                <StitchIcon name="arrow_upward" className={styles.metricPillIcon} />
                4.2%
              </span>
            </div>
            <div className={styles.metricGraphWrap}>
              <MetricSparkline path="M0 25 L20 20 L40 22 L60 10 L80 15 L100 5" />
            </div>
          </article>

          <article className={styles.metricCard}>
            <div className={styles.metricCardHeader}>
              <div>
                <p className={styles.metricCardLabel}>Estimated MRR</p>
                <h3 className={styles.metricCardValue}>{EURO}18,420</h3>
              </div>
              <span className={styles.metricPillPositive}>
                <StitchIcon name="arrow_upward" className={styles.metricPillIcon} />
                1.8%
              </span>
            </div>
            <div className={styles.metricGraphWrap}>
              <MetricSparkline path="M0 28 L20 24 L40 18 L60 20 L80 8 L100 2" />
            </div>
          </article>
        </div>

        <div className={styles.metricsDivider} />

        <div className={styles.supportMetrics}>
          <article className={styles.supportCard}>
            <div>
              <p className={styles.supportLabelWarning}>Needs Review</p>
              <p className={styles.supportValue}>3</p>
            </div>
            <StitchIcon name="pending_actions" className={styles.supportIconWarning} />
          </article>

          <article className={styles.supportCard}>
            <div>
              <p className={styles.supportLabelCritical}>Failed Renewals</p>
              <div className={styles.supportValueRow}>
                <p className={styles.supportValue}>14</p>
                <span className={styles.supportDelta}>+2</span>
              </div>
            </div>
            <StitchIcon name="report" className={styles.supportIconCritical} />
          </article>
        </div>
      </section>

      <div
        className={`${styles.previewBody}${
          selectedIssue ? ` ${styles.previewBodyWithDetail}` : ` ${styles.previewBodyListOnly}`
        }`}
      >
        <div className={`${styles.leftPane}${selectedIssue ? "" : ` ${styles.leftPaneExpanded}`}`}>
          <div className={styles.leftContent}>
            <section>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Needs Review</h2>
                <span className={styles.sectionCount}>3</span>
              </div>

              <div className={styles.issueStack}>
                {issues.map((issue) => (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() => setSelectedIssueId(issue.id)}
                    className={`${styles.issueCardButton} ${
                      selectedIssue?.id === issue.id ? styles.issueCardSelected : ""
                    }`}
                  >
                    <div className={styles.issueCard}>
                      <div className={styles.issueIconWrap}>
                        <StitchIcon
                          name={issue.icon}
                          className={`${
                            issue.id === "failed-renewal"
                              ? styles.issueIconWarning
                              : issue.id === "subscription-drop"
                                ? styles.issueIconCritical
                                : styles.issueIconMuted
                          } ${styles.issueIcon}`}
                        />
                      </div>
                      <div className={styles.issueMain}>
                        <div className={styles.issueTopRow}>
                          <div className={styles.issueTitle}>{issue.title}</div>
                          <span
                            className={`${styles.issueTime}${
                              selectedIssue?.id === issue.id ? ` ${styles.issueTimeSelected}` : ""
                            }`}
                          >
                            {issue.time}
                          </span>
                        </div>
                        <div className={styles.issueAccount}>{issue.account}</div>
                        <div className={styles.issueChipRow}>
                          {issue.chips.map((chip) => (
                            <span
                              key={chip.label}
                              className={`${styles.issueChip} ${
                                chip.tone === "critical"
                                  ? styles.issueChipCritical
                                  : chip.tone === "warning"
                                    ? styles.issueChipWarning
                                    : styles.issueChipNeutral
                              }`}
                            >
                              {chip.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {!selectedIssue ? (
              <section className={styles.selectPrompt}>
                <div className={styles.selectPromptIconWrap}>
                  <StitchIcon name="inbox" className={styles.selectPromptIcon} />
                </div>
                <div>
                  <h3 className={styles.selectPromptTitle}>Select an issue to review details.</h3>
                  <p className={styles.selectPromptBody}>
                    Parveil keeps the inbox spacious first, then shows account context when you
                    choose an item that needs review.
                  </p>
                </div>
              </section>
            ) : null}

            <section className={styles.accountsSection}>
              <h2 className={styles.sectionTitle}>Monitored Accounts</h2>
              <div className={styles.accountsTableWrap}>
                <table className={styles.accountsTable}>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Active</th>
                      <th>MRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monitoredAccounts.map((account) => (
                      <tr key={account.name}>
                        <td>
                          <div className={styles.accountName}>{account.name}</div>
                          <div
                            className={`${styles.accountStatusText} ${
                              account.tone === "critical"
                                ? styles.accountStatusCritical
                                : account.tone === "warning"
                                  ? styles.accountStatusWarning
                                  : styles.accountStatusHealthy
                            }`}
                          >
                            {account.status}
                          </div>
                        </td>
                        <td>{account.active}</td>
                        <td>{account.mrr}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={styles.historySection}>
              <h2 className={styles.sectionTitle}>Alert History</h2>
              <div className={styles.historyCard}>
                {alertHistory.map((item) => (
                  <div key={item.label + item.time} className={styles.historyItem}>
                    <div className={styles.historyDot} />
                    <div className={styles.historyCopy}>
                      <div className={styles.historyLabel}>{item.label}</div>
                      <div className={styles.historyMeta}>
                        {item.account} {"\u00B7"} {item.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {selectedIssue ? (
          <aside className={styles.rightPane}>
            <div className={styles.detailHeader}>
              <div>
                <div className={styles.detailTitleRow}>
                  <StitchIcon
                    name={selectedIssue.icon === "cancel" ? "cancel" : selectedIssue.icon}
                    className={
                      selectedIssue.icon === "trending_down"
                        ? styles.detailCriticalIcon
                        : selectedIssue.icon === "cancel"
                          ? styles.detailMutedIcon
                          : styles.detailWarningIcon
                    }
                  />
                  <h2 className={styles.detailTitle}>{selectedIssue.title}</h2>
                </div>
                <p className={styles.detailAccount}>{selectedIssue.account}</p>
              </div>
              <div className={styles.detailHeaderActions}>
                <div className={styles.detailBadge}>{selectedIssue.badge}</div>
                <button
                  type="button"
                  className={styles.detailCloseButton}
                  onClick={() => setSelectedIssueId(null)}
                  aria-label="Close issue details"
                >
                  {"\u00D7"}
                </button>
              </div>
            </div>

            <div className={styles.detailContent}>
              <section className={styles.detailSection}>
                <h3 className={styles.detailSectionLabel}>Summary</h3>
                <p className={styles.detailSummary}>{selectedIssue.summary}</p>
                <p className={styles.detailNote}>{selectedIssue.note}</p>
              </section>

              <section className={styles.detailMetaGrid}>
                {selectedIssue.meta.map((item) => (
                  <div key={item.label}>
                    <div className={styles.detailMetaLabel}>{item.label}</div>
                    {item.statusDot ? (
                      <div className={styles.detailStatusRow}>
                        <span className={styles.detailStatusDot} />
                        <span>{item.value}</span>
                      </div>
                    ) : (
                      <div
                        className={
                          item.label === "Amount at risk" || item.label === "Revenue impact"
                            ? styles.detailMetaValue
                            : styles.detailMetaBody
                        }
                      >
                        {item.value}
                      </div>
                    )}
                  </div>
                ))}
              </section>

              <section className={styles.detailSection}>
                <h3 className={styles.detailSectionLabel}>Recent Account Activity</h3>
                <div className={styles.activityRail}>
                  {selectedIssue.activity.map((item) => (
                    <div key={item.label + item.time} className={styles.activityItem}>
                      <div className={styles.activityDot} />
                      <div>
                        <div className={styles.activityTitle}>{item.label}</div>
                        <div className={styles.activityTime}>{item.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className={styles.detailFooter}>
              <Link href="/dashboard/accounts" className={styles.secondaryButton}>
                View details
              </Link>
              <Link href="/dashboard/accounts" className={styles.primaryButton}>
                <StitchIcon name="check_circle" className={styles.buttonIcon} />
                Mark as reviewed
              </Link>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
