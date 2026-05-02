import { auth } from "@/auth";
import Navbar from "@/components/Navbar";
import { getPlanLabel, getPlanLimit, PLAN_LABELS } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "./page.module.css";

type BillingPageProps = {
  searchParams?: Promise<{
    reason?: string;
    billing?: string;
  }>;
};

const upgradePlans = [
  {
    key: "GROWTH" as const,
    price: "€79",
    checkoutHref: "/api/billing/checkout/growth",
    features: [
      "Up to 10 connected Stripe accounts",
      "Revenue and failure monitoring across a broader portfolio",
      "Upgrade to monitor more Stripe accounts.",
    ],
    cta: "Upgrade to Growth",
  },
  {
    key: "PRO" as const,
    price: "€149",
    checkoutHref: "/contact?plan=pro",
    features: [
      "Up to 25 connected Stripe accounts",
      "More headroom for larger Stripe operations",
      "Upgrade to monitor more Stripe accounts.",
    ],
    cta: "Upgrade to Pro",
    featured: true,
  },
];

const PLAN_RANK = {
  FREE: 0,
  GROWTH: 1,
  PRO: 2,
} as const;

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

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      plan: true,
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

  return (
    <>
      <Navbar mode="app" />
      <main className={styles.page}>
        <div className={styles.shell}>
          <Link href="/dashboard" className={styles.backLink}>
            Back to dashboard
          </Link>

          {params?.reason === "limit_reached" ? (
            <div className={styles.notice}>
              You’ve reached your account limit. Upgrade to connect more Stripe accounts.
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

          {params?.billing === "no_profile" ? (
            <div className={styles.noticeMuted}>
              No billing profile found yet.
            </div>
          ) : null}

          <header className={styles.header}>
            <h1>Billing</h1>
            <p>
              {showLimitMessage
                ? `You've reached your limit of ${planLimit} connected Stripe account${planLimit === 1 ? "" : "s"}. Upgrade to monitor more accounts.`
                : "Review your current plan and unlock more connected Stripe accounts when you need them."}
            </p>
          </header>

          <section className={styles.layoutGrid}>
            <aside className={styles.sidebar}>
              <article className={styles.planCard}>
                <span className={styles.planLabel}>Current plan: {currentPlanLabel}</span>

                <div className={styles.progressTrack} aria-hidden="true">
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${Math.min(100, Math.max((connectedAccountCount / planLimit) * 100, 8))}%`,
                    }}
                  />
                </div>

                <div className={styles.planUsage}>
                  {connectedAccountCount} / {planLimit} accounts used
                </div>
              </article>
            </aside>

            <div className={styles.upgradeGrid}>
              {upgradePlans.map((plan) => {
                const planRank = PLAN_RANK[plan.key];
                const isCurrentPlan = plan.key === user.plan;
                const canUpgradeToPlan = planRank > currentPlanRank;

                return (
                  <article
                    key={plan.key}
                    className={`${styles.upgradeCard}${plan.featured ? ` ${styles.upgradeCardFeatured}` : ""}`}
                  >
                    {plan.featured ? (
                      <span className={styles.recommendedBadge}>Recommended for you</span>
                    ) : null}

                    <div className={styles.upgradeTopRule} aria-hidden={!plan.featured} />

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
                      ) : canUpgradeToPlan ? (
                        <Link
                          href={plan.checkoutHref}
                          className={`${styles.upgradeButton} ${styles.upgradeButtonPrimary}`}
                        >
                          {plan.cta}
                        </Link>
                      ) : (
                        <span className={styles.upgradePlanNote}>Lower tier</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <p className={styles.trustLine}>
            You can upgrade or cancel anytime. No changes are made to your Stripe accounts.
          </p>
        </div>
      </main>
    </>
  );
}
