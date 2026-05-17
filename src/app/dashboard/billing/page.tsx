import { auth } from "@/auth";
import { getPlanLabel, getPlanLimit, PLAN_LABELS } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { getManagedSubscriptionsForCustomer } from "@/lib/subscription-sync";
import { getStripeMode } from "@/lib/stripe-customer";
import { stripe } from "@/lib/stripe";
import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "./page.module.css";

type BillingPageProps = {
  searchParams?: Promise<{
    reason?: string;
    billing?: string;
    connected?: string;
  }>;
};

const upgradePlans = [
  {
    key: "GROWTH" as const,
    price: "€39",
    upgradeHref: "/api/billing/checkout/growth",
    downgradeHref: "/api/billing/change-plan/growth",
    features: [
      "Up to 10 connected Stripe accounts",
      "Revenue and failure monitoring across a broader portfolio",
      "Best when you only need up to 10 connected accounts.",
    ],
    upgradeCta: "Upgrade to Growth",
    downgradeCta: "Downgrade to Growth",
  },
  {
    key: "PRO" as const,
    price: "€99",
    upgradeHref: "/api/billing/checkout/pro",
    features: [
      "Up to 25 connected Stripe accounts",
      "More headroom for larger Stripe operations",
      "Upgrade to monitor more Stripe accounts.",
    ],
    upgradeCta: "Upgrade to Pro",
  },
];

const PLAN_RANK = {
  FREE: 0,
  GROWTH: 1,
  PRO: 2,
} as const;

const GROWTH_LIMIT = 10;

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.checkIcon}>
      <path
        fill="currentColor"
        d="M10 1.75a8.25 8.25 0 1 0 8.25 8.25A8.26 8.26 0 0 0 10 1.75Zm3.72 6.74-4.36 4.58a.75.75 0 0 1-1.08.02L6.3 11.12l1.05-1.07 1.45 1.43 3.83-4.03Z"
      />
    </svg>
  );
}

function formatBillingDate(timestampSeconds: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestampSeconds * 1000));
}

export default async function DashboardBillingPage({ searchParams }: BillingPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      plan: true,
      stripeCustomerId: true,
      stripeTestCustomerId: true,
      stripeLiveCustomerId: true,
      stripeAccounts: {
        where: { status: "active" },
        select: { id: true },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const currentPlanLabel = getPlanLabel(user.plan);
  const connectedAccountCount = user.stripeAccounts.length;
  const planLimit = getPlanLimit(user.plan);
  const currentPlanRank = PLAN_RANK[user.plan as keyof typeof PLAN_RANK] ?? 0;
  const showLimitMessage =
    params?.reason === "limit_reached" || connectedAccountCount >= planLimit;
  const proDowngradeBlocked =
    user.plan === "PRO" && connectedAccountCount > GROWTH_LIMIT;
  const blockedConnectedCount = Number(params?.connected ?? connectedAccountCount);
  const accountsToPause = Math.max(0, blockedConnectedCount - GROWTH_LIMIT);
  const { field } = getStripeMode();
  const customerId = user[field] ?? user.stripeCustomerId;

  let scheduledDowngradeDateLabel: string | null = null;

  if (user.plan === "PRO" && customerId) {
    const managedSubscriptions = await getManagedSubscriptionsForCustomer(customerId);
    const currentManagedSubscription = managedSubscriptions[0];

    if (currentManagedSubscription) {
      const fullSubscription = await stripe.subscriptions.retrieve(
        currentManagedSubscription.id,
        { expand: ["schedule"] }
      );
      const scheduleObject =
        typeof fullSubscription.schedule === "string"
          ? await stripe.subscriptionSchedules.retrieve(fullSubscription.schedule)
          : fullSubscription.schedule;

      if (
        scheduleObject &&
        scheduleObject.phases.some((phase) =>
          phase.items.some(
            (item) => item.price === process.env.STRIPE_GROWTH_PRICE_ID
          )
        )
      ) {
        const growthPhase = scheduleObject.phases.find((phase) =>
          phase.items.some(
            (item) => item.price === process.env.STRIPE_GROWTH_PRICE_ID
          )
        );

        if (growthPhase?.start_date) {
          scheduledDowngradeDateLabel = formatBillingDate(growthPhase.start_date);
        }
      }
    }
  }

  return (
    <div className={styles.shell}>
      {params?.reason === "limit_reached" ? (
        <div className={styles.notice}>
          You&apos;ve reached your account limit. Upgrade to connect more Stripe
          accounts.
        </div>
      ) : null}

      {params?.billing === "cancelled" ? (
        <div className={styles.noticeMuted}>
          Checkout was cancelled. Your current plan is still active.
        </div>
      ) : null}

      {params?.billing === "customer_error" ? (
        <div className={styles.noticeMuted}>
          We couldn&apos;t prepare billing for this account right now. Please try again.
        </div>
      ) : null}

      {params?.billing === "missing_growth_price" ? (
        <div className={styles.noticeMuted}>
          Growth billing is not configured yet. Please try again shortly.
        </div>
      ) : null}

      {params?.billing === "use_billing_page" ? (
        <div className={styles.noticeMuted}>
          Use the Billing page buttons to manage plan changes.
        </div>
      ) : null}

      {params?.billing === "no_profile" ? (
        <div className={styles.noticeMuted}>No billing profile found yet.</div>
      ) : null}

      {params?.billing === "downgrade_cancelled" ? (
        <div className={styles.noticeMuted}>
          Your scheduled downgrade has been canceled. Pro will stay active.
        </div>
      ) : null}

      {params?.billing === "downgrade_error" ? (
        <div className={styles.noticeMuted}>
          We couldn&apos;t schedule the downgrade right now. Please try again.
        </div>
      ) : null}

      {params?.billing === "downgrade_blocked" || proDowngradeBlocked ? (
        <div className={styles.notice}>
          <div>
            Growth supports up to 10 connected Stripe accounts. You currently
            have {blockedConnectedCount} connected accounts. To downgrade to
            Growth, please pause or disconnect {accountsToPause} account
            {accountsToPause === 1 ? "" : "s"} first.
          </div>
          <Link href="/dashboard#connected-accounts" className={styles.noticeLink}>
            Manage connected accounts
          </Link>
        </div>
      ) : null}

      {scheduledDowngradeDateLabel ? (
        <div className={styles.noticeMuted}>
          <div>
            Downgrade scheduled. Your plan will change to Growth on{" "}
            {scheduledDowngradeDateLabel}.
          </div>
          <form
            action="/api/billing/change-plan/pro"
            method="post"
            className={styles.actionForm}
          >
            <button type="submit" className={styles.noticeLinkButton}>
              Keep Pro
            </button>
          </form>
        </div>
      ) : null}

      <header className={styles.header}>
        <h1>Billing</h1>
        <p>Review your plan, account limit, and subscription settings.</p>
      </header>

      <section className={styles.layoutGrid}>
        <aside className={styles.sidebar}>
          <article className={styles.planCard}>
            <span className={styles.planLabel}>
              Current plan: {currentPlanLabel}
            </span>

            <div className={styles.progressTrack} aria-hidden="true">
              <div
                className={styles.progressFill}
                style={{
                  width: `${Math.min(
                    100,
                    Math.max((connectedAccountCount / planLimit) * 100, 8)
                  )}%`,
                }}
              />
            </div>

            <div className={styles.planUsage}>
              {connectedAccountCount} / {planLimit} accounts used
            </div>
          </article>

          <article className={styles.planCard}>
            <span className={styles.planLabel}>Billing management</span>
            <p className={styles.planSupportCopy}>
              Manage payment method, view invoices, or cancel your subscription in
              Stripe&apos;s secure billing portal.
            </p>
            <Link
              href="/api/billing/portal"
              className={`${styles.upgradeButton} ${styles.upgradeButtonSecondary} ${styles.portalButton}`}
            >
              Open billing portal
            </Link>
          </article>
        </aside>

        <div className={styles.upgradeGrid}>
          {upgradePlans.map((plan) => {
            const planRank = PLAN_RANK[plan.key];
            const isCurrentPlan = plan.key === user.plan;
            const canUpgradeToPlan = planRank > currentPlanRank;
            const isProToGrowthDowngrade =
              user.plan === "PRO" && plan.key === "GROWTH";
            const downgradeScheduled =
              isProToGrowthDowngrade && Boolean(scheduledDowngradeDateLabel);
            const isInteractive =
              (!isCurrentPlan && canUpgradeToPlan) ||
              (isProToGrowthDowngrade && !downgradeScheduled);
            const showRecommendedBadge =
              user.plan === "FREE" && plan.key === "GROWTH";
            const isFeaturedCard = showRecommendedBadge;

            return (
              <article
                key={plan.key}
                className={`${styles.upgradeCard}${isFeaturedCard ? ` ${styles.upgradeCardFeatured}` : ""}${isInteractive ? ` ${styles.upgradeCardInteractive}` : ""}`}
              >
                {showRecommendedBadge ? (
                  <span className={styles.recommendedBadge}>
                    Recommended for you
                  </span>
                ) : null}

                <div
                  className={styles.upgradeTopRule}
                  aria-hidden={!isFeaturedCard}
                />

                <div className={styles.upgradeBody}>
                  <div>
                    <h2>{PLAN_LABELS[plan.key]}</h2>
                    <div className={styles.priceRow}>
                      <strong>{plan.price}</strong>
                      <span>/mo</span>
                    </div>
                  </div>

                  <ul className={styles.featureList}>
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <CheckIcon />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrentPlan ? (
                    <span
                      className={`${styles.upgradeButton} ${styles.upgradeButtonDisabled}`}
                      aria-disabled="true"
                    >
                      Current Plan
                    </span>
                  ) : isProToGrowthDowngrade ? (
                    proDowngradeBlocked ? (
                      <Link
                        href="/dashboard#connected-accounts"
                        className={`${styles.upgradeButton} ${styles.upgradeButtonPrimary}`}
                      >
                        Manage connected accounts
                      </Link>
                    ) : downgradeScheduled ? (
                      <span
                        className={`${styles.upgradeButton} ${styles.upgradeButtonDisabled}`}
                        aria-disabled="true"
                      >
                        Downgrade scheduled
                      </span>
                    ) : (
                      <form
                        action={plan.downgradeHref}
                        method="post"
                        className={styles.actionForm}
                      >
                        <button
                          type="submit"
                          className={`${styles.upgradeButton} ${styles.upgradeButtonSecondary}`}
                        >
                          {plan.downgradeCta}
                        </button>
                      </form>
                    )
                  ) : canUpgradeToPlan ? (
                    <Link
                      href={plan.upgradeHref}
                      className={`${styles.upgradeButton} ${plan.key === "GROWTH" ? styles.upgradeButtonPrimary : styles.upgradeButtonSecondary}`}
                    >
                      {plan.upgradeCta}
                    </Link>
                  ) : (
                    <span className={styles.upgradePlanNote}>Lower tier</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <p className={styles.taxNote}>Prices exclude VAT and applicable taxes.</p>
      </section>

      <p className={styles.trustLine}>
        You can upgrade or cancel anytime. No changes are made to your Stripe
        accounts.
      </p>
    </div>
  );
}
