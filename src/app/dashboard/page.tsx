import { auth } from "@/auth";
import MarketingFooter from "@/components/MarketingFooter";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type AlertRecord = {
  id: string;
  type: string;
  severity: string;
  message: string;
  stripeAccountId: string | null;
  accountName?: string | null;
  createdAt: Date;
  windowEnd: Date;
  context?: string | null;
};

type AccountRecord = {
  id: string;
  name: string | null;
  stripeAccountId: string;
  status: string;
  createdAt: Date;
};

// TEMP VISUAL TEST DATA: set to false or remove this block after dashboard review.
const USE_TEMP_DASHBOARD_SAMPLE_DATA = true;

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function buildTemporaryDashboardSampleData() {
  const accounts: AccountRecord[] = [
    {
      id: "sample-1",
      name: "Atlas Commerce",
      stripeAccountId: "acct_sample_atlas",
      status: "active",
      createdAt: minutesAgo(9200),
    },
    {
      id: "sample-2",
      name: "Northstar Digital",
      stripeAccountId: "acct_sample_northstar",
      status: "active",
      createdAt: minutesAgo(8800),
    },
    {
      id: "sample-3",
      name: "BluePeak Subscriptions",
      stripeAccountId: "acct_sample_bluepeak",
      status: "active",
      createdAt: minutesAgo(8300),
    },
    {
      id: "sample-4",
      name: "Meridian Market",
      stripeAccountId: "acct_sample_meridian",
      status: "active",
      createdAt: minutesAgo(7900),
    },
    {
      id: "sample-5",
      name: "Luma Health Co",
      stripeAccountId: "acct_sample_luma",
      status: "active",
      createdAt: minutesAgo(7400),
    },
    {
      id: "sample-6",
      name: "Forge Analytics",
      stripeAccountId: "acct_sample_forge",
      status: "active",
      createdAt: minutesAgo(7000),
    },
    {
      id: "sample-7",
      name: "Cedar Creative",
      stripeAccountId: "acct_sample_cedar",
      status: "active",
      createdAt: minutesAgo(6600),
    },
    {
      id: "sample-8",
      name: "Pixel Harbor",
      stripeAccountId: "acct_sample_pixel",
      status: "active",
      createdAt: minutesAgo(6200),
    },
    {
      id: "sample-9",
      name: "BrightGrowth Studio",
      stripeAccountId: "acct_sample_brightgrowth",
      status: "active",
      createdAt: minutesAgo(5800),
    },
    {
      id: "sample-10",
      name: "Nova Ops",
      stripeAccountId: "acct_sample_nova",
      status: "active",
      createdAt: minutesAgo(5400),
    },
  ];

  const alerts: AlertRecord[] = [
    {
      id: "sample-alert-1",
      type: "payment_failed",
      severity: "critical",
      message: "Payment failures spiked above normal levels in the last 30 minutes.",
      stripeAccountId: "acct_sample_atlas",
      accountName: "Atlas Commerce",
      createdAt: minutesAgo(38),
      windowEnd: minutesFromNow(142),
      context: JSON.stringify({
        failedPayments: 18,
        baseline: 4,
      }),
    },
    {
      id: "sample-alert-2",
      type: "revenue_drop",
      severity: "critical",
      message: "Revenue is significantly below expected levels for this account.",
      stripeAccountId: "acct_sample_northstar",
      accountName: "Northstar Digital",
      createdAt: minutesAgo(74),
      windowEnd: minutesFromNow(106),
      context: JSON.stringify({
        expectedRevenue: 8200,
        currentRevenue: 4920,
      }),
    },
    {
      id: "sample-alert-3",
      type: "payment_failed",
      severity: "warning",
      message: "Payment failures increased and should be reviewed.",
      stripeAccountId: "acct_sample_bluepeak",
      accountName: "BluePeak Subscriptions",
      createdAt: minutesAgo(126),
      windowEnd: minutesFromNow(54),
      context: JSON.stringify({
        failedPayments: 9,
        baseline: 4,
      }),
    },
    {
      id: "sample-alert-4",
      type: "revenue_drop",
      severity: "warning",
      message: "Revenue dipped below normal weekday levels during the current monitoring window.",
      stripeAccountId: "acct_sample_meridian",
      accountName: "Meridian Market",
      createdAt: minutesAgo(164),
      windowEnd: minutesFromNow(16),
      context: JSON.stringify({
        expectedRevenue: 3100,
        currentRevenue: 2418,
      }),
    },
    {
      id: "sample-history-1",
      type: "payment_failed",
      severity: "warning",
      message: "A temporary payment failure increase returned to normal.",
      stripeAccountId: "acct_sample_luma",
      accountName: "Luma Health Co",
      createdAt: minutesAgo(1500),
      windowEnd: minutesAgo(1320),
      context: JSON.stringify({
        failedPayments: 7,
        baseline: 3,
      }),
    },
    {
      id: "sample-history-2",
      type: "revenue_drop",
      severity: "warning",
      message: "A short revenue dip recovered within the same business day.",
      stripeAccountId: "acct_sample_forge",
      accountName: "Forge Analytics",
      createdAt: minutesAgo(2960),
      windowEnd: minutesAgo(2780),
      context: JSON.stringify({
        expectedRevenue: 2600,
        currentRevenue: 1980,
      }),
    },
  ];

  const lastEventByAccount = new Map<string, Date | null>([
    ["acct_sample_atlas", minutesAgo(4)],
    ["acct_sample_northstar", minutesAgo(11)],
    ["acct_sample_bluepeak", minutesAgo(18)],
    ["acct_sample_meridian", minutesAgo(27)],
    ["acct_sample_luma", minutesAgo(33)],
    ["acct_sample_forge", minutesAgo(41)],
    ["acct_sample_cedar", minutesAgo(48)],
    ["acct_sample_pixel", minutesAgo(56)],
    ["acct_sample_brightgrowth", minutesAgo(63)],
    ["acct_sample_nova", minutesAgo(78)],
  ]);

  return {
    accounts,
    alerts,
    lastEventByAccount,
  };
}

function alertLabel(type: string) {
  if (type === "revenue_drop") return "Revenue Drop Detected";
  if (type === "payment_failed") return "Payment Failure Spike";
  return type.replace(/_/g, " ");
}

function severityMeta(severity: string) {
  if (severity === "critical") {
    return {
      label: "High Severity",
      shortLabel: "Attention Needed",
      statusColor: "#9e3d00",
      pillText: "#ba1a1a",
      pillBg: "#ffdad6",
      iconBg: "#ffdad6",
      iconColor: "#ba1a1a",
      dotColor: "#9e3d00",
    };
  }

  return {
    label: "Review Needed",
    shortLabel: "Review Needed",
    statusColor: "#9e3d00",
    pillText: "#9e3d00",
    pillBg: "#ffdbcc",
    iconBg: "#ffdbcc",
    iconColor: "#9e3d00",
    dotColor: "#c64f00",
  };
}

function safeParseContext(input?: string | null) {
  if (!input) return null;

  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function buildReadableAlertMessage(alert: Pick<AlertRecord, "type" | "message" | "context">) {
  const parsed = safeParseContext(alert.context);

  if (!parsed) return alert.message;

  if (
    alert.type === "payment_failed" &&
    typeof parsed.failedPayments === "number" &&
    typeof parsed.baseline === "number"
  ) {
    const ratio =
      parsed.baseline > 0
        ? (parsed.failedPayments / parsed.baseline).toFixed(1)
        : null;

    if (ratio) {
      return `Payment failures are ${ratio}x higher than normal (${parsed.failedPayments} vs ${parsed.baseline}) in the recent window.`;
    }

    return `Payment failures increased to ${parsed.failedPayments} in the recent monitoring window.`;
  }

  if (
    alert.type === "revenue_drop" &&
    typeof parsed.currentRevenue === "number" &&
    typeof parsed.expectedRevenue === "number" &&
    parsed.expectedRevenue > 0
  ) {
    const dropPercent = Math.round(
      ((parsed.expectedRevenue - parsed.currentRevenue) / parsed.expectedRevenue) * 100
    );

    return `A significant ${dropPercent}% drop in processed transactions compared to the previous 7-day average.`;
  }

  return alert.message;
}

function formatRelativeTime(date: Date | null | undefined) {
  if (!date) return "No events yet";

  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes} min${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) {
    return "Yesterday";
  }

  return `${diffDays} days ago`;
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

function getAlertAccountName(
  alert: {
    stripeAccountId?: string | null;
    accountName?: string | null;
  },
  accountNameById: Map<string, string>
) {
  if (alert.accountName && alert.accountName.trim() !== "") {
    return alert.accountName;
  }

  if (alert.stripeAccountId) {
    return accountNameById.get(alert.stripeAccountId) ?? "Unnamed account";
  }

  return "Unnamed account";
}

function buildStatusCopy(activeAlertsCount: number, accountCount: number) {
  if (activeAlertsCount > 0) {
    return {
      title: "Monitoring Requires Attention",
      summary: `${accountCount} connected Stripe account${
        accountCount === 1 ? "" : "s"
      }. ${activeAlertsCount} active alert${
        activeAlertsCount === 1 ? "" : "s"
      } currently require review across revenue and payment-failure monitoring.`,
    };
  }

  return {
    title: "All Systems Normal",
    summary: `${accountCount} connected Stripe account${
      accountCount === 1 ? "" : "s"
    }. No revenue drops or payment failure spikes detected in the last 24 hours.`,
  };
}

function buildFallbackAlertBody(alert: AlertRecord) {
  if (alert.type === "revenue_drop") {
    return "Revenue has dropped below the normal range for this Stripe account. Review recent payment activity and integration changes.";
  }

  if (alert.type === "payment_failed") {
    return "Payment failures are above the normal range for this Stripe account. This may indicate a checkout or API issue.";
  }

  return alert.message;
}

function buildIssueCta(alert: AlertRecord) {
  if (alert.type === "revenue_drop") return "Review Account";
  if (alert.type === "payment_failed") return "View Logs";
  return "Open Details";
}

function resolvedHistoryLabel(type: string) {
  if (type === "revenue_drop") return "Revenue drop resolved";
  if (type === "payment_failed") return "Payment failures returned to normal";
  return "Alert resolved";
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.statusShield}>
      <path
        fill="currentColor"
        d="M12 2 5 5v6c0 5 3.4 9.74 7 11 3.6-1.26 7-6 7-11V5l-7-3Zm3.2 8.33-3.63 3.84a1 1 0 0 1-1.46 0L8.8 12.79l1.4-1.42 1.18 1.16 2.91-3.08Z"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.issueIconSvg}>
      <path
        fill="currentColor"
        d="M1 21h22L12 2 1 21Zm12-3h-2v-2h2v2Zm0-4h-2v-4h2v4Z"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.issueIconSvg}>
      <path
        fill="currentColor"
        d="M11 7h2V5h-2v2Zm0 12h2V9h-2v10Zm1-17a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2Z"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.clockIcon}>
      <path
        fill="currentColor"
        d="M12 1.75A10.25 10.25 0 1 0 22.25 12 10.26 10.26 0 0 0 12 1.75Zm.75 10.56 3.15 1.82-.75 1.3-3.9-2.25V6h1.5Z"
      />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.historyIcon}>
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0-9.95 9H0l3.07 3.08L6.15 11H4.07A8 8 0 1 1 12 20a7.86 7.86 0 0 1-5.66-2.34l-1.42 1.42A9.86 9.86 0 0 0 12 22a10 10 0 0 0 0-20Zm-1 5v6l5.25 3.15.75-1.23-4.5-2.67V7Z"
      />
    </svg>
  );
}

function IssueCard({
  account,
  alert,
}: {
  account: AccountRecord & { lastActivity: Date | null };
  alert: AlertRecord;
}) {
  const severity = severityMeta(alert.severity);
  const body = buildReadableAlertMessage(alert) || buildFallbackAlertBody(alert);

  return (
    <article className={styles.issueCard}>
      <div className={styles.issueIconWrap} style={{ background: severity.iconBg, color: severity.iconColor }}>
        {alert.severity === "critical" ? <WarningIcon /> : <InfoIcon />}
      </div>

      <div className={styles.issueBody}>
        <div className={styles.issueHeader}>
          <div>
            <h3 className={styles.issueTitle}>{account.name ?? "Unnamed account"}</h3>
            <p className={styles.issueType} style={{ color: severity.statusColor }}>
              {alertLabel(alert.type)}
            </p>
          </div>

          <span className={styles.issuePill} style={{ color: severity.pillText, background: severity.pillBg }}>
            {severity.label}
          </span>
        </div>

        <p className={styles.issueText}>{body}</p>

        <div className={styles.issueFooter}>
          <span className={styles.issueMeta}>
            <ClockIcon />
            Active since {new Date(alert.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </span>

          <Link
            href={`/dashboard/accounts/${encodeURIComponent(account.stripeAccountId)}`}
            className={styles.issueAction}
          >
            {buildIssueCta(alert)}
          </Link>
        </div>
      </div>
    </article>
  );
}

function ActiveAlertRow({
  alert,
  accountName,
}: {
  alert: AlertRecord;
  accountName: string;
}) {
  const severity = severityMeta(alert.severity);

  return (
    <div className={styles.activeAlertRow}>
      <div className={styles.activeAlertCopy}>
        <span className={styles.activeAlertTitle}>
          {alertLabel(alert.type)}
          <span className={styles.activeAlertAccount}>for {accountName}</span>
        </span>
        <span className={styles.activeAlertText}>{buildReadableAlertMessage(alert)}</span>
      </div>

      <div className={styles.activeAlertMeta}>
        <span className={styles.activeAlertSeverity} style={{ color: severity.pillText }}>
          {severity.label}
        </span>
        <span>
          {new Date(alert.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} - Ongoing
        </span>
      </div>
    </div>
  );
}

function ConnectedAccountRow({
  account,
  alert,
  isMuted,
}: {
  account: AccountRecord & { lastActivity: Date | null };
  alert: AlertRecord | null;
  isMuted: boolean;
}) {
  return (
    <Link
      href={`/dashboard/accounts/${encodeURIComponent(account.stripeAccountId)}`}
      className={`${styles.connectedRow} ${isMuted ? styles.connectedRowAlt : ""}`}
    >
      <div className={styles.connectedCopy}>
        <span className={styles.connectedName}>{account.name ?? "Unnamed account"}</span>
        <span className={styles.connectedMeta}>Last event: {formatRelativeTime(account.lastActivity)}</span>
      </div>

      <div className={styles.connectedState}>
        <span
          className={styles.connectedDot}
          style={{ background: alert ? severityMeta(alert.severity).dotColor : "#0058bc" }}
        />
        <span style={{ color: alert ? severityMeta(alert.severity).statusColor : "#414755" }}>
          {alert ? severityMeta(alert.severity).shortLabel : "Monitoring"}
        </span>
      </div>
    </Link>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return <div className={styles.emptyCard}>{children}</div>;
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [alerts, stripeAccounts, lastEvents] = await Promise.all([
    prisma.alert.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.stripeAccount.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.stripeEvent.groupBy({
      by: ["stripeAccountId"],
      _max: { createdAt: true },
    }),
  ]);

  const realLastEventByAccount = new Map(
    lastEvents.map((event) => [event.stripeAccountId, event._max.createdAt ?? null])
  );

  const temporarySampleData = buildTemporaryDashboardSampleData();
  const displayStripeAccounts = USE_TEMP_DASHBOARD_SAMPLE_DATA
    ? temporarySampleData.accounts
    : stripeAccounts;
  const displayAlerts = USE_TEMP_DASHBOARD_SAMPLE_DATA
    ? temporarySampleData.alerts
    : alerts;
  const lastEventByAccount = USE_TEMP_DASHBOARD_SAMPLE_DATA
    ? temporarySampleData.lastEventByAccount
    : realLastEventByAccount;

  const accountNameById = new Map(
    displayStripeAccounts.map((account) => [
      account.stripeAccountId,
      account.name ?? "Unnamed Stripe account",
    ])
  );

  const now = new Date();
  const activeAlerts = displayAlerts.filter((alert) => alert.windowEnd > now);
  const historicalAlerts = displayAlerts.filter((alert) => alert.windowEnd <= now);
  const activeAccounts = displayStripeAccounts.filter((account) => account.status === "active");

  const alertsByAccount = new Map<string, AlertRecord[]>();
  for (const account of displayStripeAccounts) {
    alertsByAccount.set(
      account.stripeAccountId,
      activeAlerts.filter((alert) => alert.stripeAccountId === account.stripeAccountId)
    );
  }

  const monitoredAccounts = displayStripeAccounts
    .map((account) => {
      const accountAlerts = alertsByAccount.get(account.stripeAccountId) ?? [];
      const topAlert = accountAlerts[0] ?? null;

      return {
        ...account,
        lastActivity: lastEventByAccount.get(account.stripeAccountId) ?? null,
        topAlert,
        hasCritical: accountAlerts.some((alert) => alert.severity === "critical"),
      };
    })
    .sort((left, right) => {
      if (left.hasCritical && !right.hasCritical) return -1;
      if (!left.hasCritical && right.hasCritical) return 1;
      if (left.topAlert && !right.topAlert) return -1;
      if (!left.topAlert && right.topAlert) return 1;
      return 0;
    });

  const issueAccounts = monitoredAccounts.filter((account) => account.topAlert);
  const accountsNeedingAttention = issueAccounts.slice(0, 2);
  const connectedAccounts = monitoredAccounts.slice(0, 6);
  const connectedAccountsMore = monitoredAccounts.slice(6);
  const activeIncidentRows = activeAlerts;
  const recentHistory = historicalAlerts.slice(0, 2);
  const statusCopy = buildStatusCopy(activeAlerts.length, activeAccounts.length);

  return (
    <>
    <main className={styles.page}>
      <div className={styles.main} id="overview-top">
        <section aria-label="Global Status" className={styles.globalStatus}>
          <div className={styles.globalStatusInner}>
            <div className={styles.globalStatusLead}>
              <div className={styles.statusIconStack}>
                <span className={styles.statusPulse} />
                <div className={styles.statusBadge}>
                  <ShieldIcon />
                </div>
              </div>

              <div>
                <div className={styles.statusHeadingRow}>
                  <h1 className={styles.statusTitle}>{statusCopy.title}</h1>
                  <span className={styles.livePill}>LIVE</span>
                </div>

                <p className={styles.statusSummary}>
                  <strong>Stripe Account Monitoring:</strong> {statusCopy.summary}
                </p>
              </div>
            </div>

            <div className={styles.quickStats}>
              <div className={styles.quickStat}>
                <span>CONNECTED</span>
                <strong>{activeAccounts.length}</strong>
              </div>
              <div className={styles.quickDivider} />
              <div className={styles.quickStat}>
                <span>ACTIVE ALERTS</span>
                <strong>{activeAlerts.length}</strong>
              </div>
            </div>
          </div>
        </section>

        <div className={styles.layoutGrid}>
          <div className={styles.leftRail}>
            <section aria-label="Accounts Needing Attention">
              <header className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Accounts Needing Attention</h2>
                {issueAccounts.length > accountsNeedingAttention.length ? (
                  <p className={styles.sectionNote}>
                    Showing the most urgent accounts. {issueAccounts.length - accountsNeedingAttention.length} more active alert{issueAccounts.length - accountsNeedingAttention.length === 1 ? "" : "s"} appear below.
                  </p>
                ) : null}
              </header>

              <div className={styles.stack}>
                {accountsNeedingAttention.length === 0 ? (
                  <EmptyCard>No accounts currently require review.</EmptyCard>
                ) : (
                  accountsNeedingAttention.map((account) => (
                    <IssueCard
                      key={account.id}
                      account={account}
                      alert={account.topAlert as AlertRecord}
                    />
                  ))
                )}
              </div>
            </section>

            <section aria-label="Active Alerts">
              <header className={styles.sectionHeader}>
                <h2 className={styles.alertLogTitle}>Active alert log</h2>
                <p className={styles.sectionNote}>
                  Event-level view of every issue currently open across monitored Stripe accounts.
                </p>
              </header>

              <div className={styles.stack}>
                {activeIncidentRows.length === 0 ? (
                  <EmptyCard>No active alerts right now.</EmptyCard>
                ) : (
                  activeIncidentRows.map((alert) => (
                    <ActiveAlertRow
                      key={alert.id}
                      alert={alert}
                      accountName={getAlertAccountName(alert, accountNameById)}
                    />
                  ))
                )}
              </div>
            </section>
          </div>

          <div className={styles.rightRail}>
            <section aria-label="Connected Accounts" id="connected-accounts">
              <header className={styles.sectionHeaderInline}>
                <h2 className={styles.sectionTitle}>Connected Accounts</h2>
                <div className={styles.connectedActions}>
                  <Link href="/api/stripe/connect" className={styles.addAccountLink}>
                    Add Account
                  </Link>
                </div>
              </header>

              <div className={styles.connectedPanel}>
                {connectedAccounts.length === 0 ? (
                  <EmptyCard>Connect a Stripe account to start monitoring.</EmptyCard>
                ) : (
                  <>
                    {connectedAccounts.map((account, index) => (
                      <ConnectedAccountRow
                        key={account.id}
                        account={account}
                        alert={account.topAlert}
                        isMuted={index % 2 === 1}
                      />
                    ))}
                    {connectedAccountsMore.length > 0 ? (
                      <>
                        <input
                          id="connected-accounts-toggle"
                          className={styles.connectedToggleInput}
                          type="checkbox"
                        />
                        <div className={styles.connectedMoreList}>
                          {connectedAccountsMore.map((account, index) => (
                            <ConnectedAccountRow
                              key={account.id}
                              account={account}
                              alert={account.topAlert}
                              isMuted={(index + connectedAccounts.length) % 2 === 1}
                            />
                          ))}
                        </div>
                        <label
                          htmlFor="connected-accounts-toggle"
                          className={styles.connectedToggle}
                        >
                          <span className={styles.showAccountsLabel}>
                            Show all {monitoredAccounts.length} accounts
                          </span>
                          <span className={styles.hideAccountsLabel}>
                            Show fewer accounts
                          </span>
                        </label>
                      </>
                    ) : null}
                  </>
                )}
              </div>
            </section>

            <section aria-label="Recent History">
              <header className={styles.historyHeader}>
                <h2 className={styles.historyTitle}>Recent History</h2>
              </header>

              <div className={styles.historyStack}>
                {recentHistory.length === 0 ? (
                  <EmptyCard>No recent history yet.</EmptyCard>
                ) : (
                  recentHistory.map((alert) => (
                    <div key={alert.id} className={styles.historyItem}>
                      <div className={styles.historyIconWrap}>
                        <HistoryIcon />
                      </div>
                      <div className={styles.historyCopy}>
                        <p className={styles.historyText}>
                          <strong>{resolvedHistoryLabel(alert.type)}</strong> for{" "}
                          {getAlertAccountName(alert, accountNameById)}.
                        </p>
                        <span className={styles.historyMeta}>
                          {formatHistoryTime(alert.windowEnd)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
    <MarketingFooter />
    </>
  );
}
