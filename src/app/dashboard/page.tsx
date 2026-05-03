import { auth } from "@/auth";
import Navbar from "@/components/Navbar";
import AccountNameEditor from "@/components/AccountNameEditor";
import ExpandableIssueList from "@/components/ExpandableIssueList";
import { getPlanLabel, getPlanLimit } from "@/lib/billing";
import {
  getActiveDemoAlerts,
  getDemoAccountById,
  getDemoAlertHistory,
  getDemoDashboardStats,
  hasDemoAccount,
} from "@/lib/demoData";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type PrismaAlertRecord = {
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

type PrismaAccountRecord = {
  id: string;
  name: string | null;
  stripeAccountId: string;
  status: string;
  createdAt: Date;
};

type DisplayAlert = {
  id: string;
  type: string;
  severity: "critical" | "warning";
  message: string;
  stripeAccountId: string | null;
  accountName?: string | null;
  createdAt?: Date;
  detectedLabel?: string;
  cta?: string;
  context?: string | null;
};

type DisplayAccount = PrismaAccountRecord & {
  displayName: string;
  lastActivityLabel: string;
  topAlert: DisplayAlert | null;
};

type DisplayHistoryItem = {
  id: string;
  message: string;
  timestampLabel: string;
};

function alertLabel(type: string) {
  if (type === "revenue_drop") return "Revenue Drop Detected";
  if (type === "payment_failed") return "Payment Failure Spike";
  return type.replace(/_/g, " ");
}

function severityRank(severity: "critical" | "warning" | string) {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function severityMeta(severity: "critical" | "warning" | string) {
  if (severity === "critical") {
    return {
      label: "High Severity",
      shortLabel: "Attention Needed",
      statusColor: "#ba1a1a",
      pillText: "#ba1a1a",
      pillBg: "#ffdad6",
      iconBg: "#ffdad6",
      iconColor: "#ba1a1a",
      dotColor: "#ba1a1a",
    };
  }

  return {
    label: "Review Needed",
    shortLabel: "Review Needed",
    statusColor: "#8a5a00",
    pillText: "#8a5a00",
    pillBg: "#fff1c2",
    iconBg: "#fff5d6",
    iconColor: "#8a5a00",
    dotColor: "#b7791f",
  };
}

function safeParseContext(input?: string | null) {
  if (!input) return null;

  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildReadableAlertMessage(alert: Pick<DisplayAlert, "type" | "message" | "context">) {
  const parsed = safeParseContext(alert.context);

  if (!parsed) return alert.message;

  if (typeof parsed.displayMessage === "string") {
    return parsed.displayMessage;
  }

  if (
    alert.type === "payment_failed" &&
    typeof parsed.failedPayments === "number" &&
    typeof parsed.baseline === "number"
  ) {
    return `Payment failures are much higher than usual (${parsed.failedPayments} vs ${parsed.baseline}).`;
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

    return `Sales are ${dropPercent}% lower than normal compared to your usual performance over the past week.`;
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
    summary: `Monitoring ${accountCount} Stripe account${
      accountCount === 1 ? "" : "s"
    }. No issues detected in the last 24 hours.`,
  };
}

function buildIssueCta(alert: DisplayAlert) {
  return alert.cta ?? "Review Account";
}

function demoSeverityToDisplaySeverity(severity: string): "critical" | "warning" {
  return severity === "high" ? "critical" : "warning";
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

function AccountsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.sectionIcon}>
      <path
        fill="currentColor"
        d="M12 2 5 5v6c0 5 3.4 9.74 7 11 3.6-1.26 7-6 7-11V5l-7-3Zm0 9.25a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5Zm3.5 4.25h-7v-.4c0-1.63 2.34-2.6 3.5-2.6s3.5.97 3.5 2.6v.4Z"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.sectionIcon}>
      <path
        fill="currentColor"
        d="M12 22a2.49 2.49 0 0 0 2.45-2h-4.9A2.49 2.49 0 0 0 12 22Zm7-6V11a7 7 0 1 0-14 0v5l-2 2v1h18v-1l-2-2Z"
      />
    </svg>
  );
}

function IssueCard({
  account,
  alert,
  featured = false,
}: {
  account: DisplayAccount;
  alert: DisplayAlert;
  featured?: boolean;
}) {
  const severity = severityMeta(alert.severity);
  const body = buildReadableAlertMessage(alert);
  const severityClass =
    alert.severity === "critical" ? styles.issueCardCritical : styles.issueCardWarning;

  return (
    <article
      className={`${styles.issueCard} ${severityClass}${featured ? ` ${styles.issueCardFeatured}` : ""}`}
    >
      <div
        className={styles.issueIconWrap}
        style={{ background: severity.iconBg, color: severity.iconColor }}
      >
        <WarningIcon />
      </div>

      <div className={styles.issueBody}>
        <div className={styles.issueHeader}>
          <h3 className={styles.issueTitle}>{account.displayName}</h3>
          <div className={styles.issueMetaRow}>
            <p className={styles.issueType} style={{ color: severity.statusColor }}>
              {alertLabel(alert.type)}
            </p>
            <span className={styles.issueMetaDivider}>·</span>
            <span
              className={styles.issuePill}
              style={{ color: severity.pillText, background: severity.pillBg }}
            >
              {severity.label}
            </span>
          </div>
        </div>

        <p className={styles.issueText}>{body}</p>

        <div className={styles.issueFooter}>
          <span className={styles.issueMeta}>
            <ClockIcon />
            {alert.detectedLabel ? `Detected ${alert.detectedLabel}` : "Active now"}
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
  alert: DisplayAlert;
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
        <span>{alert.detectedLabel ? `Detected ${alert.detectedLabel}` : "Ongoing"}</span>
      </div>
    </div>
  );
}

function ConnectedAccountRow({
  account,
  isMuted,
}: {
  account: DisplayAccount;
  isMuted: boolean;
}) {
  const alert = account.topAlert;
  const isPaused = account.status === "paused";
  const stateLabel = isPaused
    ? "Paused"
    : alert
      ? severityMeta(alert.severity).shortLabel
      : "Monitoring active";
  const stateColor = isPaused
    ? "#717786"
    : alert
      ? severityMeta(alert.severity).statusColor
      : "#414755";
  const dotColor = isPaused
    ? "#8b91a1"
    : alert
      ? severityMeta(alert.severity).dotColor
      : "#0058bc";

  return (
    <div className={`${styles.connectedRow} ${isMuted ? styles.connectedRowAlt : ""}`}>
      <div className={styles.connectedCopy}>
        <AccountNameEditor
          accountId={account.id}
          stripeAccountId={account.stripeAccountId}
          currentName={account.displayName}
          currentStatus={account.status}
        />
        <span className={styles.connectedMeta}>{account.lastActivityLabel}</span>
      </div>

      <div className={styles.connectedStateWrap}>
        <div className={styles.connectedState}>
          <span className={styles.connectedDot} style={{ background: dotColor }} />
          <span style={{ color: stateColor }}>{stateLabel}</span>
        </div>
      </div>
    </div>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return <div className={styles.emptyCard}>{children}</div>;
}

function EmptyStateCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className={styles.emptyStateCard}>
      <div className={styles.emptyStateIconWrap}>{icon}</div>
      <div className={styles.emptyStateCopy}>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [user, alerts, stripeAccounts, lastEvents] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    }),
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

  if (!user) {
    redirect("/login");
  }

  const demoMode = hasDemoAccount(stripeAccounts.map((account) => account.stripeAccountId));
  const realLastEventByAccount = new Map(
    lastEvents.map((event) => [event.stripeAccountId, event._max.createdAt ?? null])
  );

  let activeAlerts: DisplayAlert[] = [];
  let monitoredAccounts: DisplayAccount[] = [];
  let activeAccountsCount = 0;
  let recentHistory: DisplayHistoryItem[] = [];

  if (demoMode) {
    const demoActiveAlerts = getActiveDemoAlerts();
    const demoStats = getDemoDashboardStats();
    const alertByAccountId = new Map(
      demoActiveAlerts.map((account) => [
        account.id,
        {
          id: `demo-alert-${account.id}`,
          type: account.alertType,
          severity: demoSeverityToDisplaySeverity(account.severity),
          message: account.message,
          stripeAccountId: account.id,
          accountName: account.name,
          detectedLabel: account.detectedAt,
          cta: account.cta,
        } satisfies DisplayAlert,
      ])
    );

    monitoredAccounts = stripeAccounts
      .flatMap((account) => {
        const demoAccount = getDemoAccountById(account.stripeAccountId);
        if (!demoAccount) return [];

        const mappedAccount: DisplayAccount = {
          id: account.id,
          name: account.name,
          stripeAccountId: account.stripeAccountId,
          status: account.status,
          createdAt: account.createdAt,
          displayName: account.name?.trim() || demoAccount.name,
          lastActivityLabel: `Last event: ${demoAccount.lastEvent}`,
          topAlert: account.status === "paused" ? null : alertByAccountId.get(demoAccount.id) ?? null,
        };

        return [mappedAccount];
      })
      .sort((left, right) => {
        if (left.topAlert && right.topAlert) {
          const severityDifference =
            severityRank(left.topAlert.severity) - severityRank(right.topAlert.severity);
          if (severityDifference !== 0) return severityDifference;
          return left.displayName.localeCompare(right.displayName);
        }

        if (left.topAlert && !right.topAlert) return -1;
        if (!left.topAlert && right.topAlert) return 1;
        return left.displayName.localeCompare(right.displayName);
      });

    activeAlerts = monitoredAccounts
      .filter((account) => account.topAlert)
      .map((account) => account.topAlert as DisplayAlert);
    activeAccountsCount = demoStats.connectedAccounts;
    recentHistory = getDemoAlertHistory()
      .slice(0, 2)
      .map((entry, index) => ({
        id: `demo-history-${index}`,
        message: entry.message,
        timestampLabel: entry.timestamp,
      }));
  } else {
    const now = new Date();
    const displayAlerts = alerts;
    const activeAlertRecords = displayAlerts
      .filter((alert) => alert.windowEnd > now)
      .sort((left, right) => {
        const severityDifference = severityRank(left.severity) - severityRank(right.severity);
        if (severityDifference !== 0) return severityDifference;
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });
    const historicalAlerts = displayAlerts.filter((alert) => alert.windowEnd <= now);
    const alertsByAccount = new Map<string, PrismaAlertRecord[]>();

    for (const account of stripeAccounts) {
      alertsByAccount.set(
        account.stripeAccountId,
        activeAlertRecords.filter((alert) => alert.stripeAccountId === account.stripeAccountId)
      );
    }

    monitoredAccounts = stripeAccounts
      .filter((account) => account.status !== "disconnected")
      .map((account) => {
        const accountAlerts = (alertsByAccount.get(account.stripeAccountId) ?? []).sort((left, right) => {
          const severityDifference = severityRank(left.severity) - severityRank(right.severity);
          if (severityDifference !== 0) return severityDifference;
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        });
        const topAlert = accountAlerts[0]
          ? ({
              ...accountAlerts[0],
              severity: accountAlerts[0].severity === "critical" ? "critical" : "warning",
              cta: "Review Account",
            } satisfies DisplayAlert)
          : null;

        return {
          ...account,
          displayName: account.name ?? "Stripe account",
          lastActivityLabel: `Last event: ${formatRelativeTime(
            realLastEventByAccount.get(account.stripeAccountId) ?? null
          )}`,
          topAlert,
        } satisfies DisplayAccount;
      })
      .sort((left, right) => {
        if (left.topAlert && right.topAlert) {
          const severityDifference =
            severityRank(left.topAlert.severity) - severityRank(right.topAlert.severity);
          if (severityDifference !== 0) return severityDifference;
          return (
            new Date((right.topAlert.createdAt as Date)).getTime() -
            new Date((left.topAlert.createdAt as Date)).getTime()
          );
        }

        if (left.topAlert && !right.topAlert) return -1;
        if (!left.topAlert && right.topAlert) return 1;
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });

    activeAlerts = activeAlertRecords.map(
      (alert) =>
        ({
          ...alert,
          severity: alert.severity === "critical" ? "critical" : "warning",
          cta: "Review Account",
        }) satisfies DisplayAlert
    );
    activeAccountsCount = stripeAccounts.filter((account) => account.status === "active").length;
    recentHistory = historicalAlerts.slice(0, 2).map((alert) => ({
      id: alert.id,
      message: `${alertLabel(alert.type)} for ${
        alert.stripeAccountId
          ? monitoredAccounts.find((account) => account.stripeAccountId === alert.stripeAccountId)
              ?.displayName ?? "Stripe account"
          : "Stripe account"
      }`,
      timestampLabel: formatHistoryTime(alert.windowEnd),
    }));
  }

  const issueAccounts = monitoredAccounts.filter((account) => account.topAlert);
  const visibleIssueAccounts = issueAccounts.slice(0, 3);
  const moreIssueAccounts = issueAccounts.slice(3);
  const connectedAccounts = monitoredAccounts.slice(0, 6);
  const connectedAccountsMore = monitoredAccounts.slice(6);
  const statusCopy = buildStatusCopy(activeAlerts.length, activeAccountsCount);
  const currentPlanLabel = getPlanLabel(user.plan);
  const currentPlanLimit = getPlanLimit(user.plan);
  const topStatusSeverity =
    activeAlerts.length === 0 ? null : activeAlerts[0].severity === "critical" ? "critical" : "warning";

  return (
    <>
      <Navbar mode="app" />
      <main className={styles.page}>
        <div className={styles.main} id="overview-top">
          <section aria-label="Global Status" className={styles.globalStatus}>
            <div className={styles.globalStatusInner}>
              <div className={styles.globalStatusLead}>
                <div className={styles.statusIconStack}>
                  <span
                    className={`${styles.statusPulse} ${
                      topStatusSeverity === "critical"
                        ? styles.statusPulseCritical
                        : topStatusSeverity === "warning"
                          ? styles.statusPulseWarning
                          : ""
                    }`}
                  />
                  <div
                    className={`${styles.statusBadge} ${
                      topStatusSeverity === "critical"
                        ? styles.statusBadgeCritical
                        : topStatusSeverity === "warning"
                          ? styles.statusBadgeWarning
                          : ""
                    }`}
                  >
                    {topStatusSeverity ? <WarningIcon /> : <ShieldIcon />}
                  </div>
                </div>

                <div>
                  <div className={styles.statusHeadingRow}>
                    <h1 className={styles.statusTitle}>{statusCopy.title}</h1>
                    <span className={styles.livePill}>LIVE</span>
                  </div>

                  <p className={styles.statusSummary}>{statusCopy.summary}</p>
                </div>
              </div>

              <div className={styles.quickStats}>
                <div className={styles.quickStat}>
                  <span>CONNECTED</span>
                  <strong>{activeAccountsCount}</strong>
                </div>
                <div className={styles.quickDivider} />
                <div className={styles.quickStat}>
                  <span>ACTIVE ALERTS</span>
                  <strong>{activeAlerts.length}</strong>
                </div>
                <div className={styles.quickDivider} />
                <div className={styles.quickStat}>
                  <span>CURRENT PLAN</span>
                  <strong>{currentPlanLabel}</strong>
                  <small>{currentPlanLimit} account limit</small>
                  <Link href="/api/billing/portal" className={styles.quickStatLink}>
                    Manage billing
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <div className={styles.layoutGrid}>
            <div className={styles.leftRail}>
              <section aria-label="Active Issues" className={styles.sectionPanel}>
                <header className={styles.sectionHeaderPanel}>
                  <div className={styles.sectionHeaderTitle}>
                    <AccountsIcon />
                    <h2 className={styles.sectionTitle}>Active Issues</h2>
                  </div>
                  {issueAccounts.length > visibleIssueAccounts.length ? (
                    <p className={styles.sectionNote}>
                      Showing the most urgent issues first. {issueAccounts.length - visibleIssueAccounts.length} more active alert
                      {issueAccounts.length - visibleIssueAccounts.length === 1 ? "" : "s"} can be expanded below.
                    </p>
                  ) : null}
                </header>

                <div className={styles.stack}>
                  {visibleIssueAccounts.length === 0 ? (
                    <EmptyStateCard
                      icon={<AccountsIcon />}
                      title="No accounts need attention"
                      body="Monitoring is active across all connected accounts."
                    />
                  ) : moreIssueAccounts.length > 0 ? (
                    <ExpandableIssueList
                      totalCount={issueAccounts.length}
                      toggleClassName={styles.sectionFooterButton}
                      moreListClassName={styles.issueMoreList}
                      moreListExpandedClassName={styles.issueMoreListExpanded}
                      hiddenChildren={moreIssueAccounts.map((account) => (
                        <IssueCard
                          key={account.id}
                          account={account}
                          alert={account.topAlert as DisplayAlert}
                        />
                      ))}
                    >
                      {visibleIssueAccounts.map((account, index) => (
                        <IssueCard
                          key={account.id}
                          account={account}
                          alert={account.topAlert as DisplayAlert}
                          featured={index === 0}
                        />
                      ))}
                    </ExpandableIssueList>
                  ) : (
                    visibleIssueAccounts.map((account, index) => (
                      <IssueCard
                        key={account.id}
                        account={account}
                        alert={account.topAlert as DisplayAlert}
                        featured={index === 0}
                      />
                    ))
                  )}
                </div>
              </section>

              <section aria-label="Active Alerts" className={styles.sectionPanel}>
                <header className={styles.sectionHeaderPanel}>
                  <div className={styles.sectionHeaderTitle}>
                    <BellIcon />
                    <h2 className={styles.alertLogTitle}>Active Alerts</h2>
                  </div>
                  <p className={styles.sectionNote}>Current alerts across your connected accounts.</p>
                </header>

                <div className={styles.stack}>
                  {activeAlerts.length === 0 ? (
                    <EmptyStateCard
                      icon={<BellIcon />}
                      title="No active alerts"
                      body="We'll notify you immediately if anything requires attention."
                    />
                  ) : (
                    activeAlerts.map((alert) => (
                      <ActiveAlertRow
                        key={alert.id}
                        alert={alert}
                        accountName={
                          monitoredAccounts.find((account) => account.stripeAccountId === alert.stripeAccountId)
                            ?.displayName ?? "Stripe account"
                        }
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
                            <span className={styles.hideAccountsLabel}>Show fewer accounts</span>
                          </label>
                        </>
                      ) : null}
                    </>
                  )}
                </div>
              </section>

              <section aria-label="Recent History" className={styles.sectionPanel}>
                <header className={styles.sectionHeaderPanel}>
                  <div className={styles.sectionHeaderTitle}>
                    <HistoryIcon />
                    <h2 className={styles.historyTitle}>Recent History</h2>
                  </div>
                  <Link href="/alerts" className={styles.historyLink}>
                    View full history
                  </Link>
                </header>

                <div className={styles.historyStack}>
                  {recentHistory.length === 0 ? (
                    <EmptyStateCard
                      icon={<HistoryIcon />}
                      title="No recent history yet"
                      body="Past alert activity will appear here."
                    />
                  ) : (
                    recentHistory.map((item) => (
                      <div key={item.id} className={styles.historyItem}>
                        <div className={styles.historyIconWrap}>
                          <HistoryIcon />
                        </div>
                        <div className={styles.historyCopy}>
                          <p className={styles.historyText}>{item.message}</p>
                          <span className={styles.historyMeta}>{item.timestampLabel}</span>
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
    </>
  );
}
