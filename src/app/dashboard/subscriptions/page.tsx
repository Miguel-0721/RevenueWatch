import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import {
  previewAffectedSubscriptions,
  type PreviewAffectedSubscriptionRow,
  type PreviewAffectedSubscriptionType,
} from "@/app/dashboard/previewData";
import { formatMoneyAmount, normalizeCurrencyCode } from "@/lib/currency";
import { prisma } from "@/lib/prisma";

import styles from "./page.module.css";

type DashboardSubscriptionsPageProps = {
  searchParams?: Promise<{
    preview?: string;
    type?: string;
    account?: string;
    plan?: string;
    page?: string;
  }>;
};

type SubscriptionListRow = {
  id: string;
  customerPrimary: string;
  customerSecondary?: string | null;
  customerEmail?: string | null;
  accountLabel: string;
  accountValue: string;
  planLabel: string;
  planValue: string;
  impact: string;
  time: string;
  href: string;
};

type SelectOption = {
  value: string;
  label: string;
};

type StripeAccountLookupRow = {
  stripeAccountId: string;
  name: string | null;
};

type FailedRenewalQueryRow = {
  id: string;
  stripeAccountId: string;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  currency: string | null;
  amountDue: number | null;
  occurredAt: Date;
  priceId: string | null;
  subscriptionCurrency: string | null;
  interval: string | null;
  intervalCount: number | null;
  quantity: number | null;
  unitAmount: number | null;
  estimatedMonthlyRevenue: number | null;
  subscriptionCustomerId: string | null;
};

type SubscriptionQueryRow = {
  id: string;
  stripeSubscriptionId: string;
  stripeAccountId: string;
  stripeCustomerId: string | null;
  priceId: string | null;
  currency: string | null;
  interval: string | null;
  intervalCount: number | null;
  quantity: number;
  unitAmount: number | null;
  estimatedMonthlyRevenue: number;
  currentPeriodStart: Date | null;
  trialEnd: Date | null;
  canceledAt: Date | null;
  endedAt: Date | null;
  lastEventCreatedAt: Date | null;
  updatedAt: Date;
};

const PAGE_SIZE = 10;
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const TYPE_OPTIONS: PreviewAffectedSubscriptionType[] = [
  "active",
  "failed-renewal",
  "past-due",
  "trialing",
  "unpaid",
  "canceled",
];

function isPreviewType(value: string | undefined): value is PreviewAffectedSubscriptionType {
  return Boolean(value && TYPE_OPTIONS.includes(value as PreviewAffectedSubscriptionType));
}

function titleForType(type: PreviewAffectedSubscriptionType) {
  return previewAffectedSubscriptions[type].title;
}

function subtitleForType(type: PreviewAffectedSubscriptionType) {
  return previewAffectedSubscriptions[type].subtitle;
}

function impactColumnLabel(type: PreviewAffectedSubscriptionType) {
  if (type === "active") return "MRR";
  if (type === "trialing") return "Trial ends";
  return type === "canceled" ? "MRR impact" : "Amount at risk";
}

function timeColumnLabel(type: PreviewAffectedSubscriptionType) {
  if (type === "active") return "Started";
  if (type === "trialing") return "Days left";
  if (type === "failed-renewal") return "Failed at";
  if (type === "past-due") return "Became past due";
  if (type === "unpaid") return "Marked unpaid";
  return "Canceled at";
}

function emptyStateCopy(type: PreviewAffectedSubscriptionType) {
  if (type === "active") {
    return {
      title: "No active subscriptions found",
      body: "Parveil is monitoring this Stripe account, but there are no active paid subscriptions to show yet.",
    };
  }

  if (type === "trialing") {
    return {
      title: "No trialing subscriptions found",
      body: "There are no subscriptions currently in trial for this Stripe account.",
    };
  }

  if (type === "past-due") {
    return {
      title: "No past-due subscriptions found",
      body: "No subscriptions are currently marked past due.",
    };
  }

  if (type === "unpaid") {
    return {
      title: "No unpaid subscriptions found",
      body: "No subscriptions are currently marked unpaid.",
    };
  }

  if (type === "canceled") {
    return {
      title: "No canceled subscriptions found",
      body: "No recently canceled subscriptions are available for this view.",
    };
  }

  return {
    title: "No failed renewals found",
    body: "No failed renewal payments are available for this view.",
  };
}

function filterRows(rows: SubscriptionListRow[], account: string, plan: string) {
  return rows.filter((row) => {
    if (account !== "all" && row.accountValue !== account) return false;
    if (plan !== "all" && row.planValue !== plan) return false;
    return true;
  });
}

function formatRecurringInterval(interval: string | null | undefined, intervalCount: number) {
  if (!interval) return null;

  if (intervalCount <= 1) {
    if (interval === "day") return "/ day";
    if (interval === "week") return "/ week";
    if (interval === "month") return "/ month";
    if (interval === "year") return "/ year";
    return null;
  }

  if (interval === "day") return `every ${intervalCount} days`;
  if (interval === "week") return `every ${intervalCount} weeks`;
  if (interval === "month") return `every ${intervalCount} months`;
  if (interval === "year") return `every ${intervalCount} years`;
  return null;
}

function buildRealPlanValue(input: {
  priceId?: string | null;
  currency?: string | null;
  unitAmount?: number | null;
  interval?: string | null;
  intervalCount?: number | null;
  quantity?: number | null;
}) {
  if (input.priceId) return input.priceId;

  return [
    "fallback",
    normalizeCurrencyCode(input.currency ?? "EUR"),
    input.unitAmount ?? "na",
    input.interval ?? "na",
    input.intervalCount ?? 1,
    input.quantity ?? 1,
  ].join(":");
}

function buildRealPlanLabel(input: {
  currency?: string | null;
  unitAmount?: number | null;
  interval?: string | null;
  intervalCount?: number | null;
  quantity?: number | null;
}) {
  const quantity =
    typeof input.quantity === "number" && Number.isFinite(input.quantity)
      ? Math.max(1, Math.round(input.quantity))
      : 1;
  const intervalCount =
    typeof input.intervalCount === "number" && Number.isFinite(input.intervalCount)
      ? Math.max(1, Math.round(input.intervalCount))
      : 1;
  const totalAmount =
    typeof input.unitAmount === "number" && Number.isFinite(input.unitAmount)
      ? Math.max(0, Math.round(input.unitAmount)) * quantity
      : null;

  if (totalAmount === null || !input.interval) {
    return "Unknown plan";
  }

  const amountLabel = formatMoneyAmount(totalAmount, input.currency);
  const recurringLabel = formatRecurringInterval(input.interval, intervalCount);

  return recurringLabel ? `${amountLabel} ${recurringLabel}` : amountLabel;
}

function formatDateTimeLabel(value: Date | null | undefined) {
  return value ? DATE_TIME_FORMATTER.format(value) : "—";
}

function formatDateLabel(value: Date | null | undefined) {
  return value ? DATE_FORMATTER.format(value) : "—";
}

function formatDaysLeft(value: Date | null | undefined) {
  if (!value) return "—";

  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = Math.ceil((value.getTime() - now.getTime()) / msPerDay);

  if (diff <= 0) return "Ends today";
  if (diff === 1) return "1 day left";
  return `${diff} days left`;
}

function mapPreviewRows(rows: PreviewAffectedSubscriptionRow[]): SubscriptionListRow[] {
  return rows.map((row) => ({
    id: row.id,
    customerPrimary: row.customerName,
    customerSecondary: row.customerEmail,
    customerEmail: row.customerEmail,
    accountLabel: row.account,
    accountValue: row.account,
    planLabel: row.plan,
    planValue: row.plan,
    impact: row.impact,
    time: row.lastEvent,
    href: row.href,
  }));
}

function uniqueOptions(options: SelectOption[]) {
  const optionMap = new Map<string, string>();

  for (const option of options) {
    if (!optionMap.has(option.value)) {
      optionMap.set(option.value, option.label);
    }
  }

  return Array.from(optionMap.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) =>
      left.label.localeCompare(right.label, "en-US", { sensitivity: "base" }),
    );
}

async function loadRealRows(
  userId: string,
  selectedType: PreviewAffectedSubscriptionType,
): Promise<SubscriptionListRow[]> {
  const accounts = await prisma.$queryRaw<StripeAccountLookupRow[]>`
    SELECT "stripeAccountId", "name"
    FROM "StripeAccount"
    WHERE "userId" = ${userId}
      AND "status" = 'active'
    ORDER BY COALESCE("name", "stripeAccountId") ASC
  `;

  const stripeAccountIds = accounts.map((account) => account.stripeAccountId);
  const accountMap = new Map(
    accounts.map((account) => [
      account.stripeAccountId,
      account.name?.trim() || account.stripeAccountId,
    ]),
  );

  if (stripeAccountIds.length === 0) {
    return [];
  }

  if (selectedType === "failed-renewal") {
    const events = await prisma.$queryRaw<FailedRenewalQueryRow[]>(Prisma.sql`
      SELECT
        e."id",
        e."stripeAccountId",
        e."stripeSubscriptionId",
        e."stripeCustomerId",
        e."currency",
        e."amountDue",
        e."occurredAt",
        s."priceId",
        s."currency" AS "subscriptionCurrency",
        s."interval",
        s."intervalCount",
        s."quantity",
        s."unitAmount",
        s."estimatedMonthlyRevenue",
        s."stripeCustomerId" AS "subscriptionCustomerId"
      FROM "SubscriptionHealthEvent" e
      LEFT JOIN "SubscriptionHealthSubscription" s
        ON s."stripeSubscriptionId" = e."stripeSubscriptionId"
      WHERE e."stripeAccountId" IN (${Prisma.join(stripeAccountIds)})
        AND e."type" = 'invoice.payment_failed'
        AND e."stripeSubscriptionId" IS NOT NULL
      ORDER BY e."occurredAt" DESC
    `);

    return events.map((event) => {
      const subscriptionCurrency = event.subscriptionCurrency ?? event.currency;

      return {
        id: event.id,
        customerPrimary:
          event.stripeCustomerId ??
          event.subscriptionCustomerId ??
          event.stripeSubscriptionId ??
          "—",
        customerSecondary: event.stripeSubscriptionId ?? null,
        accountLabel: accountMap.get(event.stripeAccountId) ?? event.stripeAccountId,
        accountValue: event.stripeAccountId,
        planLabel: buildRealPlanLabel({
          currency: subscriptionCurrency,
          unitAmount: event.unitAmount,
          interval: event.interval,
          intervalCount: event.intervalCount,
          quantity: event.quantity,
        }),
        planValue: buildRealPlanValue({
          priceId: event.priceId,
          currency: subscriptionCurrency,
          unitAmount: event.unitAmount,
          interval: event.interval,
          intervalCount: event.intervalCount,
          quantity: event.quantity,
        }),
        impact:
          typeof event.amountDue === "number" && event.amountDue > 0
            ? `${formatMoneyAmount(event.amountDue, event.currency)} at risk`
            : typeof event.estimatedMonthlyRevenue === "number"
              ? `${formatMoneyAmount(
                  event.estimatedMonthlyRevenue,
                  subscriptionCurrency,
                )} at risk`
              : "Amount unavailable",
        time: formatDateTimeLabel(event.occurredAt),
        href: `/dashboard/accounts/${encodeURIComponent(event.stripeAccountId)}`,
      };
    });
  }

  const statusByType: Record<Exclude<PreviewAffectedSubscriptionType, "failed-renewal">, string> = {
    active: "active",
    trialing: "trialing",
    "past-due": "past_due",
    unpaid: "unpaid",
    canceled: "canceled",
  };

  const subscriptions = await prisma.$queryRaw<SubscriptionQueryRow[]>(Prisma.sql`
    SELECT
      "id",
      "stripeSubscriptionId",
      "stripeAccountId",
      "stripeCustomerId",
      "priceId",
      "currency",
      "interval",
      "intervalCount",
      "quantity",
      "unitAmount",
      "estimatedMonthlyRevenue",
      "currentPeriodStart",
      "trialEnd",
      "canceledAt",
      "endedAt",
      "lastEventCreatedAt",
      "updatedAt"
    FROM "SubscriptionHealthSubscription"
    WHERE "stripeAccountId" IN (${Prisma.join(stripeAccountIds)})
      AND "status" = ${statusByType[selectedType as Exclude<PreviewAffectedSubscriptionType, "failed-renewal">]}
    ORDER BY "lastEventCreatedAt" DESC NULLS LAST, "updatedAt" DESC
  `);

  return subscriptions.map((subscription) => {
    const baseRow = {
      id: subscription.id,
      customerPrimary: subscription.stripeCustomerId ?? subscription.stripeSubscriptionId,
      customerSecondary: subscription.stripeCustomerId ? subscription.stripeSubscriptionId : null,
      accountLabel:
        accountMap.get(subscription.stripeAccountId) ?? subscription.stripeAccountId,
      accountValue: subscription.stripeAccountId,
      planLabel: buildRealPlanLabel(subscription),
      planValue: buildRealPlanValue(subscription),
      href: `/dashboard/accounts/${encodeURIComponent(subscription.stripeAccountId)}`,
    };

    if (selectedType === "active") {
      return {
        ...baseRow,
        impact: formatMoneyAmount(
          subscription.estimatedMonthlyRevenue,
          subscription.currency,
        ),
        time: formatDateLabel(subscription.currentPeriodStart),
      };
    }

    if (selectedType === "trialing") {
      return {
        ...baseRow,
        impact: formatDateLabel(subscription.trialEnd),
        time: formatDaysLeft(subscription.trialEnd),
      };
    }

    if (selectedType === "canceled") {
      return {
        ...baseRow,
        impact: `${formatMoneyAmount(
          subscription.estimatedMonthlyRevenue,
          subscription.currency,
        )} MRR impact`,
        time: formatDateTimeLabel(
          subscription.canceledAt ?? subscription.endedAt ?? subscription.lastEventCreatedAt,
        ),
      };
    }

    return {
      ...baseRow,
      impact: `${formatMoneyAmount(
        subscription.estimatedMonthlyRevenue,
        subscription.currency,
      )} at risk`,
      time: formatDateTimeLabel(subscription.lastEventCreatedAt ?? subscription.updatedAt),
    };
  });
}

export default async function DashboardSubscriptionsPage({
  searchParams,
}: DashboardSubscriptionsPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const isPreviewMode = params?.preview === "subscription-health";
  const selectedType: PreviewAffectedSubscriptionType = isPreviewType(params?.type)
    ? params.type
    : "failed-renewal";
  const selectedAccount = params?.account ?? "all";
  const selectedPlan = params?.plan ?? "all";
  const selectedPage = Math.max(1, Number.parseInt(params?.page ?? "1", 10) || 1);

  const source = previewAffectedSubscriptions[selectedType];
  const allRows = isPreviewMode
    ? mapPreviewRows(source.rows)
    : await loadRealRows(session.user.id, selectedType);
  const filteredRows = filterRows(allRows, selectedAccount, selectedPlan);
  const accountOptions = uniqueOptions(
    allRows.map((row) => ({
      value: row.accountValue,
      label: row.accountLabel,
    })),
  );
  const planOptions = uniqueOptions(
    allRows.map((row) => ({
      value: row.planValue,
      label: row.planLabel,
    })),
  );
  const impactLabel = impactColumnLabel(selectedType);
  const timeLabel = timeColumnLabel(selectedType);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(selectedPage, totalPages);
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const pageStart = filteredRows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd =
    filteredRows.length === 0 ? 0 : Math.min(filteredRows.length, currentPage * PAGE_SIZE);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1).slice(
    Math.max(0, currentPage - 3),
    Math.min(totalPages, currentPage + 2),
  );
  const buildPageHref = (page: number) => {
    const query = new URLSearchParams();
    if (isPreviewMode) query.set("preview", "subscription-health");
    query.set("type", selectedType);
    if (selectedAccount !== "all") query.set("account", selectedAccount);
    if (selectedPlan !== "all") query.set("plan", selectedPlan);
    if (page > 1) query.set("page", String(page));
    return `/dashboard/subscriptions?${query.toString()}`;
  };

  const emptyState = emptyStateCopy(selectedType);

  return (
    <section className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <div className={styles.headerTitleRow}>
              <h1>{source.title}</h1>
              {isPreviewMode ? <span className={styles.previewBadge}>Preview data</span> : null}
            </div>
            <p>{source.subtitle}</p>
          </div>
          <Link
            href={isPreviewMode ? "/dashboard?preview=subscription-health" : "/dashboard"}
            className={styles.secondaryButton}
          >
            Back to dashboard
          </Link>
        </div>
        <p className={styles.monitoringNote}>
          Read-only monitoring context. Parveil does not retry payments, email customers, or
          change Stripe data.
        </p>
      </header>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2>Affected subscriptions</h2>
            <p>Review the subscription/customer rows behind this subscription-health metric.</p>
            {isPreviewMode && source.helperNote ? (
              <p className={styles.helperLine}>{source.helperNote}</p>
            ) : null}
          </div>
        </div>

        <form className={styles.filterBar} method="get">
          {isPreviewMode ? (
            <input type="hidden" name="preview" value="subscription-health" />
          ) : null}
          <input type="hidden" name="type" value={selectedType} />
          <label className={styles.filterSelectWrap}>
            <span className={styles.filterLabel}>Account</span>
            <select name="account" defaultValue={selectedAccount} className={styles.filterSelect}>
              <option value="all">All accounts</option>
              {accountOptions.map((account) => (
                <option key={account.value} value={account.value}>
                  {account.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filterSelectWrap}>
            <span className={styles.filterLabel}>Plan</span>
            <select name="plan" defaultValue={selectedPlan} className={styles.filterSelect}>
              <option value="all">All plans</option>
              {planOptions.map((plan) => (
                <option key={plan.value} value={plan.value}>
                  {plan.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={styles.filterApply}>
            Apply
          </button>
        </form>

        {filteredRows.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>{emptyState.title}</strong>
            <p>{emptyState.body}</p>
          </div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.rowsTable}>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Account</th>
                    <th>Plan</th>
                    <th>{impactLabel}</th>
                    <th>{timeLabel}</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className={styles.customerCell}>
                          <strong className={styles.customerName}>{row.customerPrimary}</strong>
                          {row.customerSecondary ? (
                            row.customerEmail ? (
                              <a href={`mailto:${row.customerEmail}`} className={styles.customerEmail}>
                                {row.customerSecondary}
                              </a>
                            ) : (
                              <span className={styles.customerEmail}>{row.customerSecondary}</span>
                            )
                          ) : null}
                        </div>
                      </td>
                      <td>{row.accountLabel}</td>
                      <td>{row.planLabel}</td>
                      <td>
                        <span className={styles.impactPill}>{row.impact}</span>
                      </td>
                      <td>{row.time}</td>
                      <td>
                        <Link href={row.href} className={styles.secondaryButtonSmall}>
                          View account
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.mobileList}>
              {paginatedRows.map((row) => (
                <article key={`${row.id}-mobile`} className={styles.mobileCard}>
                  <div className={styles.mobileMain}>
                    <strong className={styles.customerName}>{row.customerPrimary}</strong>
                    {row.customerSecondary ? (
                      row.customerEmail ? (
                        <a href={`mailto:${row.customerEmail}`} className={styles.customerEmail}>
                          {row.customerSecondary}
                        </a>
                      ) : (
                        <span className={styles.customerEmail}>{row.customerSecondary}</span>
                      )
                    ) : null}
                    <span className={styles.mobileMeta}>{row.accountLabel}</span>
                  </div>
                  <div className={styles.mobileGrid}>
                    <span>{row.planLabel}</span>
                    <span className={styles.impactPill}>{row.impact}</span>
                    <span>{row.time}</span>
                  </div>
                  <Link href={row.href} className={styles.secondaryButtonSmall}>
                    View account
                  </Link>
                </article>
              ))}
            </div>

            <div className={styles.paginationFooter}>
              <span>
                Showing {pageStart}–{pageEnd} of {filteredRows.length} subscriptions
              </span>
              {totalPages > 1 ? (
                <nav className={styles.pagination} aria-label="Affected subscriptions pagination">
                  {currentPage > 1 ? (
                    <Link href={buildPageHref(currentPage - 1)} className={styles.paginationButton}>
                      Previous
                    </Link>
                  ) : (
                    <span
                      className={`${styles.paginationButton} ${styles.paginationButtonDisabled}`}
                    >
                      Previous
                    </span>
                  )}
                  <div className={styles.paginationPages}>
                    {pageNumbers.map((pageNumber) =>
                      pageNumber === currentPage ? (
                        <span
                          key={pageNumber}
                          className={`${styles.paginationButton} ${styles.paginationButtonActive}`}
                          aria-current="page"
                        >
                          {pageNumber}
                        </span>
                      ) : (
                        <Link
                          key={pageNumber}
                          href={buildPageHref(pageNumber)}
                          className={styles.paginationButton}
                        >
                          {pageNumber}
                        </Link>
                      ),
                    )}
                  </div>
                  {currentPage < totalPages ? (
                    <Link href={buildPageHref(currentPage + 1)} className={styles.paginationButton}>
                      Next
                    </Link>
                  ) : (
                    <span
                      className={`${styles.paginationButton} ${styles.paginationButtonDisabled}`}
                    >
                      Next
                    </span>
                  )}
                </nav>
              ) : null}
            </div>
          </>
        )}
      </section>
    </section>
  );
}
