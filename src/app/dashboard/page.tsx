import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import { DisconnectButton } from "./DisconnectButton";

/* ---------------- UI HELPERS ---------------- */

function alertLabel(type: string) {
  if (type === "revenue_drop") return "Revenue drop";
  if (type === "payment_failed") return "Payment failures";
  return type;
}

function severityBadge(severity: string) {
  if (severity === "critical") {
    return {
      label: "Critical",
      background: "#fee2e2",
      color: "#991b1b",
      border: "1px solid #fecaca",
    };
  }

  return {
    label: "Warning",
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fde68a",
  };
}

function systemStatus(activeCount: number) {
  return activeCount > 0
    ? {
        label: "Active alerts",
        background: "#fee2e2",
        color: "#991b1b",
        border: "1px solid #fecaca",
      }

    : {
        label: "All systems healthy",
        background: "#ecfdf5",
        color: "#065f46",
        border: "1px solid #a7f3d0",
      };
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleString();
}

function shortId(id?: string | null) {
  if (!id) return "Unknown";
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

function safeJsonPreview(input?: string | null) {
  if (!input) return null;
  try {
    const obj = JSON.parse(input);
    // Keep this short and calm: only show 2-3 key fields if present
    const keys = Object.keys(obj).slice(0, 3);
    const preview: Record<string, any> = {};
    for (const k of keys) preview[k] = obj[k];
    return JSON.stringify(preview);
  } catch {
    return null;
  }
}

/* ---------------- PAGE ---------------- */

export default async function DashboardPage() {
  const [alerts, stripeAccounts, lastEvents] = await Promise.all([
    prisma.alert.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.stripeAccount.findMany({
      orderBy: { createdAt: "desc" },
    }),
    prisma.stripeEvent.groupBy({
      by: ["stripeAccountId"],
      _max: { createdAt: true },
    }),
  ]);

  const lastEventByAccount = new Map(
    lastEvents.map((e) => [e.stripeAccountId, e._max.createdAt])
  );

  const now = new Date();
  const activeAlerts = alerts.filter((a) => a.windowEnd > now);
  const status = systemStatus(activeAlerts.length);



  const envLabel =
    process.env.NODE_ENV === "production" ? "Production" : "Development";

  return (

    <main
      style={{
        minHeight: "100vh",
        background: "#f9fafb",
        padding: "40px 16px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#111827",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* Top Card */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 650, margin: 0 }}>
                RevenueWatch
              </h1>
              <p style={{ color: "#6b7280", marginTop: 6, marginBottom: 0 }}>
           Stripe monitoring & alerting - Read-only - No money movement

              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Pill
                label={envLabel}
                background="#f3f4f6"
                color="#374151"
                border="1px solid #e5e7eb"
              />
              <Pill {...status} />
            </div>
          </div>

       <div
  style={{
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 18,
  }}
>
  <button
    type="button"
    disabled
    title="Stripe Connect OAuth is disabled until KVK + Stripe activation."
    style={{
      padding: "9px 12px",
      background: "#e5e7eb",
      color: "#6b7280",
      borderRadius: 8,
      border: "1px solid #e5e7eb",
      fontSize: 14,
      fontWeight: 600,
      cursor: "not-allowed",
    }}
  >
    Connect Stripe account (locked)
  </button>
</div>
</div>

        {/* Stats Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <StatCard
  label="Connected Stripe accounts"
  value={stripeAccounts.filter((a) => a.status === "active").length}
/>

<StatCard label="Alerts currently active" value={activeAlerts.length} />
<StatCard label="Alerts (last 50)" value={alerts.length} />



        </div>

        {/* Connected Accounts */}
        <Section title="Connected Stripe accounts" subtitle="Accounts RevenueWatch is monitoring.">
          {stripeAccounts.length === 0 ? (
            <Muted>
  No Stripe accounts connected yet. Connect an account to start monitoring
  for payment failures and revenue anomalies.
</Muted>

          ) : (
          <Table
 headers={[
  "Name",
  "Stripe account ID",
  "Status",
  "Last event",
  "Monitoring",
]}

rows={stripeAccounts.map((a) => [
  a.name ?? "Unnamed account",

  shortId(a.stripeAccountId),

  <span
    key={`${a.id}-status`}
    style={{
      fontSize: 12,
      fontWeight: 600,
      color: a.status === "active" ? "#065f46" : "#6b7280",
    }}
  >
    {a.status}
  </span>,

  lastEventByAccount.get(a.stripeAccountId)
    ? fmtDate(lastEventByAccount.get(a.stripeAccountId)!)
    : "No events yet",

  a.status === "active" ? (
    <DisconnectButton
      key={`${a.id}-disconnect`}
      stripeAccountId={a.stripeAccountId}
    />
  ) : (
    <span key={`${a.id}-disconnected`} style={{ color: "#6b7280", fontSize: 12 }}>
      Disconnected
    </span>
  ),
])}


/>

          )}
        </Section>

        {/* Active Alerts */}
        <Section
          title="Active alerts"
          subtitle="These alerts are still within their active window."
        >
          {activeAlerts.length === 0 ? (
            <Muted>No active alerts. RevenueWatch is monitoring normally.</Muted>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {activeAlerts.map((a) => (
                <AlertRow
                  key={a.id}
                  type={a.type}
                  severity={a.severity}
                  message={a.message}
                  stripeAccountId={a.stripeAccountId}
                  createdAt={a.createdAt}
                  windowEnd={a.windowEnd}
                  context={a.context}
                  isActive
                />
              ))}
            </div>
          )}
        </Section>

        {/* Alert History */}
        <Section
          title="Alert history"
          subtitle="Most recent alerts (including active ones)."
          subtle
        >
          {alerts.length === 0 ? (
            <Muted>No alerts yet.</Muted>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {alerts.map((a) => (
                <AlertRow
                  key={a.id}
                  type={a.type}
                  severity={a.severity}
                  message={a.message}
                  stripeAccountId={a.stripeAccountId}
                  createdAt={a.createdAt}
                  windowEnd={a.windowEnd}
                  context={a.context}
                />
              ))}
            </div>
          )}
        </Section>
      </div>
    </main>
  );
}

/* ---------------- SMALL COMPONENTS ---------------- */

function Pill({
  label,
  background,
  color,
  border,
}: {
  label: string;
  background: string;
  color: string;
  border: string;
}) {
  return (
    <span
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        background,
        color,
        border,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {label}
    </span>
  );
}

function Section({
  title,
  subtitle,
  children,
  subtle,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  subtle?: boolean;
}) {
  return (
    <section style={{ marginBottom: 26 }}>
      <div style={{ marginBottom: 10 }}>
        <h2
          style={{
            fontSize: subtle ? 16 : 18,
            fontWeight: subtle ? 600 : 700,
            color: subtle ? "#374151" : "#111827",
            margin: 0,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ color: "#6b7280", margin: "6px 0 0", fontSize: 13 }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 750, lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ color: "#6b7280", marginTop: 6, fontSize: 13 }}>
        {label}
      </div>
    </div>
  );
}


function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<React.ReactNode>>

}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            {headers.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "12px 12px",
                  borderBottom: "1px solid #e5e7eb",
                  color: "#374151",
                  fontWeight: 700,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
              {r.map((cell, i) => (
                <td key={i} style={{ padding: "12px 12px", color: "#111827" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlertRow({
  type,
  severity,
  message,
  stripeAccountId,
  createdAt,
  windowEnd,
  context,
  isActive,
}: {
  type: string;
  severity: string;
  message: string;
  stripeAccountId: string | null;
  createdAt: Date;
  windowEnd: Date;
  context?: string | null;
  isActive?: boolean;
}) {
  const sev = severityBadge(severity);
  const preview = safeJsonPreview(context);

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 14,
        opacity: isActive ? 1 : 0.96,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              padding: "3px 10px",
              borderRadius: 999,
              background: "#f3f4f6",
              color: "#111827",
              border: "1px solid #e5e7eb",
            }}
          >
            {alertLabel(type)}
          </span>

          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              padding: "3px 10px",
              borderRadius: 999,
              background: sev.background,
              color: sev.color,
              border: sev.border,
            }}
          >
            {sev.label}
          </span>

          <span style={{ fontSize: 12, color: "#6b7280" }}>
            Account: <strong style={{ color: "#111827" }}>{shortId(stripeAccountId)}</strong>
          </span>
        </div>

        <div style={{ fontSize: 12, color: "#6b7280" }}>
          Triggered: <strong style={{ color: "#111827" }}>{fmtDate(createdAt)}</strong>
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 650, marginBottom: 8 }}>
        {message}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "#6b7280" }}>
        <div>
          Active until: <strong style={{ color: "#111827" }}>{fmtDate(windowEnd)}</strong>
        </div>

     {preview && (
  <details style={{ marginTop: 6 }}>
    <summary
      style={{
        fontSize: 12,
        color: "#6b7280",
        cursor: "pointer",
      }}
    >
      View technical context
    </summary>
    <pre
      style={{
        marginTop: 6,
        fontSize: 12,
        background: "#f3f4f6",
        padding: 8,
        borderRadius: 8,
        overflowX: "auto",
        color: "#111827",
      }}
    >
      {preview}
    </pre>
  </details>
)}


      </div>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>{children}</p>;
}
