import { auth } from "@/auth";
import Navbar from "@/components/Navbar";
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
  createdAt: Date;
  windowEnd: Date;
  context?: string | null;
};

function alertLabel(type: string) {
  if (type === "revenue_drop") return "Revenue Drop Detected";
  if (type === "payment_failed") return "Payment Failure Spike";
  return type.replace(/_/g, " ");
}

function resolvedLabel(type: string) {
  if (type === "revenue_drop") return "Revenue drop resolved";
  if (type === "payment_failed") return "Payment failures returned to normal";
  return "Alert resolved";
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

function buildAlertAction(type: string, stripeAccountId: string | null) {
  const href = stripeAccountId
    ? `/dashboard/accounts/${encodeURIComponent(stripeAccountId)}`
    : "/dashboard";

  if (type === "revenue_drop") {
    return { label: "Review Account", href };
  }

  if (type === "payment_failed") {
    return { label: "View Logs", href };
  }

  return { label: "Open Alert", href };
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
  const accountNameById = new Map(
    stripeAccounts.map((account) => [
      account.stripeAccountId,
      account.name?.trim() || "Stripe account",
    ])
  );

  const alerts = accountIds.length
    ? await prisma.alert.findMany({
        where: { stripeAccountId: { in: accountIds } },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
    : [];

  const now = new Date();
  const activeAlerts = alerts
    .filter((alert) => alert.windowEnd > now)
    .sort((left, right) => {
      const severityDifference = severityRank(left.severity) - severityRank(right.severity);

      if (severityDifference !== 0) {
        return severityDifference;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  const resolvedAlerts = alerts.filter((alert) => alert.windowEnd <= now);

  const groupedResolvedAlerts = resolvedAlerts.reduce<Record<string, typeof resolvedAlerts>>(
    (groups, alert) => {
      const label = groupHistoryLabel(alert.windowEnd);
      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(alert);
      return groups;
    },
    {}
  );

  const resolvedGroupOrder = ["Today", "Yesterday", "This week", "Older"].filter(
    (label) => groupedResolvedAlerts[label]?.length
  );

  return (
    <>
      <Navbar mode="app" />
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.header}>
            <div>
              <h1>Alerts</h1>
              <p>Review current issues and resolved alert history across your connected accounts.</p>
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
                  const action = buildAlertAction(alert.type, alert.stripeAccountId);

                  return (
                    <article
                      key={alert.id}
                      className={`${styles.card} ${severity.cardClass}`}
                    >
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
                        <span>Active for {formatActiveDuration(alert.createdAt)}</span>
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
              <h2>Resolved History</h2>
              <span className={styles.sectionCount}>{resolvedAlerts.length}</span>
            </div>

            {resolvedAlerts.length === 0 ? (
              <div className={styles.emptyState}>No resolved alerts yet.</div>
            ) : (
              <div className={styles.historyGroups}>
                {resolvedGroupOrder.map((groupLabel) => (
                  <div key={groupLabel} className={styles.historyGroup}>
                    <h3 className={styles.historyGroupTitle}>{groupLabel}</h3>
                    <div className={styles.historyList}>
                      {groupedResolvedAlerts[groupLabel].map((alert) => {
                        const accountName = alert.stripeAccountId
                          ? accountNameById.get(alert.stripeAccountId) ?? "Stripe account"
                          : "Stripe account";

                        return (
                          <article key={alert.id} className={styles.historyItem}>
                            <div className={styles.historyCopy}>
                              <p className={styles.historyText}>
                                <strong>{resolvedLabel(alert.type)}</strong> for {accountName}.
                              </p>
                              <p className={styles.historyBody}>
                                {buildReadableAlertMessage(alert)}
                              </p>
                            </div>
                            <span className={styles.historyMeta}>
                              {formatResolvedTime(alert.windowEnd)}
                            </span>
                          </article>
                        );
                      })}
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
