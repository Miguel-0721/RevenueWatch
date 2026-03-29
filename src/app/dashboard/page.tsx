import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { DisconnectButton } from "./DisconnectButton";
import { auth, signOut } from "../../auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/* ---------------- HELPERS ---------------- */

function alertLabel(type: string) {
  if (type === "revenue_drop") return "Revenue drop";
  if (type === "payment_failed") return "Payment failures";
  return type;
}

function severityMeta(severity: string) {
  if (severity === "critical") {
    return {
      label: "Critical",
      dot: "#dc2626",
      text: "#991b1b",
      bg: "#fef2f2",
      border: "1px solid #fecaca",
      soft: "#fff7f7",
    };
  }

  return {
    label: "Warning",
    dot: "#d97706",
    text: "#92400e",
    bg: "#fffbeb",
    border: "1px solid #fde68a",
    soft: "#fffdf7",
  };
}

function systemMeta(activeAlertsCount: number) {
  if (activeAlertsCount > 0) {
    return {
      label: "Attention needed",
      dot: "#dc2626",
      text: "#991b1b",
      bg: "#fef2f2",
      border: "1px solid #fecaca",
    };
  }

  return {
    label: "Healthy",
    dot: "#16a34a",
    text: "#166534",
    bg: "#f0fdf4",
    border: "1px solid #bbf7d0",
  };
}


function getAlertAccountName(
  alert: {
    stripeAccountId?: string | null;
    accountName?: string | null;
  },
  accountNameById: Map<string, string>
) {
  if (typeof alert.accountName === "string" && alert.accountName.trim() !== "") {
    return alert.accountName;
  }

  if (alert.stripeAccountId) {
    return accountNameById.get(alert.stripeAccountId) ?? "Unnamed account";
  }

  return "Unnamed account";
}



function headerIssueLabel(activeAlerts: Array<{ severity: string }>) {
  const criticalCount = activeAlerts.filter(
    (alert) => alert.severity === "critical"
  ).length;

  if (criticalCount > 0) {
    return `${criticalCount} critical issue${criticalCount === 1 ? "" : "s"}`;
  }

  const issueCount = activeAlerts.length;

  if (issueCount > 0) {
    return `${issueCount} issue${issueCount === 1 ? "" : "s"} needing attention`;
  }

  return "No active issues";
}


function fmtDate(d: Date) {
  return new Date(d).toLocaleString();
}

function shortId(id?: string | null) {
  if (!id) return "Unknown";
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}


function formatMoneyAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function safeParseContext(input?: string | null) {
  if (!input) return null;

  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function buildReadableAlertMessage(alert: {
  type: string;
  message: string;
  context?: string | null;
}) {
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

  const windowLabel =
    typeof parsed.window === "string" ? parsed.window : "recent window";

  if (ratio) {
    return `Payment failures are ${ratio}× higher than normal (${parsed.failedPayments} vs ${parsed.baseline}) in the ${windowLabel}.`;
  }

  return `Payment failures increased to ${parsed.failedPayments} in the ${windowLabel}.`;
}

if (
  alert.type === "revenue_drop" &&
  typeof parsed.currentRevenue === "number" &&
  typeof parsed.expectedRevenue === "number" &&
  parsed.expectedRevenue > 0
) {
  const dropPercent = Math.round(
    ((parsed.expectedRevenue - parsed.currentRevenue) /
      parsed.expectedRevenue) *
      100
  );

  const windowLabel =
    typeof parsed.window === "string" ? parsed.window : "recent window";

  return `Revenue is down ${dropPercent}% vs expected (${formatMoneyAmount(
    parsed.currentRevenue
  )} vs ${formatMoneyAmount(parsed.expectedRevenue)}) in the ${windowLabel}.`;
}

  return alert.message;
}


/* ---------------- DEMO DATA ---------------- */

const DEMO_NOW = new Date("2026-03-24T10:30:00Z");

const demoStripeAccounts = [
  {
    id: "demo-1",
    name: "Northlane SaaS",
    stripeAccountId: "acct_demo_northlane",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "demo-2",
    name: "BrightGrowth Studio",
    stripeAccountId: "acct_demo_brightgrowth",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "demo-3",
    name: "Studio Meridian",
    stripeAccountId: "acct_demo_meridian",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "demo-4",
    name: "Atlas Commerce",
    stripeAccountId: "acct_demo_atlas",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "demo-5",
    name: "Pixel Harbor",
    stripeAccountId: "acct_demo_pixelharbor",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "demo-6",
    name: "BluePeak Media",
    stripeAccountId: "acct_demo_bluepeak",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "demo-7",
    name: "Luma Health Co",
    stripeAccountId: "acct_demo_luma",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "demo-8",
    name: "Forge Analytics",
    stripeAccountId: "acct_demo_forge",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "demo-9",
    name: "Cedar Creative",
    stripeAccountId: "acct_demo_cedar",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "demo-10",
    name: "Nova Ops",
    stripeAccountId: "acct_demo_novaops",
    status: "active",
    createdAt: DEMO_NOW,
  },
];
const demoLastEventByAccount = new Map<string, Date>([
  ["acct_demo_northlane", new Date("2026-03-24T09:18:00Z")],
  ["acct_demo_brightgrowth", new Date("2026-03-24T09:42:00Z")],
  ["acct_demo_meridian", new Date("2026-03-24T08:57:00Z")],
  ["acct_demo_atlas", new Date("2026-03-24T09:36:00Z")],
  ["acct_demo_pixelharbor", new Date("2026-03-24T09:28:00Z")],
  ["acct_demo_bluepeak", new Date("2026-03-24T09:10:00Z")],
  ["acct_demo_luma", new Date("2026-03-24T09:49:00Z")],
  ["acct_demo_forge", new Date("2026-03-24T09:04:00Z")],
  ["acct_demo_cedar", new Date("2026-03-24T09:33:00Z")],
  ["acct_demo_novaops", new Date("2026-03-24T09:21:00Z")],
]);

const demoAlerts = [
  {
    id: "demo-alert-1",
    type: "payment_failed",
    severity: "critical",
    message: "Payment failures spiked above normal levels in the last 30 minutes.",
    stripeAccountId: "acct_demo_northlane",
    accountName: "Northlane SaaS",
    createdAt: new Date("2026-03-24T09:12:00Z"),
    windowEnd: new Date("2026-03-24T13:12:00Z"),
    context: JSON.stringify({
      failedPayments: 11,
      baseline: 3,
      window: "last 30 minutes",
    }),
  },
  {
    id: "demo-alert-2",
    type: "revenue_drop",
    severity: "critical",
    message: "Revenue is significantly below expected levels for this account.",
    stripeAccountId: "acct_demo_atlas",
    accountName: "Atlas Commerce",
    createdAt: new Date("2026-03-24T09:05:00Z"),
    windowEnd: new Date("2026-03-24T13:05:00Z"),
    context: JSON.stringify({
      expectedRevenue: 4200,
      currentRevenue: 1900,
      window: "last 2 hours",
    }),
  },
  {
    id: "demo-alert-3",
    type: "payment_failed",
    severity: "warning",
    message: "Payment failures increased for this account and should be reviewed.",
    stripeAccountId: "acct_demo_meridian",
    accountName: "Studio Meridian",
    createdAt: new Date("2026-03-24T08:20:00Z"),
    windowEnd: new Date("2026-03-24T11:20:00Z"),
    context: JSON.stringify({
      failedPayments: 6,
      baseline: 2,
      window: "last 30 minutes",
    }),
  },
  {
    id: "demo-alert-4",
    type: "revenue_drop",
    severity: "warning",
    message: "Revenue dipped below normal weekday levels during the current monitoring window.",
    stripeAccountId: "acct_demo_brightgrowth",
    accountName: "BrightGrowth Studio",
    createdAt: new Date("2026-03-24T06:40:00Z"),
    windowEnd: new Date("2026-03-24T08:40:00Z"),
    context: JSON.stringify({
      expectedRevenue: 1240,
      currentRevenue: 768,
      window: "last 2 hours",
    }),
  },
  {
    id: "demo-alert-5",
    type: "payment_failed",
    severity: "warning",
    message: "Payment failures increased for this account and should be reviewed.",
    stripeAccountId: "acct_demo_pixelharbor",
    accountName: "Pixel Harbor",
    createdAt: new Date("2026-03-24T05:55:00Z"),
    windowEnd: new Date("2026-03-24T07:55:00Z"),
    context: JSON.stringify({
      failedPayments: 5,
      baseline: 2,
      window: "last 30 minutes",
    }),
  },
  {
    id: "demo-alert-6",
    type: "revenue_drop",
    severity: "warning",
    message: "Revenue dipped below normal weekday levels during the current monitoring window.",
    stripeAccountId: "acct_demo_cedar",
    accountName: "Cedar Creative",
    createdAt: new Date("2026-03-23T16:20:00Z"),
    windowEnd: new Date("2026-03-23T22:20:00Z"),
    context: JSON.stringify({
      expectedRevenue: 940,
      currentRevenue: 610,
      window: "last 2 hours",
    }),
  },
  {
    id: "demo-alert-7",
    type: "payment_failed",
    severity: "warning",
    message: "Payment failures increased for this account and should be reviewed.",
    stripeAccountId: "acct_demo_forge",
    accountName: "Forge Analytics",
    createdAt: new Date("2026-03-23T14:15:00Z"),
    windowEnd: new Date("2026-03-23T16:15:00Z"),
    context: JSON.stringify({
      failedPayments: 4,
      baseline: 2,
      window: "last 30 minutes",
    }),
  },
];




/* ---------------- PAGE ---------------- */




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

 const hasRealData = stripeAccounts.length > 0;

const displayStripeAccounts = stripeAccounts;
const displayAlerts = alerts;

const lastEventByAccount = new Map(
  lastEvents.map((e) => [e.stripeAccountId, e._max.createdAt])
);

const accountNameById = new Map(
  displayStripeAccounts.map((account) => [
    account.stripeAccountId,
    account.name ?? "Unnamed Stripe account",
  ])
);

const now = new Date();
const activeAlerts = displayAlerts.filter((a) => a.windowEnd > now);
const historicalAlerts = displayAlerts.filter((a) => a.windowEnd <= now);
const activeAccounts = displayStripeAccounts.filter((a) => a.status === "active");
const status = systemMeta(activeAlerts.length);
const envLabel = "Live";

  const topIssueLabel = headerIssueLabel(activeAlerts);

  const alertsByAccount = new Map<string, (typeof displayAlerts)[number][]>();
  for (const account of displayStripeAccounts) {
    const accountAlerts = activeAlerts.filter(
      (alert) => alert.stripeAccountId === account.stripeAccountId
    );
    alertsByAccount.set(account.stripeAccountId, accountAlerts);
  }

 const monitoredAccounts = displayStripeAccounts
  .map((account) => {
    const accountAlerts = alertsByAccount.get(account.stripeAccountId) ?? [];
    const lastActivity = lastEventByAccount.get(account.stripeAccountId) ?? null;
    const topAlert = accountAlerts[0] ?? null;
    const hasCritical = accountAlerts.some((a) => a.severity === "critical");
    const readableIssue = topAlert ? buildReadableAlertMessage(topAlert) : null;

    return {
      ...account,
      lastActivity,
      topAlert,
      hasCritical,
      readableIssue,
    };
  })
    .sort((a, b) => {
      if (a.hasCritical && !b.hasCritical) return -1;
      if (!a.hasCritical && b.hasCritical) return 1;
      if (a.topAlert && !b.topAlert) return -1;
      if (!a.topAlert && b.topAlert) return 1;
      return 0;
    });


const problemAccounts = monitoredAccounts.filter(
  (a) => a.topAlert !== null
);

const healthyAccounts = monitoredAccounts.filter(
  (a) => a.topAlert === null
);

 const activeIncidents = activeAlerts
  .slice()
  .sort((a, b) => {
    const aCritical = a.severity === "critical" ? 1 : 0;
    const bCritical = b.severity === "critical" ? 1 : 0;

    if (aCritical !== bCritical) return bCritical - aCritical;

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        color: "#0f172a",
      }}
    >
      <Navbar />

      <div
        style={{
          maxWidth: 1460,
          margin: "0 auto",
          padding: "104px 20px 72px",
        }}
      >
          <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 16,
          alignItems: "start",
          marginBottom: 18,
        }}
      >
        <TopMonitorBar
          envLabel={envLabel}
          status={status}
          accountsCount={activeAccounts.length}
          topIssueLabel={topIssueLabel}
        />

        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e7edf5",
            borderRadius: 18,
            padding: 14,
            boxShadow: "0 10px 30px rgba(15,23,42,0.04)",
            minWidth: 260,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#64748b",
              marginBottom: 8,
            }}
          >
            Account
          </div>

          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#0f172a",
              lineHeight: 1.3,
            }}
          >
            {session.user.name || "Signed in user"}
          </div>

          <div
            style={{
              fontSize: 13,
              color: "#64748b",
              marginTop: 4,
              lineHeight: 1.5,
              wordBreak: "break-word",
            }}
          >
            {session.user.email}
          </div>

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
            style={{ marginTop: 12 }}
          >
            <button
              type="submit"
              style={{
                width: "100%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 12px",
                borderRadius: 12,
                background: "#0f172a",
                color: "#ffffff",
                border: "none",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </form>
        </section>
      </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 320px",
            gap: 18,
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: 18 }}>
         <Panel>
  <PanelHeader
    title="Accounts needing attention"
    subtitle="Only accounts with active issues are shown here."
  />

  <div
    style={{
      border: "1px solid #e7edf5",
      borderRadius: 16,
      overflow: "hidden",
    }}
  >
    <div
  style={{
    display: "grid",
    gridTemplateColumns:
 "minmax(320px, 1.4fr) 170px 120px",
    padding: "12px 14px",
    background: "#f8fafc",
    borderBottom: "1px solid #e7edf5",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#64748b",
  }}
>
  <div>Account</div>
  <div>Last activity</div>
  <div>Severity</div>
</div>

    {problemAccounts.length === 0 ? (
      <div style={{ padding: 14 }}>
        <SoftEmpty>No accounts need attention right now.</SoftEmpty>
      </div>
    ) : (
     problemAccounts.map((account, index) => (
  <AccountRow
    key={account.id}
    href={`/dashboard/accounts/${encodeURIComponent(account.stripeAccountId)}`}
    isLast={index === problemAccounts.length - 1}
    name={account.name ?? "Unnamed Stripe account"}
    stripeAccountId={account.stripeAccountId}
    status={account.status}
    lastActivity={account.lastActivity}
    topAlert={account.topAlert}
    readableIssue={account.readableIssue}
  />
))
    )}
  </div>
</Panel>

<Panel style={{ opacity: 0.92 }}>
  <PanelHeader
    title="All monitored accounts"
    subtitle="Full list of connected accounts and their current status."
  />

  <div
    style={{
      border: "1px solid #e7edf5",
      borderRadius: 16,
      overflow: "hidden",
    }}
  >
   <div
  style={{
    display: "grid",
   gridTemplateColumns:
 "minmax(320px, 1.4fr) 170px 120px",
    padding: "12px 14px",
    background: "#f8fafc",
    borderBottom: "1px solid #e7edf5",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#64748b",
  }}
>
  <div>Account</div>
  <div>Last activity</div>
  <div>Severity</div>
</div>

   {monitoredAccounts.length === 0 ? (
  <div style={{ padding: 14 }}>
    <SoftEmpty>No Stripe accounts connected yet.</SoftEmpty>
  </div>
) : healthyAccounts.length === 0 ? (
  <div style={{ padding: 14 }}>
    <SoftEmpty>No additional healthy accounts right now.</SoftEmpty>
  </div>
) : (
      healthyAccounts.map((account, index) => (
  <AccountRow
    key={account.id}
    href={`/dashboard/accounts/${encodeURIComponent(account.stripeAccountId)}`}
    isLast={index === healthyAccounts.length - 1}
    name={account.name ?? "Unnamed Stripe account"}
    stripeAccountId={account.stripeAccountId}
    status={account.status}
    lastActivity={account.lastActivity}
    topAlert={account.topAlert}
    readableIssue={account.readableIssue}
  />
))
    )}
  </div>
</Panel>

            <Panel>
              <PanelHeader
                title="Resolved alerts"
                subtitle="Past alerts only. Historical review stays separate from live monitoring."
              />

              <div style={{ display: "grid", gap: 10 }}>
                {historicalAlerts.length === 0 ? (
                  <SoftEmpty>No past alerts yet.</SoftEmpty>
                ) : (
                  historicalAlerts.map((alert) => (
                    <HistoryCard
                      key={alert.id}
                    accountName={getAlertAccountName(alert, accountNameById)}
                      type={alert.type}
                      severity={alert.severity}
                      message={alert.message}
                      context={alert.context}
                      createdAt={alert.createdAt}
                      windowEnd={alert.windowEnd}
                    />
                  ))
                )}
              </div>
            </Panel>
          </div>

       <div style={{ display: "grid", gap: 18 }}>



<Panel>
  <PanelEyebrow>Connection</PanelEyebrow>
  <PanelTitle>Stripe Connect</PanelTitle>
  <PanelText>
    {activeAccounts.length > 0
      ? "Your Stripe account is connected and monitoring is active."
      : "Connect your Stripe account to start monitoring live payment failures and revenue drops."}
  </PanelText>

  <div
    style={{
      marginTop: 14,
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      alignItems: "center",
    }}
  >
    {activeAccounts.length > 0 ? (
      <StatusChip
        status={{
          dot: "#16a34a",
          text: "#166534",
          bg: "#f0fdf4",
          border: "1px solid #bbf7d0",
        }}
        label="Connected"
      />
    ) : (
      <a
        href="/api/stripe/connect"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "10px 14px",
          borderRadius: 12,
          background: "#0f172a",
          color: "#ffffff",
          textDecoration: "none",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        Connect Stripe
      </a>
    )}
  </div>
</Panel>



 <Panel>
  <PanelHeader
    title="Active incidents"
    subtitle="All currently active issues across monitored accounts."
  />

{activeIncidents.length > 0 ? (
  <div
    style={{
      display: "grid",
      gap: 10,
      maxHeight: 420,
      overflowY: "auto",
      scrollbarWidth: "thin",
      paddingRight: 4,
    }}
  >
    {activeIncidents.map((incident) => {
      const accountName = getAlertAccountName(incident, accountNameById);

        return (
        <CompactIncidentCard
  key={incident.id}
  accountName={accountName}
  type={incident.type}
  severity={incident.severity}
  message={buildReadableAlertMessage(incident)}
  createdAt={incident.createdAt}
  windowEnd={incident.windowEnd}
/>
        );
      })}
    </div>
  ) : (
    <SoftEmpty>No active incidents right now.</SoftEmpty>
  )}
</Panel>
</div>
        </div>
      </div>
    </main>
  );
}





/* ---------------- COMPONENTS ---------------- */

function TopMonitorBar({
  envLabel,
  status,
  accountsCount,
  topIssueLabel,
}: {
  envLabel: string;
  status: ReturnType<typeof systemMeta>;
  accountsCount: number;
  topIssueLabel: string;
}) {
  return (
    <section
      style={{
        marginBottom: 18,
        background: "#ffffff",
        border: "1px solid #e7edf5",
        borderRadius: 22,
        padding: 18,
        boxShadow: "0 10px 30px rgba(15,23,42,0.04)",
      }}
    >
      <div
        style={{
          display: "grid",
         gridTemplateColumns: "minmax(0, 1fr)",
          gap: 20,
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
       <Chip label={envLabel} />
<StatusChip
  status={{
    dot: status.dot,
    text: status.text,
    bg: status.bg,
    border: status.border,
  }}
  label={topIssueLabel}
/>
<Chip label={`${accountsCount} account${accountsCount === 1 ? "" : "s"} monitored`} />
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 28,
              lineHeight: 1.08,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: "#0f172a",
            }}
          >
            RevenueWatch monitoring console
          </h1>

          <p
            style={{
              margin: "8px 0 0",
              fontSize: 14,
              lineHeight: 1.75,
              color: "#64748b",
              maxWidth: 780,
            }}
          >
         See which accounts are healthy, which account needs attention, and what issue is active right now.
          </p>
        </div>

      
      </div>
    </section>
  );
}

function Panel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section
     style={{
  background: "#ffffff",
  border: "1px solid #e7edf5",
  borderRadius: 22,
  padding: 16,
  boxShadow: "0 10px 30px rgba(15,23,42,0.04)",
  ...style,
}}
    >
      {children}
    </section>
  );
}

function PanelEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#64748b",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 18,
        fontWeight: 800,
        lineHeight: 1.12,
        letterSpacing: "-0.03em",
        color: "#0f172a",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function PanelText({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 14,
        lineHeight: 1.75,
        color: "#64748b",
      }}
    >
      {children}
    </div>
  );
}

function PanelHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: "-0.03em",
          color: "#0f172a",
          marginBottom: 6,
        }}
      >
        {title}
      </div>

      {subtitle && (
        <div
          style={{
            fontSize: 13,
            color: "#64748b",
            lineHeight: 1.7,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}



function AccountRow({
  href,
  isLast,
  name,
  stripeAccountId,
  status,
  lastActivity,
  topAlert,
  readableIssue,
}: {
  href: string;
  isLast?: boolean;
  name: string;
  stripeAccountId: string;
  status: string;
  lastActivity: Date | null;
  topAlert:
    | {
        id: string;
        type: string;
        severity: string;
        message: string;
        stripeAccountId: string | null;
        createdAt: Date;
        windowEnd: Date;
        context?: string | null;
      }
    | null;
  readableIssue: string | null;
}) {
const hasIssue = !!topAlert;
const sev = topAlert ? severityMeta(topAlert.severity) : null;

const rowAccent = topAlert
  ? topAlert.severity === "critical"
    ? {
        background: "#fff7f7",
        borderLeft: "3px solid #dc2626",
      }
    : {
        background: "#fffdf7",
        borderLeft: "3px solid #d97706",
      }
  : {
      background: "#ffffff",
      borderLeft: "3px solid transparent",
    };

   return (
    <Link
      href={href}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
      }}
    >
   <div
  className="account-row"
  style={{
    display: "grid",
    gridTemplateColumns: "minmax(320px, 1.4fr) 170px 120px",
    padding: "14px",
    background: rowAccent.background,
    borderLeft: rowAccent.borderLeft,
    borderBottom: isLast ? "none" : "1px solid #eef2f7",
    alignItems: "center",
    cursor: "pointer",
    transition: "all 0.15s ease",
  }}
>
        <div style={{ paddingRight: 12 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 750,
              color: hasIssue ? "#0f172a" : "#334155",
              lineHeight: 1.25,
              marginBottom: 5,
            }}
          >
            {name}
          </div>

          <div
            style={{
              fontSize: 12,
              color: "#94a3b8",
            }}
          >
   {shortId(stripeAccountId)}
          </div>

          {readableIssue && (
            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                lineHeight: 1.55,
                color: hasIssue ? "#475569" : "#64748b",
                maxWidth: 320,
              }}
            >
              {readableIssue}
            </div>
          )}
        </div>

        <TableValue value={lastActivity ? fmtDate(lastActivity) : "No activity yet"} />

        <div>
          {topAlert && sev ? (
            <StatusChip
              status={{
                dot: sev.dot,
                text: sev.text,
                bg: sev.bg,
                border: sev.border,
              }}
              label={sev.label}
            />
          ) : (
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#166534",
              }}
            >
             Monitoring
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function CurrentIncidentCard({
  accountName,
  type,
  severity,
  message,
  createdAt,
  windowEnd,
}: {
  accountName: string;
  type: string;
  severity: string;
  message: string;
  createdAt: Date;
  windowEnd: Date;
}) {
  const sev = severityMeta(severity);

  return (
    <div
      style={{
        borderRadius: 16,
        background: sev.soft,
        border: sev.border,
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "flex-start",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          {accountName}
        </div>

        <StatusChip
          status={{
            dot: sev.dot,
            text: sev.text,
            bg: sev.bg,
            border: sev.border,
          }}
          label={sev.label}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <Chip label={alertLabel(type)} />
      </div>

      <div
        style={{
          fontSize: 15,
          lineHeight: 1.7,
          fontWeight: 650,
          color: "#0f172a",
          marginBottom: 10,
        }}
      >
        {message}
      </div>

      <div
        style={{
          display: "grid",
          gap: 6,
          fontSize: 12,
          lineHeight: 1.6,
          color: "#64748b",
        }}
      >
        <div>
          Triggered <strong style={{ color: "#0f172a" }}>{fmtDate(createdAt)}</strong>
        </div>
        <div>
          Active until <strong style={{ color: "#0f172a" }}>{fmtDate(windowEnd)}</strong>
        </div>
      </div>
    </div>
  );
}

function HistoryCard({
  accountName,
  type,
  severity,
  message,
  context,
  createdAt,
  windowEnd,
}: {
  accountName: string;
  type: string;
  severity: string;
  message: string;
  context?: string | null;
  createdAt: Date;
  windowEnd: Date;
}) {
  const sev = severityMeta(severity);

  return (
   <div
  style={{
    borderRadius: 16,
    border: "1px solid #edf2f7",
    background: "#fbfcfe",
    padding: 14,
  }}
>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            {accountName}
          </div>

          <Chip label={alertLabel(type)} />
          <StatusChip
            status={{
              dot: sev.dot,
              text: sev.text,
              bg: sev.bg,
              border: sev.border,
            }}
            label={sev.label}
          />
        </div>
      </div>

   <div
  style={{
    fontSize: 15,
    lineHeight: 1.7,
    fontWeight: 600,
    color: "#334155",
    marginBottom: 10,
  }}
>
{buildReadableAlertMessage({ type, message, context })}
</div>

      <div
        style={{
          display: "flex",
          gap: 18,
          flexWrap: "wrap",
          fontSize: 12,
          lineHeight: 1.6,
          color: "#64748b",
        }}
      >
        <span>
          Triggered <strong style={{ color: "#0f172a" }}>{fmtDate(createdAt)}</strong>
        </span>
        <span>
          Ended <strong style={{ color: "#0f172a" }}>{fmtDate(windowEnd)}</strong>
        </span>
      </div>
    </div>
  );
}

function TableValue({
  value,
  accent,
}: {
  value: React.ReactNode;
  accent?: string;
}) {
  return (
    <div
      style={{
        fontSize: 13,
        lineHeight: 1.6,
        fontWeight: 700,
        color: accent ?? "#0f172a",
        paddingRight: 10,
      }}
    >
      {value}
    </div>
  );
}



function Chip({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "7px 10px",
        borderRadius: 999,
        background: "#f8fafc",
        border: "1px solid #e7edf5",
        color: "#334155",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {label}
    </span>
  );
}

function StatusChip({
  status,
  label,
}: {
  status: {
    dot: string;
    text: string;
    bg: string;
    border: string;
  };
  label: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 10px",
        borderRadius: 999,
        background: status.bg,
        border: status.border,
        color: status.text,
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: status.dot,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}

function SoftEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e7edf5",
        borderRadius: 14,
        padding: 14,
        fontSize: 14,
        lineHeight: 1.75,
        color: "#64748b",
      }}
    >
      {children}
    </div>
  );
}

function CompactIncidentCard({
  accountName,
  type,
  severity,
  message,
  createdAt,
  windowEnd,
}: {
  accountName: string;
  type: string;
  severity: string;
  message: string;
  createdAt: Date;
  windowEnd: Date;
}) {
  const sev = severityMeta(severity);

  return (
    <div
      style={{
        borderRadius: 14,
        border: sev.border,
        background: sev.soft,
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          {accountName}
        </div>

        <StatusChip
          status={{
            dot: sev.dot,
            text: sev.text,
            bg: sev.bg,
            border: sev.border,
          }}
          label={sev.label}
        />
      </div>

      <div style={{ marginBottom: 6 }}>
        <Chip label={alertLabel(type)} />
      </div>

      <div
        style={{
          fontSize: 13,
          lineHeight: 1.6,
          color: "#0f172a",
          marginBottom: 6,
        }}
      >
        {message}
      </div>

      <div
        style={{
          fontSize: 11,
          color: "#64748b",
        }}
      >
        Active until <strong>{fmtDate(windowEnd)}</strong>
      </div>
    </div>
  );
}