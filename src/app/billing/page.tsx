import { auth } from "@/auth";
import Navbar from "@/components/Navbar";
import { getPlanLabel, getPlanLimit, PLAN_LABELS } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "./page.module.css";

type BillingPageProps = {
  searchParams?: Promise<{
    limitReached?: string;
  }>;
};

const upgradePlans = [
  {
    key: "GROWTH" as const,
    price: "€79",
    subtitle: "Scale monitoring",
    limit: 10,
    features: [
      "Up to 10 connected Stripe accounts",
      "Revenue and failure monitoring across a broader portfolio",
      "Checkout wiring coming soon",
    ],
    cta: "Upgrade to Growth",
  },
  {
    key: "PRO" as const,
    price: "€149",
    subtitle: "Portfolio coverage",
    limit: 25,
    features: [
      "Up to 25 connected Stripe accounts",
      "More headroom for larger Stripe operations",
      "Checkout wiring coming soon",
    ],
    cta: "Upgrade to Pro",
    featured: true,
  },
];

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
  const showLimitMessage = params?.limitReached === "1" || connectedAccountCount >= planLimit;

  return (
    <>
      <Navbar mode="app" />
      <main className={styles.page}>
        <div className={styles.shell}>
          <Link href="/dashboard" className={styles.backLink}>
            Back to dashboard
          </Link>

          <header className={styles.header}>
            <h1>Billing</h1>
            <p>
              {showLimitMessage
                ? `Your current plan includes ${planLimit} connected Stripe account${planLimit === 1 ? "" : "s"}. Upgrade to monitor more accounts.`
                : "Review your current plan and unlock more connected Stripe accounts when you need them."}
            </p>
          </header>

          <section className={styles.layoutGrid}>
            <aside className={styles.sidebar}>
              <article className={styles.planCard}>
                <div className={styles.cardEyebrow}>Current plan</div>
                <strong className={styles.planValue}>{currentPlanLabel}</strong>

                <div className={styles.progressTrack} aria-hidden="true">
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${Math.min(100, Math.max((connectedAccountCount / planLimit) * 100, 8))}%`,
                    }}
                  />
                </div>

                <div className={styles.planMetaRow}>
                  <span>Connected accounts: {connectedAccountCount}</span>
                  <span>Plan limit: {planLimit}</span>
                </div>

              </article>

              <article className={styles.noteCard}>
                <div className={styles.cardEyebrow}>Upgrade path</div>
                <p className={styles.noteText}>
                  RevenueWatch keeps billing separate from monitoring so teams can start on Free and only upgrade when account limits are reached.
                </p>
                <p className={styles.noteLink}>Stripe Checkout comes next</p>
              </article>
            </aside>

            <div className={styles.upgradeGrid}>
              {upgradePlans.map((plan) => (
                <article
                  key={plan.key}
                  className={`${styles.upgradeCard}${plan.featured ? ` ${styles.upgradeCardFeatured}` : ""}`}
                >
                  {plan.featured ? <span className={styles.recommendedBadge}>Recommended</span> : null}

                  <div className={styles.upgradeTopRule} aria-hidden={!plan.featured} />

                  <div className={styles.upgradeBody}>
                    <div>
                      <span className={styles.cardEyebrow}>{plan.subtitle}</span>
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

                    <button
                      type="button"
                      className={`${styles.upgradeButton}${plan.featured ? ` ${styles.upgradeButtonPrimary}` : ""}`}
                    >
                      {plan.cta}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
