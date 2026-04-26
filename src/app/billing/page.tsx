import { auth } from "@/auth";
import Navbar from "@/components/Navbar";
import { getPlanLabel, getPlanLimit, PLAN_LABELS, PLAN_LIMITS } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

type BillingPageProps = {
  searchParams?: Promise<{
    limitReached?: string;
  }>;
};

const upgradePlans = [
  { key: "GROWTH" as const, description: "Up to 10 connected Stripe accounts" },
  { key: "PRO" as const, description: "Up to 25 connected Stripe accounts" },
];

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
      <main
        style={{
          minHeight: "calc(100vh - 72px)",
          padding: "40px 24px 72px",
          background: "#f8f9fa",
        }}
      >
        <div
          style={{
            maxWidth: 860,
            margin: "0 auto",
            display: "grid",
            gap: 20,
          }}
        >
          <Link
            href="/dashboard"
            style={{
              color: "#64748b",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Back to dashboard
          </Link>

          <section
            style={{
              padding: 32,
              borderRadius: 18,
              background: "#ffffff",
              border: "1px solid rgba(193, 198, 215, 0.22)",
              boxShadow: "0 2px 8px rgba(25, 28, 29, 0.035)",
              display: "grid",
              gap: 20,
            }}
          >
            <div style={{ display: "grid", gap: 10 }}>
              <h1
                style={{
                  fontSize: 40,
                  lineHeight: 1,
                  fontWeight: 900,
                  letterSpacing: "-0.05em",
                  color: "#191c1d",
                }}
              >
                Billing
              </h1>
              <p
                style={{
                  color: "#414755",
                  fontSize: 17,
                  lineHeight: 1.7,
                  maxWidth: 640,
                }}
              >
                {showLimitMessage
                  ? `Your current plan includes ${planLimit} connected Stripe account${planLimit === 1 ? "" : "s"}. Upgrade to monitor more accounts.`
                  : "Manage your current plan and view the account limit for this workspace."}
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 14,
              }}
            >
              <div
                style={{
                  padding: 18,
                  borderRadius: 14,
                  background: "#f8f9fa",
                  border: "1px solid rgba(193, 198, 215, 0.2)",
                }}
              >
                <span
                  style={{
                    display: "block",
                    marginBottom: 8,
                    color: "#717786",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  Current plan
                </span>
                <strong style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.04em" }}>
                  {currentPlanLabel}
                </strong>
              </div>

              <div
                style={{
                  padding: 18,
                  borderRadius: 14,
                  background: "#f8f9fa",
                  border: "1px solid rgba(193, 198, 215, 0.2)",
                }}
              >
                <span
                  style={{
                    display: "block",
                    marginBottom: 8,
                    color: "#717786",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  Connected accounts
                </span>
                <strong style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.04em" }}>
                  {connectedAccountCount}
                </strong>
              </div>

              <div
                style={{
                  padding: 18,
                  borderRadius: 14,
                  background: "#f8f9fa",
                  border: "1px solid rgba(193, 198, 215, 0.2)",
                }}
              >
                <span
                  style={{
                    display: "block",
                    marginBottom: 8,
                    color: "#717786",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  Plan limit
                </span>
                <strong style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.04em" }}>
                  {planLimit}
                </strong>
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <h2
                style={{
                  fontSize: 22,
                  lineHeight: 1.1,
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  color: "#191c1d",
                }}
              >
                Upgrade options
              </h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 14,
                }}
              >
                {upgradePlans.map((plan) => (
                  <article
                    key={plan.key}
                    style={{
                      padding: 20,
                      borderRadius: 14,
                      background: "#ffffff",
                      border: "1px solid rgba(193, 198, 215, 0.22)",
                      boxShadow: "0 2px 8px rgba(25, 28, 29, 0.03)",
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          fontSize: 20,
                          fontWeight: 900,
                          letterSpacing: "-0.03em",
                          color: "#191c1d",
                        }}
                      >
                        {PLAN_LABELS[plan.key]}
                      </h3>
                      <p
                        style={{
                          marginTop: 6,
                          color: "#414755",
                          fontSize: 15,
                          lineHeight: 1.6,
                        }}
                      >
                        {plan.description}
                      </p>
                    </div>

                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 38,
                        padding: "0 14px",
                        borderRadius: 10,
                        background: "#f3f4f5",
                        color: "#717786",
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    >
                      Checkout coming soon
                    </span>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
