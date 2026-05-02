import { auth } from "@/auth";
import Navbar from "@/components/Navbar";
import {
  getActiveDemoAlerts,
  getDemoAccountById,
  getDemoAlertHistory,
  hasDemoAccount,
} from "@/lib/demoData";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "./page.module.css";

type AlertRecord = {
  id: string;
  type: string;
  severity: string;
  message: string;
  stripeAccountId: string | null;
  createdAt?: Date;
  windowEnd?: Date;
  context?: string | null;
  detectedLabel?: string;
  cta?: string;
};

type HistoryRecord = {
  id: string;
  message: string;
  timestamp: string;
  group: string;
};

function alertLabel(type: string) {
  if (type === "revenue_drop") return "Revenue Drop Detected";
  if (type === "payment_failed") return "Payment Failure Spike";
  return type.replace(/_/g, " ");
}

function severityRank(severity: string) {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function severityMeta(severity: string) {
  if (severity === "critical") {
    return {
      label: "High Severity",
      badgeClass: styles.severityCritical,
      cardClass: styles.cardCritical,
    };
  }

  return {
    label: "Review Needed",
    badgeClass: styles.severityWarning,
    cardClass: styles.cardWarning,
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

function buildReadableAlertMessage(alert: Pick<AlertRecord, "type" | "message" | "context">) {
  const parsed = safeParseContext(alert.context);

  if (!parsed) return alert.message;

  if (
    alert.type === "payment_failed" &&
    typeof parsed.failedPayments === "number" &&
    typeof parsed.baseline === "number"
  ) {
    return `Payment failures are significantly higher than usual compared to recent activity (${parsed.failedPayments} vs ${parsed.baseline}).`;
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

    return `Sales are ${dropPercent}% lower than usual compared to your recent performance over the past week.`;
  }

  return alert.message;
}

function formatActiveDuration(date: Date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"}`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"}`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
}

function buildAlertAction(alert: AlertRecord) {
  const href = alert.stripeAccountId
    ? `/dashboard/accounts/${encodeURIComponent(alert.stripeAccountId)}`
    : "/dashboard";

  return { label: alert.cta ?? "Review Issue", href };
}

function formatResolvedTime(date: Date) {
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

function groupHistoryLabel(date: Date) {
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

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "This week";
  return "Older";
}

export default async function AlertsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

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
      account.name?.trim() || getDemoAccountById(account.stripeAccountId)?.name || "Stripe account",
    ])
  );

  let activeAlerts: AlertRecord[] = [];
  let groupedHistoryRecords: Record<string, HistoryRecord[]> = {};
  let historyOrder: string[] = [];

  if (demoMode) {
    activeAlerts = getActiveDemoAlerts()
      .filter((account) => accountIds.some((id) => getDemoAccountById(id)?.id === account.id))
      .map((account) => ({
        id: `demo-alert-${account.id}`,
        type: account.alertType,
        severity: account.severity === "high" ? "critical" : "warning",
        message: account.message,
        stripeAccountId: account.id,
        detectedLabel: account.detectedAt,
        cta: account.cta,
      }));

    const historyRecords = getDemoAlertHistory().map((entry, index) => ({
      id: `demo-history-${index}`,
      message: entry.message,
      timestamp: entry.timestamp,
      group: entry.group,
    }));

    groupedHistoryRecords = historyRecords.reduce<Record<string, HistoryRecord[]>>((groups, entry) => {
      if (!groups[entry.group]) {
        groups[entry.group] = [];
      }
      groups[entry.group].push(entry);
      return groups;
    }, {});

    historyOrder = ["Today", "Yesterday", "Earlier this week", "Last week", "Older"].filter(
      (label) => groupedHistoryRecords[label]?.length
    );
  } else {
    const alerts = accountIds.length
      ? await prisma.alert.findMany({
          where: { stripeAccountId: { in: accountIds } },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : [];

    const now = new Date();
    activeAlerts = alerts
      .filter((alert) => alert.windowEnd > now)
      .sort((left, right) => {
        const severityDifference = severityRank(left.severity) - severityRank(right.severity);
        if (severityDifference !== 0) return severityDifference;
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      })
      .map((alert) => ({
        ...alert,
        severity: alert.severity === "critical" ? "critical" : "warning",
      }));

    const historyRecords = alerts
      .filter((alert) => !alert.windowEnd || alert.windowEnd <= now)
      .map((alert) => ({
        id: alert.id,
        message: `${alertLabel(alert.type)} for ${alert.stripeAccountId ? accountNameById.get(alert.stripeAccountId) ?? "Stripe account" : "Stripe account"}`,
        timestamp: formatResolvedTime(alert.windowEnd as Date),
        group: groupHistoryLabel(alert.windowEnd as Date),
      }));

    groupedHistoryRecords = historyRecords.reduce<Record<string, HistoryRecord[]>>((groups, entry) => {
      if (!groups[entry.group]) {
        groups[entry.group] = [];
      }
      groups[entry.group].push(entry);
      return groups;
    }, {});

    historyOrder = ["Today", "Yesterday", "This week", "Older"].filter(
      (label) => groupedHistoryRecords[label]?.length
    );
  }

  const historyCount = Object.values(groupedHistoryRecords).reduce(
    (count, entries) => count + entries.length,
    0
  );

  return (
    <>
      <Navbar mode="app" />
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.header}>
            <div>
              <h1>Alerts</h1>
              <p>Review current issues and past alert activity across your connected accounts.</p>
            </div>
            <Link href="/dashboard" className={styles.backLink}>
              Back to dashboard
            </Link>
          </div>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Active Alerts</h2>
              <span className={styles.sectionCount}>{activeAlerts.length}</span>
            </div>

            {activeAlerts.length === 0 ? (
              <div className={styles.emptyState}>No active alerts right now.</div>
            ) : (
              <div className={styles.list}>
                {activeAlerts.map((alert) => {
                  const severity = severityMeta(alert.severity);
                  const accountName = alert.stripeAccountId
                    ? accountNameById.get(alert.stripeAccountId) ?? "Stripe account"
                    : "Stripe account";
                  const action = buildAlertAction(alert);

                  return (
                    <article key={alert.id} className={`${styles.card} ${severity.cardClass}`}>
                      <div className={styles.cardHeader}>
                        <div>
                          <h3>{accountName}</h3>
                          <p className={styles.cardType}>{alertLabel(alert.type)}</p>
                        </div>
                        <span className={`${styles.severityBadge} ${severity.badgeClass}`}>
                          {severity.label}
                        </span>
                      </div>

                      <p className={styles.cardBody}>{buildReadableAlertMessage(alert)}</p>

                      <div className={styles.cardFooter}>
                        <span>
                          {alert.detectedLabel
                            ? `Detected ${alert.detectedLabel}`
                            : `Active for ${formatActiveDuration(alert.createdAt as Date)}`}
                        </span>
                        <Link href={action.href} className={styles.cardAction}>
                          {action.label}
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Alert History</h2>
              <span className={styles.sectionCount}>{historyCount}</span>
            </div>

            {historyCount === 0 ? (
              <div className={styles.emptyState}>No alert history yet.</div>
            ) : (
              <div className={styles.historyGroups}>
                {historyOrder.map((groupLabel) => (
                  <div key={groupLabel} className={styles.historyGroup}>
                    <h3 className={styles.historyGroupTitle}>{groupLabel}</h3>
                    <div className={styles.historyList}>
                      {groupedHistoryRecords[groupLabel].map((entry) => (
                        <article key={entry.id} className={styles.historyItem}>
                          <div className={styles.historyCopy}>
                            <p className={styles.historyText}>{entry.message}</p>
                          </div>
                          <span className={styles.historyMeta}>{entry.timestamp}</span>
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
