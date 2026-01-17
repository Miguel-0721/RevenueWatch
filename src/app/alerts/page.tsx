import { prisma } from "@/lib/prisma";

export default async function AlertsPage() {
  const alerts = await prisma.alert.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <main style={{ padding: "24px", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: "20px", marginBottom: "16px" }}>
        Alerts
      </h1>

      {alerts.length === 0 && (
        <p>No alerts yet.</p>
      )}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {alerts.map((alert) => (
      <li
  key={alert.id}
  style={{
    borderLeft:
  alert.severity === "critical"
    ? "4px solid #dc2626" // red
    : alert.severity === "warning"
    ? "4px solid #d97706" // amber
    : "4px solid #999",
    borderTop: "1px solid #ddd",
    borderRight: "1px solid #ddd",
    borderBottom: "1px solid #ddd",
    borderRadius: "6px",
    padding: "12px",
    marginBottom: "12px",
  }}
>

            <div style={{ fontWeight: 600 }}>
              {alert.type.replace("_", " ").toUpperCase()}
            </div>

            <div style={{ marginTop: "4px" }}>
              {alert.message}
            </div>

            <div
              style={{
                marginTop: "6px",
                fontSize: "12px",
                color: "#666",
              }}
            >
              {new Date(alert.createdAt).toLocaleString()} ·{" "}
              {alert.stripeAccountId}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
