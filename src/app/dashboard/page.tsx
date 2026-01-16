

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";



function alertLabel(type: string) {
  if (type === "revenue_drop") return "Revenue Drop";
  if (type === "payment_failed") return "Payment Failures";
  return type;
}

function badgeStyle(type: string) {
  if (type === "revenue_drop") {
    return {
      background: "#fff3cd",
      color: "#856404",
      padding: "2px 6px",
      borderRadius: 4,
      fontSize: 12,
      marginRight: 8,
    };
  }

  if (type === "payment_failed") {
    return {
      background: "#f8d7da",
      color: "#721c24",
      padding: "2px 6px",
      borderRadius: 4,
      fontSize: 12,
      marginRight: 8,
    };
  }

  return {
    background: "#e2e3e5",
    color: "#383d41",
    padding: "2px 6px",
    borderRadius: 4,
    fontSize: 12,
    marginRight: 8,
  };
}

function systemStatus(activeAlertsCount: number) {
  if (activeAlertsCount > 0) {
    return {
      label: "Attention Required",
      color: "#721c24",
      background: "#f8d7da",
    };
  }

  return {
    label: "All Systems Healthy",
    color: "#155724",
    background: "#d4edda",
  };
}



export default async function DashboardPage() {
 const alerts = await prisma.alert.findMany({
  orderBy: { createdAt: "desc" },
  take: 50,
});

const stripeAccounts = await prisma.stripeAccount.findMany({
  orderBy: { createdAt: "desc" },
});


const lastEvent = await prisma.stripeEvent.findFirst({
  orderBy: { createdAt: "desc" },
});
const activeAlerts = alerts
  .filter((a: typeof alerts[number]) => a.windowEnd > new Date())
  .sort(
    (a: typeof alerts[number], b: typeof alerts[number]) =>
      a.windowEnd.getTime() - b.windowEnd.getTime()
  );




const status = systemStatus(activeAlerts.length);




return (
  <main style={{ padding: 24 }}>
    <h1 style={{ fontSize: 24, marginBottom: 8 }}>
      RevenueWatch Dashboard
    </h1>


<a
  href="/api/stripe/connect"
  style={{
    display: "inline-block",
    marginBottom: 16,
    padding: "8px 12px",
    background: "#635bff",
    color: "#fff",
    borderRadius: 6,
    textDecoration: "none",
    fontSize: 14,
  }}
>
  Connect Stripe Account
</a>




    <div
      style={{
        display: "inline-block",
        background: status.background,
        color: status.color,
        padding: "6px 10px",
        borderRadius: 6,
        fontSize: 14,
        marginBottom: 12,
      }}
    >
      {status.label}
    </div>

    <p style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>
      Last Stripe event:{" "}
      {lastEvent
        ? new Date(lastEvent.createdAt).toLocaleString()
        : "No events received yet"}
    </p>

<div
  style={{
    display: "flex",
    gap: 24,
    marginBottom: 32,
    fontSize: 14,
  }}
>
  <div>
    <strong>{stripeAccounts.length}</strong>
    <div>Stripe Accounts</div>
  </div>

  <div>
    <strong>{activeAlerts.length}</strong>
    <div>Active Alerts</div>
  </div>

  <div>
    <strong>{alerts.length}</strong>
    <div>Total Alerts</div>
  </div>
</div>


{/* Connected Stripe Accounts */}
<section style={{ marginBottom: 32 }}>
  <h2 style={{ fontSize: 18, marginBottom: 8 }}>
    Connected Stripe Accounts
  </h2>

  {stripeAccounts.length === 0 ? (
    <p>No Stripe accounts connected yet.</p>
  ) : (
    <ul>
 {stripeAccounts.map((account: typeof stripeAccounts[number]) => (


        <li key={account.id} style={{ marginBottom: 8 }}>
          <strong>
            {account.name ?? "Unnamed Account"}
          </strong>
          <br />
          <small>
            Account ID: {account.stripeAccountId}
          </small>
        </li>
      ))}
    </ul>
  )}
</section>



      {/* Active Alerts */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>
          Active Alerts
        </h2>

        {activeAlerts.length === 0 ? (
          <p>No active alerts 🎉</p>
        ) : (
          <ul>
 {alerts.map((alert: typeof alerts[number]) => (


          <li key={alert.id} style={{ marginBottom: 12 }}>
  <div>
    <span style={badgeStyle(alert.type)}>
      {alertLabel(alert.type)}
    </span>
    <strong>{alert.message}</strong>
  </div>
  <small>
    Active until{" "}
    {new Date(alert.windowEnd).toLocaleString()}
  </small>
</li>

            ))}
          </ul>
        )}
      </section>

      {/* Alert History */}
      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>
          Alert History
        </h2>

        {alerts.length === 0 ? (
          <p>No alerts yet.</p>
        ) : (
          <ul>
     {alerts.map((alert: typeof alerts[number]) => (


         <li key={alert.id} style={{ marginBottom: 12 }}>
  <div>
    <span style={badgeStyle(alert.type)}>
      {alertLabel(alert.type)}
    </span>
    <strong>{alert.message}</strong>
  </div>
  <small>
    Triggered{" "}
    {new Date(alert.createdAt).toLocaleString()}
  </small>
</li>

            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

