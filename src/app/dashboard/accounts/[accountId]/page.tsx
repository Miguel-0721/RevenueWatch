import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";

export const dynamic = "force-dynamic";

function fmtDate(d?: Date | null) {
  if (!d) return "No activity yet";
  return new Date(d).toLocaleString();
}

function alertLabel(type: string) {
  if (type === "revenue_drop") return "Revenue drop";
  if (type === "payment_failed") return "Payment failures";
  return type;
}

function severityMeta(severity: string) {
  if (severity === "critical") {
    return {
      label: "Critical",
      text: "#991b1b",
      bg: "#fef2f2",
      border: "1px solid #fecaca",
      dot: "#dc2626",
    };
  }

  return {
    label: "Warning",
    text: "#92400e",
    bg: "#fffbeb",
    border: "1px solid #fde68a",
    dot: "#d97706",
  };
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

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;

  const stripeAccount = await prisma.stripeAccount.findFirst({
    where: { stripeAccountId: accountId },
  });

  const alerts = await prisma.alert.findMany({
    where: { stripeAccountId: accountId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const lastEvent = await prisma.stripeEvent.findFirst({
    where: { stripeAccountId: accountId },
    orderBy: { createdAt: "desc" },
  });

  const name = stripeAccount?.name ?? accountId;
  const activeAlerts = alerts.filter((a) => a.windowEnd > new Date());
  const historicalAlerts = alerts.filter((a) => a.windowEnd <= new Date());

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
          maxWidth: 1100,
          margin: "0 auto",
          padding: "104px 20px 72px",
          display: "grid",
          gap: 18,
        }}
      >
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            width: "fit-content",
            padding: "10px 14px",
            borderRadius: 999,
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            color: "#0f172a",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          ← Back to dashboard
        </Link>

        <Panel>
          <PanelHeader
            title={name}
            subtitle="Account-level monitoring view. This page is read-only."
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e7edf5",
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                Account ID
              </div>
              <div style={{ fontWeight: 700 }}>{accountId}</div>
            </div>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e7edf5",
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                Last activity
              </div>
              <div style={{ fontWeight: 700 }}>{fmtDate(lastEvent?.createdAt)}</div>
            </div>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e7edf5",
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                Active issues
              </div>
              <div style={{ fontWeight: 700 }}>{activeAlerts.length}</div>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Current issues"
            subtitle="Issues still active for this account."
          />

          {activeAlerts.length === 0 ? (
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e7edf5",
                borderRadius: 14,
                padding: 14,
                color: "#64748b",
              }}
            >
              No active issues right now.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {activeAlerts.map((alert) => {
                const sev = severityMeta(alert.severity);

                return (
                  <div
                    key={alert.id}
                    style={{
                      borderRadius: 16,
                      border: sev.border,
                      background: "#ffffff",
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{alertLabel(alert.type)}</div>
                      <StatusChip status={sev} label={sev.label} />
                    </div>

                    <div style={{ color: "#334155", lineHeight: 1.7, marginBottom: 8 }}>
                      {alert.message}
                    </div>

                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      Triggered {fmtDate(alert.createdAt)} · Active until {fmtDate(alert.windowEnd)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Alert history"
            subtitle="Recent resolved and past alerts for this account."
          />

          {historicalAlerts.length === 0 ? (
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e7edf5",
                borderRadius: 14,
                padding: 14,
                color: "#64748b",
              }}
            >
              No historical alerts yet.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {historicalAlerts.map((alert) => {
                const sev = severityMeta(alert.severity);

                return (
                  <div
                    key={alert.id}
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
                        alignItems: "flex-start",
                        gap: 12,
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{alertLabel(alert.type)}</div>
                      <StatusChip status={sev} label={sev.label} />
                    </div>

                    <div style={{ color: "#334155", lineHeight: 1.7, marginBottom: 8 }}>
                      {alert.message}
                    </div>

                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      Triggered {fmtDate(alert.createdAt)} · Ended {fmtDate(alert.windowEnd)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </main>
  );
}