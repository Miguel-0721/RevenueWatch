import { auth } from "@/auth";
import CurrentAlertsRail from "@/components/dashboard/CurrentAlertsRail";
import { getPlanLabel, getPlanLimit } from "@/lib/billing";
import { getActiveDemoAlerts, getDemoAccountById, getDemoAlertHistory, getDemoDashboardStats, hasDemoAccount } from "@/lib/demoData";
import { prisma } from "@/lib/prisma";
import { syncUserPlanFromStripe } from "@/lib/subscription-sync";
import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

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

type DisplayAccount = {
  id: string;
  name: string | null;
  stripeAccountId: string;
  status: string;
  createdAt: Date;
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
      pillText: "#ba1a1a",
      pillBg: "#ffdad6",
      statusColor: "#ba1a1a",
    };
  }

  return {
    label: "Review Needed",
    pillText: "#8a5a00",
    pillBg: "#fff1c2",
    statusColor: "#8a5a00",
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

  if (parsed && typeof parsed.displayMessage === "string") {
    return parsed.displayMessage;
  }

  if (alert.type === "revenue_drop") {
    if (
      parsed &&
      typeof parsed.currentRevenue === "number" &&
      typeof parsed.expectedRevenue === "number" &&
      parsed.expectedRevenue > 0
    ) {
      const dropPercent = Math.round(
        ((parsed.expectedRevenue - parsed.currentRevenue) / parsed.expectedRevenue) * 100
      );
      return `Sales are ${dropPercent}% lower than normal compared to your usual performance over the past week.`;
    }

    return "Sales are much lower than usual for this window.";
  }

  if (
    alert.type === "payment_failed" &&
    parsed &&
    typeof parsed.failuresCounted === "number" &&
    typeof parsed.normalFailures === "number"
  ) {
    return `Payment failures are significantly higher than usual (${parsed.failuresCounted} vs ${parsed.normalFailures}).`;
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
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

function formatHistoryTime(date: Date) {
  const target = new Date(date);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfTarget.getTime()) / 86400000);

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
    return `${accountCount} connected Stripe account${
      accountCount === 1 ? "" : "s"
    }. ${activeAlertsCount} active alert${
      activeAlertsCount === 1 ? "" : "s"
    } currently require review across revenue and payment-failure monitoring.`;
  }

  return `Monitoring ${accountCount} Stripe account${
    accountCount === 1 ? "" : "s"
  }. No issues detected in the last 24 hours.`;
}

function demoSeverityToDisplaySeverity(severity: string): "critical" | "warning" {
  return severity === "high" ? "critical" : "warning";
}

function buildApproxDateFromRelativeLabel(label?: string, now: Date = new Date()) {
  if (!label) return undefined;

  const match = label.match(/(\d+)\s+(minute|hour|day)s?\s+ago/i);
  if (!match) return undefined;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const date = new Date(now);

  if (unit === "minute") {
    date.setMinutes(date.getMinutes() - amount);
  } else if (unit === "hour") {
    date.setHours(date.getHours() - amount);
  } else if (unit === "day") {
    date.setDate(date.getDate() - amount);
  }

  return date;
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

type DashboardPageProps = {
  searchParams?: Promise<{
    billing?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  if (params?.billing === "success") {
    await syncUserPlanFromStripe(session.user.id);
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
      demoActiveAlerts.map((account) => {
        const createdAt = buildApproxDateFromRelativeLabel(account.detectedAt);

        return [
          account.id,
          {
            id: `demo-alert-${account.id}`,
            type: account.alertType,
            severity: demoSeverityToDisplaySeverity(account.severity),
            message: account.message,
            stripeAccountId: account.id,
            accountName: account.name,
            createdAt,
            detectedLabel: account.detectedAt,
            cta: account.cta,
            context: JSON.stringify(
              account.alertType === "revenue_drop"
                ? {
                    baselineAmount: account.usualRevenue,
                    expectedRevenue: account.usualRevenue,
                    currentAmount: account.currentRevenue,
                    currentRevenue: account.currentRevenue,
                    alertThresholdAmount: account.alertThreshold,
                    threshold:
                      typeof account.alertThreshold === "number" &&
                      typeof account.usualRevenue === "number"
                        ? 1 - account.alertThreshold / account.usualRevenue
                        : 0.5,
                    dropRatio:
                      typeof account.currentRevenue === "number" &&
                      typeof account.usualRevenue === "number" &&
                      account.usualRevenue > 0
                        ? (account.usualRevenue - account.currentRevenue) / account.usualRevenue
                        : undefined,
                    baselineLabel: "recent performance",
                    window: "current monitoring window",
                    revenueSeries: account.revenueSeries,
                    displayMessage: account.message,
                  }
                : {
                    currentFailures: account.currentFailures,
                    failedPayments: account.currentFailures,
                    failuresCounted: account.currentFailures,
                    normalFailures: account.normalFailures,
                    baseline: account.normalFailures,
                    effectiveUsualFailures: account.normalFailures,
                    failureThreshold:
                      typeof account.normalFailures === "number" ? account.normalFailures * 2 : 5,
                    window: "current monitoring window",
                    failureSeries: account.failureSeries,
                    spikeMultiple:
                      typeof account.currentFailures === "number" &&
                      typeof account.normalFailures === "number" &&
                      account.normalFailures > 0
                        ? account.currentFailures / account.normalFailures
                        : undefined,
                    displayMessage: account.message,
                  }
            ),
          } satisfies DisplayAlert,
        ];
      })
    );

    monitoredAccounts = stripeAccounts
      .flatMap((account) => {
        const demoAccount = getDemoAccountById(account.stripeAccountId);
        if (!demoAccount) return [];

        return [
          {
            id: account.id,
            name: account.name,
            stripeAccountId: account.stripeAccountId,
            status: account.status,
            createdAt: account.createdAt,
            displayName: account.name?.trim() || demoAccount.name,
            lastActivityLabel: `Last event: ${demoAccount.lastEvent}`,
            topAlert: account.status === "paused" ? null : alertByAccountId.get(demoAccount.id) ?? null,
          } satisfies DisplayAccount,
        ];
      })
      .sort((left, right) => {
        if (left.topAlert && right.topAlert) {
          const severityDifference = severityRank(left.topAlert.severity) - severityRank(right.topAlert.severity);
          if (severityDifference !== 0) return severityDifference;

          const rightCreatedAt = right.topAlert.createdAt?.getTime() ?? 0;
          const leftCreatedAt = left.topAlert.createdAt?.getTime() ?? 0;
          if (rightCreatedAt !== leftCreatedAt) return rightCreatedAt - leftCreatedAt;

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
      .slice(0, 4)
      .map((entry, index) => ({
        id: `demo-history-${index}`,
        message: entry.message,
        timestampLabel: entry.timestamp,
      }));
  } else {
    const now = new Date();
    const activeAlertRecords = alerts
      .filter((alert) => alert.windowEnd > now)
      .sort((left, right) => {
        const severityDifference = severityRank(left.severity) - severityRank(right.severity);
        if (severityDifference !== 0) return severityDifference;
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });
    const historicalAlerts = alerts.filter((alert) => alert.windowEnd <= now);
    const alertsByAccount = new Map<string, typeof activeAlertRecords>();

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
          id: account.id,
          name: account.name,
          stripeAccountId: account.stripeAccountId,
          status: account.status,
          createdAt: account.createdAt,
          displayName: account.name ?? "Stripe account",
          lastActivityLabel: `Last event: ${formatRelativeTime(
            realLastEventByAccount.get(account.stripeAccountId) ?? null
          )}`,
          topAlert,
        } satisfies DisplayAccount;
      })
      .sort((left, right) => {
        if (left.topAlert && right.topAlert) {
          const severityDifference = severityRank(left.topAlert.severity) - severityRank(right.topAlert.severity);
          if (severityDifference !== 0) return severityDifference;
          return (right.topAlert.createdAt?.getTime() ?? 0) - (left.topAlert.createdAt?.getTime() ?? 0);
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
    recentHistory = historicalAlerts.slice(0, 4).map((alert) => ({
      id: alert.id,
      message: `${alertLabel(alert.type)} for ${
        alert.stripeAccountId
          ? monitoredAccounts.find((account) => account.stripeAccountId === alert.stripeAccountId)?.displayName ??
            "Stripe account"
          : "Stripe account"
      }`,
      timestampLabel: formatHistoryTime(alert.windowEnd),
    }));
  }

  const currentPlanLabel = getPlanLabel(user.plan);
  const currentPlanLimit = getPlanLimit(user.plan);
  const accountUsageLabel = `${monitoredAccounts.length} / ${currentPlanLimit} accounts used`;
  const alertsPendingLabel = `${activeAlerts.length} pending`;
  const statusCopy = buildStatusCopy(activeAlerts.length, activeAccountsCount);

  return (
    <section className={styles.mainSurface}>
      <header className={styles.workspaceTopbar}>
        <div className={styles.workspaceTopbarLeft}>
          <button type="button" className={styles.topbarIconButton} aria-label="Previous">
            {"<"}
          </button>
          <button type="button" className={styles.topbarIconButton} aria-label="Next">
            {">"}
          </button>
          <div className={styles.topbarDivider} />
          <span className={styles.workspaceTopbarTitle}>Monitoring dashboard</span>
        </div>

        <div className={styles.workspaceTopbarActions}>
          <span className={styles.topbarMetaChip}>Last 24 hours</span>
          <span className={styles.topbarMetaChip}>Plan: {currentPlanLabel}</span>
          <span className={styles.topbarMetaChip}>{accountUsageLabel}</span>
          <Link href="/dashboard/billing" className={styles.topbarPrimaryAction}>
            Manage billing
          </Link>
        </div>
      </header>

      <div className={styles.workspaceContent}>
        <div className={styles.workspaceBreadcrumb}>
          MONITORING <span>{">"}</span> CONNECTED ACCOUNTS <span>{">"}</span> ACTIVE OVERVIEW
        </div>
        <h1 className={styles.workspaceTitle}>Stripe monitoring overview</h1>
        <p className={styles.workspaceIntro}>{statusCopy}</p>

        <CurrentAlertsRail
          pendingLabel={alertsPendingLabel}
          alerts={activeAlerts.map((alert) => {
            const severity = severityMeta(alert.severity);
            const accountName =
              monitoredAccounts.find((account) => account.stripeAccountId === alert.stripeAccountId)
                ?.displayName ?? "Stripe account";

            return {
              id: alert.id,
              accountName,
              type: alert.type,
              typeLabel: alertLabel(alert.type),
              message: buildReadableAlertMessage(alert),
              severityKind: alert.severity,
              severityLabel: severity.label,
              severityTextColor: severity.pillText,
              severityBgColor: severity.pillBg,
              typeColor: severity.statusColor,
              detectedLabel: alert.detectedLabel
                ? `Detected ${alert.detectedLabel}`
                : alert.createdAt
                  ? `Detected ${formatRelativeTime(alert.createdAt)}`
                  : "Active now",
              href: `/dashboard/accounts/${encodeURIComponent(alert.stripeAccountId ?? "")}`,
              context: alert.context ?? null,
              createdAt: alert.createdAt ? alert.createdAt.toISOString() : null,
            };
          })}
        />

        <section className={styles.historySection} aria-label="Alert history">
          <header className={styles.historySectionHeader}>
            <div className={styles.historySectionTitle}>
              <HistoryIcon />
              <div>
                <h2 className={styles.sideCardTitle}>Alert History</h2>
                <p className={styles.historySectionIntro}>
                  Recent monitoring activity across your connected Stripe accounts.
                </p>
              </div>
            </div>
            <div className={styles.sideCardHeaderMeta}>
              <span className={styles.sideCardCount}>{recentHistory.length} recent</span>
              <Link href="/dashboard/alerts" className={styles.sidePanelLink}>
                View all
              </Link>
            </div>
          </header>

          <div className={styles.monitorSideCard}>
            <div className={styles.historyTimeline}>
              {recentHistory.length === 0 ? (
                <div className={styles.emptyStateCard}>
                  <div className={styles.emptyStateIconWrap}>
                    <HistoryIcon />
                  </div>
                  <div className={styles.emptyStateCopy}>
                    <h3>No alert history yet</h3>
                    <p>Past alert activity will appear here.</p>
                  </div>
                </div>
              ) : (
                recentHistory.map((item) => (
                  <div key={item.id} className={styles.timelineItem}>
                    <div className={styles.timelineDot} />
                    <div className={styles.timelineCopy}>
                      <span className={styles.timelineMeta}>{item.timestampLabel}</span>
                      <p className={styles.timelineText}>{item.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section aria-label="Accounts navigation" className={styles.accountsSection}>
          <div className={styles.accountsOverviewCard}>
            <div className={styles.accountsOverviewCopy}>
              <div className={styles.accountsOverviewIconWrap}>
                <AccountsIcon />
              </div>
              <div>
                <h2 className={styles.sectionTitle}>View all connected accounts</h2>
                <p className={styles.accountsOverviewText}>
                  Review account status, active monitoring, and account-specific alert details.
                </p>
              </div>
            </div>

            <Link href="/dashboard/accounts" className={styles.accountsOverviewLink}>
              Open Accounts
            </Link>
          </div>
        </section>
      </div>
    </section>
  );
}
