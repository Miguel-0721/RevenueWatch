import { prisma } from "@/lib/prisma";

export default async function AlertsPage() {
  const alerts = await prisma.alert.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <main style={{ padding: "24px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>
        Alerts
      </h1>

      {alerts.length === 0 && (
        <p style={{ color: "#666" }}>No alerts yet.</p>
      )}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {alerts.map((alert) => (
          <li
            key={alert.id}
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 8,
              padding: 16,
              marginBottom: 12,
            }}
          >
          <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 8,
    alignItems: "center",
  }}
>
  <strong>
    {alert.type.replace("_", " ").toUpperCase()}
    {alert.stripeAccountId && (
      <span style={{ color: "#999", fontWeight: 400, marginLeft: 8 }}>
        — {alert.stripeAccountId}
      </span>
    )}
  </strong>

  <span
    style={{
      color: alert.severity === "critical" ? "#c0392b" : "#f39c12",
      fontWeight: 600,
    }}
  >
    {alert.severity.toUpperCase()}
  </span>
</div>


            <p style={{ marginBottom: 8 }}>{alert.message}</p>

            <small style={{ color: "#777" }}>
              {new Date(alert.createdAt).toLocaleString()}
            </small>
          </li>
        ))}
      </ul>
    </main>
  );
}
