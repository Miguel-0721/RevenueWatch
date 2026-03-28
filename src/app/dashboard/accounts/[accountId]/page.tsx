import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import type { CSSProperties, ReactNode } from "react";

export const dynamic = "force-dynamic";


type AlertLike = {
  id?: string;
  type: string;
  severity?: string;
  message?: string;
  context?: string | null;
  createdAt?: Date;
  windowEnd?: Date;
  stripeAccountId?: string | null;
  accountName?: string;
};

/* ---------------- HELPERS ---------------- */



type BaselineGrid = {
  label: string;
  columns: string[];
  rows: Array<{
    day: string;
    values: number[];
    activeColumn?: number | null;
  }>;
  unit: "currency" | "count";
  currentLabel: string;
};

function fmtDate(d?: Date | null) {
  if (!d) return "No activity yet";
  return new Date(d).toLocaleString();
}

function formatMoneyAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
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
      bg: "#fff1f1",
      border: "1px solid #fecaca",
      dot: "#dc2626",
      soft: "#fff8f8",
      panel: "#fff6f6",
    };
  }

  return {
    label: "Warning",
    text: "#92400e",
    bg: "#fff8eb",
    border: "1px solid #fde68a",
    dot: "#d97706",
    soft: "#fffdf7",
    panel: "#fffdf5",
  };
}

function healthyMeta() {
  return {
    label: "Monitoring",
    text: "#166534",
    bg: "#effdf3",
    border: "1px solid #bbf7d0",
    dot: "#16a34a",
    soft: "#f8fff9",
    panel: "#f6fff7",
  };
}

function safeParseContext(input?: string | null) {
  if (!input) return null;

  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function buildReadableAlertMessage(alert: AlertLike) {
  const parsed = safeParseContext(alert.context);

if (!parsed) return alert.message ?? "Alert details unavailable.";

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
    return `Payment failures are ${ratio}× higher than normal (${parsed.failedPayments} vs ${parsed.baseline}) in the ${windowLabel}, suggesting multiple customers may be unable to complete payments.`;
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

  return alert.message ?? "Alert details unavailable.";
}

function buildMeaningText(alert: AlertLike) {
  const parsed = safeParseContext(alert.context);

  if (alert.type === "payment_failed") {
  if (
    parsed &&
    typeof parsed.failedPayments === "number" &&
    typeof parsed.baseline === "number"
  ) {
    if (alert.severity === "critical") {
      return `Failed payments are usually low for this account (around ${formatCount(
        parsed.baseline
      )} in this period), but ${formatCount(
        parsed.failedPayments
      )} were observed. This suggests multiple customers may be unable to complete payments, indicating a likely checkout or payment issue rather than normal fluctuation.`;
    }

    return `Failed payments are usually low for this account (around ${formatCount(
      parsed.baseline
    )} in this period), but ${formatCount(
      parsed.failedPayments
    )} were observed. This is above normal and may indicate an emerging issue affecting customers.`;
  }

    if (alert.severity === "critical") {
      return "Failed payments are well above the normal level for this account, which may point to a real checkout or payment issue.";
    }

    return "Failed payments are above the normal level for this account and should be reviewed.";
  }

  if (alert.type === "revenue_drop") {
    const currentRevenue =
      parsed && typeof parsed.currentRevenue === "number"
        ? parsed.currentRevenue
        : null;

    const expectedRevenue =
      parsed && typeof parsed.expectedRevenue === "number"
        ? parsed.expectedRevenue
        : null;

    if (
      currentRevenue !== null &&
      expectedRevenue !== null &&
      expectedRevenue > 0
    ) {
      const difference = expectedRevenue - currentRevenue;

      if (alert.severity === "critical") {
        return `This account would normally be expected to generate about ${formatMoneyAmount(
          expectedRevenue
        )} in this kind of period, but it has only generated ${formatMoneyAmount(
          currentRevenue
        )}. That puts it ${formatMoneyAmount(
          difference
        )} below normal, which is large enough to suggest a meaningful drop in performance.`;
      }

      return `This account would normally be expected to generate about ${formatMoneyAmount(
        expectedRevenue
      )} in this kind of period, but it has only generated ${formatMoneyAmount(
        currentRevenue
      )}. That puts it ${formatMoneyAmount(
        difference
      )} below normal.`;
    }

    if (alert.severity === "critical") {
      return "Revenue is meaningfully below the normal level for this account right now.";
    }

    return "Revenue is below the normal level for this account right now.";
  }

  return "This issue is outside the normal range for this account and should be reviewed.";
}
function buildTriggerReason(alert: AlertLike) {
  const parsed = safeParseContext(alert.context);
  if (!parsed) return [];
if (
  alert.type === "payment_failed" &&
  typeof parsed.failedPayments === "number" &&
  typeof parsed.baseline === "number"
) {
  const reasons = [
    `RevenueWatch expected only a small number of failed payments in this window (around ${formatCount(
      parsed.baseline
    )}).`,
    `It observed ${formatCount(
      parsed.failedPayments
    )} failed payments instead, significantly above the normal level.`,
  ];

  if (typeof parsed.window === "string") {
    reasons.push(`This was measured over the ${parsed.window}.`);
  }

  reasons.push(
    "This pattern typically indicates a broader checkout or payment issue rather than isolated customer errors."
  );

  reasons.push(
    alert.severity === "critical"
      ? "The increase was large enough to classify this issue as critical."
      : "The increase was large enough to classify this issue as a warning."
  );

  return reasons;
}




  if (
    alert.type === "revenue_drop" &&
    typeof parsed.currentRevenue === "number" &&
    typeof parsed.expectedRevenue === "number"
  ) {
    const shortfall = parsed.expectedRevenue - parsed.currentRevenue;

    const reasons = [
      `RevenueWatch expected about ${formatMoneyAmount(
        parsed.expectedRevenue
      )} for this kind of window.`,
      `It observed ${formatMoneyAmount(parsed.currentRevenue)} instead.`,
      `That created a shortfall of ${formatMoneyAmount(shortfall)}.`,
    ];

    if (typeof parsed.window === "string") {
      reasons.push(`This was measured over the ${parsed.window}.`);
    }

    reasons.push(
      alert.severity === "critical"
        ? "That gap was large enough to classify this issue as critical."
        : "That gap was large enough to classify this issue as a warning."
    );

    return reasons;
  }

  return [];
}

function buildBaselineGrid(accountId: string, alert: AlertLike) {
  const parsed = safeParseContext(alert.context);
  const defaults = getDemoMonitoringDefaults(accountId);

  const expectedRevenue =
    parsed && typeof parsed.expectedRevenue === "number"
      ? parsed.expectedRevenue
      : defaults.expectedRevenue;

  const currentRevenue =
    parsed && typeof parsed.currentRevenue === "number"
      ? parsed.currentRevenue
      : expectedRevenue;

  const activeRevenueColumn =
    parsed && typeof parsed.activeRevenueColumn === "number"
      ? parsed.activeRevenueColumn
      : defaults.activeRevenueColumn;

  const baseRows = [
    { day: "Sun", values: [1700, 2400, 2800, 1500] },
    { day: "Mon", values: [2400, 3900, 4200, 2100] },
    { day: "Tue", values: [2500, 4000, 4200, 2200] },
    { day: "Wed", values: [2300, 3800, 4100, 2050] },
    { day: "Thu", values: [2450, 3950, 4300, 2150] },
    { day: "Fri", values: [2600, 4200, 4600, 2300] },
    { day: "Sat", values: [1800, 2500, 2900, 1600] },
  ];

 const referenceDate =
  alert.createdAt ? new Date(alert.createdAt) : new Date();

  const dayIndex = referenceDate.getDay();
  const selectedBaseRow = baseRows[dayIndex];

  const values = [...selectedBaseRow.values];
  values[activeRevenueColumn] = expectedRevenue;

  const selectedRow = {
    day: selectedBaseRow.day,
    values,
    activeColumn: activeRevenueColumn,
  };

  return {
    label: `Typical revenue pattern for ${selectedRow.day}`,
    columns: [
      "Morning (6–12)",
      "Afternoon (12–18)",
      "Evening (18–22)",
      "Late night (22–6)",
    ],
    rows: [selectedRow],
    unit: "currency" as const,
   currentLabel: `Actual revenue in this window: ${formatMoneyAmount(currentRevenue)}`,
  };
}




function getActiveRevenueWindow(grid: BaselineGrid | null) {
  if (!grid) return null;

  for (const row of grid.rows) {
    if (typeof row.activeColumn === "number" && row.activeColumn >= 0) {
      return {
        day: row.day,
        columnLabel: grid.columns[row.activeColumn],
        expectedValue: row.values[row.activeColumn],
      };
    }
  }

  return null;
}



function formatGridValue(value: number, unit: BaselineGrid["unit"]) {
  return unit === "currency" ? formatMoneyAmount(value) : formatCount(value);
}

function buildStatusSummary(alert: AlertLike | null) {
  if (!alert) {
    return {
      title: "Everything looks normal for this account right now.",
      body:
        "RevenueWatch is monitoring this Stripe account in read-only mode and no active issues have been detected.",
      status: healthyMeta(),
    };
  }

  const severity = alert.severity ?? "warning";
  const sev = severityMeta(severity);

  return {
    title: buildReadableAlertMessage(alert),
    body: buildMeaningText({ ...alert, severity }),
    status: sev,
  };
}


function getDemoMonitoringDefaults(accountId: string) {
  const defaults: Record<
    string,
    {
      expectedRevenue: number;
      baselineFailures: number;
      activeRevenueColumn: number;
    }
  > = {
    acct_demo_northlane: {
      expectedRevenue: 3600,
      baselineFailures: 3,
      activeRevenueColumn: 2,
    },
    acct_demo_brightgrowth: {
      expectedRevenue: 1240,
      baselineFailures: 2,
      activeRevenueColumn: 2,
    },
    acct_demo_meridian: {
      expectedRevenue: 1600,
      baselineFailures: 2,
      activeRevenueColumn: 2,
    },
    acct_demo_atlas: {
      expectedRevenue: 4200,
      baselineFailures: 3,
      activeRevenueColumn: 2,
    },
    acct_demo_pixelharbor: {
      expectedRevenue: 980,
      baselineFailures: 2,
      activeRevenueColumn: 1,
    },
    acct_demo_bluepeak: {
      expectedRevenue: 2200,
      baselineFailures: 2,
      activeRevenueColumn: 2,
    },
    acct_demo_luma: {
      expectedRevenue: 2600,
      baselineFailures: 2,
      activeRevenueColumn: 2,
    },
    acct_demo_forge: {
      expectedRevenue: 2100,
      baselineFailures: 2,
      activeRevenueColumn: 1,
    },
    acct_demo_cedar: {
      expectedRevenue: 940,
      baselineFailures: 2,
      activeRevenueColumn: 2,
    },
    acct_demo_novaops: {
      expectedRevenue: 1800,
      baselineFailures: 2,
      activeRevenueColumn: 1,
    },
  };

  return (
    defaults[accountId] ?? {
      expectedRevenue: 2000,
      baselineFailures: 2,
      activeRevenueColumn: 2,
    }
  );
}

function buildFallbackRevenueAlert(accountId: string): AlertLike {
  const defaults = getDemoMonitoringDefaults(accountId);

  return {
    type: "revenue_drop",
    severity: "warning",
    message: "Revenue is within the normal range for this account.",
    context: JSON.stringify({
      expectedRevenue: defaults.expectedRevenue,
      currentRevenue: defaults.expectedRevenue,
      window: "last 2 hours",
      activeRevenueColumn: defaults.activeRevenueColumn,
    }),
  };
}




/* ---------------- UI ---------------- */

function PageShell({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f6f8fb 0%, #f3f6fa 50%, #f7f9fc 100%)",
        color: "#0f172a",
      }}
    >
      <Navbar />
      {children}
    </main>
  );
}

function StatusPill({
  meta,
}: {
  meta: {
    label: string;
    text: string;
    bg: string;
    border: string;
    dot: string;
  };
}) {
  return <StatusChip status={meta} label={meta.label} />;
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

function Surface({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section
      style={{
        background: "rgba(255,255,255,0.92)",
        border: "1px solid #e6ecf5",
        borderRadius: 28,
        padding: 22,
        boxShadow: "0 18px 50px rgba(15,23,42,0.05)",
        backdropFilter: "blur(8px)",
        ...style,
      }}
    >
      {children}
    </section>
  );
}

function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      {eyebrow ? (
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#94a3b8",
            marginBottom: 8,
          }}
        >
          {eyebrow}
        </div>
      ) : null}

      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          lineHeight: 1.08,
          letterSpacing: "-0.04em",
          color: "#0f172a",
          marginBottom: subtitle ? 8 : 0,
        }}
      >
        {title}
      </div>

      {subtitle ? (
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.8,
            color: "#64748b",
            maxWidth: 860,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

function MicroStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "good" | "attention";
}) {
  const tones = {
    neutral: {
      background: "#f8fafc",
      border: "1px solid #e7edf5",
    },
    good: {
      background: "#f7fff8",
      border: "1px solid #d9f7de",
    },
    attention: {
      background: "#fff8f8",
      border: "1px solid #fee2e2",
    },
  } as const;

  return (
    <div
      style={{
        background: tones[tone].background,
        border: tones[tone].border,
        borderRadius: 18,
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#64748b",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 800,
          color: "#0f172a",
          lineHeight: 1.35,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function BaselineGridCard({
  grid,
}: {
  grid: BaselineGrid;
}) {
  return (
    <Surface style={{ padding: 18 }}>
      <div
        style={{
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#94a3b8",
              marginBottom: 8,
            }}
          >
            Full day pattern
          </div>

          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              color: "#0f172a",
              marginBottom: 8,
            }}
          >
            Typical revenue pattern today
          </div>

          <div
            style={{
              fontSize: 14,
              lineHeight: 1.8,
              color: "#475569",
              maxWidth: 900,
            }}
          >
            This is supporting context. The highlighted cell shows the time
            window RevenueWatch used for this alert.
          </div>
        </div>

        <div
          style={{
            border: "1px solid #e7edf5",
            borderRadius: 22,
            overflow: "hidden",
            background: "#ffffff",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `120px repeat(${grid.columns.length}, minmax(0, 1fr))`,
              background: "#f8fafc",
              borderBottom: "1px solid #e7edf5",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                fontSize: 12,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#64748b",
              }}
            >
              Day
            </div>

            {grid.columns.map((column) => (
              <div
                key={column}
                style={{
                  padding: "14px 16px",
                  fontSize: 12,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#64748b",
                  borderLeft: "1px solid #eef2f7",
                }}
              >
                {column}
              </div>
            ))}
          </div>

          {grid.rows.map((row, rowIndex) => (
            <div
              key={row.day}
              style={{
                display: "grid",
                gridTemplateColumns: `120px repeat(${grid.columns.length}, minmax(0, 1fr))`,
                borderBottom:
                  rowIndex === grid.rows.length - 1 ? "none" : "1px solid #eef2f7",
              }}
            >
              <div
                style={{
                  padding: "16px",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#0f172a",
                  background: "#fbfcfe",
                }}
              >
                {row.day}
              </div>

              {row.values.map((value, valueIndex) => {
                const isActive = row.activeColumn === valueIndex;
                const threshold = Math.round(value * 0.7);

                return (
                  <div
                    key={`${row.day}-${valueIndex}`}
                    style={{
                      padding: "14px 16px",
                      borderLeft: "1px solid #eef2f7",
                      background: isActive ? "#fff8f8" : "#ffffff",
                      outline: isActive ? "2px solid #fca5a5" : "none",
                      outlineOffset: isActive ? "-2px" : undefined,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#0f172a",
                        marginBottom: 4,
                      }}
                    >
                      {formatGridValue(value, grid.unit)}
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color: isActive ? "#991b1b" : "#64748b",
                        fontWeight: isActive ? 700 : 500,
                        marginBottom: 4,
                      }}
                    >
                      {isActive ? "Expected right now" : "Typical"}
                    </div>

                    {isActive ? (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          lineHeight: 1.5,
                        }}
                      >
                        Alert if below {formatMoneyAmount(threshold)}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div
          style={{
            fontSize: 14,
            lineHeight: 1.8,
            color: "#475569",
            maxWidth: 920,
          }}
        >
          <strong style={{ color: "#0f172a" }}>{grid.currentLabel}</strong>
        </div>
      </div>
    </Surface>
  );
}

function ReasonStack({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e7edf5",
        borderRadius: 18,
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#64748b",
          marginBottom: 10,
        }}
      >
        {title}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {items.map((item, index) => (
          <div
            key={index}
            style={{
              display: "grid",
              gridTemplateColumns: "10px minmax(0, 1fr)",
              gap: 10,
              alignItems: "start",
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: "#94a3b8",
                marginTop: 8,
              }}
            />
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.75,
                color: "#475569",
              }}
            >
              {item}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


function ActiveWindowCard({
  label,
  expectedValue,
  actualValue,
}: {
  label: string;
  expectedValue: number;
  actualValue: number;
}) {
  const alertThreshold = Math.round(expectedValue * 0.7);
  const isBelowThreshold = actualValue < alertThreshold;

  return (
    <Surface style={{ padding: 20 }}>
      <div style={{ display: "grid", gap: 16 }}>
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#94a3b8",
              marginBottom: 8,
            }}
          >
            Expected right now
          </div>

          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              color: "#0f172a",
              marginBottom: 8,
            }}
          >
            {label}
          </div>

          <div
            style={{
              fontSize: 14,
              lineHeight: 1.8,
              color: "#475569",
              maxWidth: 860,
            }}
          >
            This is the time window RevenueWatch used as the closest baseline for this alert.
          </div>
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
              background: "#f8fafc",
              border: "1px solid #e7edf5",
              borderRadius: 18,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
              Typical revenue
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: "#0f172a",
                lineHeight: 1.15,
              }}
            >
              {formatMoneyAmount(expectedValue)}
            </div>
          </div>

          <div
            style={{
              background: "#fffaf0",
              border: "1px solid #fde68a",
              borderRadius: 18,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 12, color: "#92400e", marginBottom: 6 }}>
              Alert if below
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: "#92400e",
                lineHeight: 1.15,
              }}
            >
              {formatMoneyAmount(alertThreshold)}
            </div>
          </div>

          <div
            style={{
              background: isBelowThreshold ? "#fff1f1" : "#f7fff8",
              border: isBelowThreshold
                ? "1px solid #fecaca"
                : "1px solid #bbf7d0",
              borderRadius: 18,
              padding: 16,
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: isBelowThreshold ? "#991b1b" : "#166534",
                marginBottom: 6,
              }}
            >
              Actual seen
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: isBelowThreshold ? "#991b1b" : "#166534",
                lineHeight: 1.15,
              }}
            >
              {formatMoneyAmount(actualValue)}
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: 14,
            lineHeight: 1.85,
            color: "#475569",
          }}
        >
          RevenueWatch expected around{" "}
          <strong style={{ color: "#0f172a" }}>
            {formatMoneyAmount(expectedValue)}
          </strong>{" "}
          for this time window. Alerts begin below{" "}
          <strong style={{ color: "#0f172a" }}>
            {formatMoneyAmount(alertThreshold)}
          </strong>
          . Current revenue is{" "}
          <strong style={{ color: "#0f172a" }}>
            {formatMoneyAmount(actualValue)}
          </strong>
          .
        </div>
      </div>
    </Surface>
  );
}


function PaymentFailureCard({
  failedPayments,
  baseline,
  windowLabel,
}: {
  failedPayments: number;
  baseline: number;
  windowLabel: string;
}) {
  const ratio =
    baseline > 0 ? (failedPayments / baseline).toFixed(1) : null;

  return (
    <Surface style={{ padding: 20 }}>
      <div style={{ display: "grid", gap: 16 }}>
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#94a3b8",
              marginBottom: 8,
            }}
          >
            Payment failures right now
          </div>

          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              color: "#0f172a",
              marginBottom: 8,
            }}
          >
            Higher than normal in the {windowLabel}
          </div>

          <div
            style={{
              fontSize: 14,
              lineHeight: 1.8,
              color: "#475569",
              maxWidth: 860,
            }}
          >
            RevenueWatch compares recent failed payment volume against the normal
            level for this account.
          </div>
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
              background: "#f8fafc",
              border: "1px solid #e7edf5",
              borderRadius: 18,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
              Normal failures
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: "#0f172a",
                lineHeight: 1.15,
              }}
            >
              {formatCount(baseline)}
            </div>
          </div>

          <div
            style={{
              background: "#fffaf0",
              border: "1px solid #fde68a",
              borderRadius: 18,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 12, color: "#92400e", marginBottom: 6 }}>
              Failure spike
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: "#92400e",
                lineHeight: 1.15,
              }}
            >
              {ratio ? `${ratio}×` : "High"}
            </div>
          </div>

          <div
            style={{
              background: "#fff1f1",
              border: "1px solid #fecaca",
              borderRadius: 18,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 12, color: "#991b1b", marginBottom: 6 }}>
              Failed payments seen
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: "#991b1b",
                lineHeight: 1.15,
              }}
            >
              {formatCount(failedPayments)}
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: 14,
            lineHeight: 1.85,
            color: "#475569",
          }}
        >
          RevenueWatch normally expects around{" "}
          <strong style={{ color: "#0f172a" }}>
            {formatCount(baseline)}
          </strong>{" "}
          failed payments in the {windowLabel}, but it observed{" "}
          <strong style={{ color: "#0f172a" }}>
            {formatCount(failedPayments)}
          </strong>
          . This suggests multiple customers may be unable to complete payment.
        </div>
      </div>
    </Surface>
  );
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




export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;

  const realStripeAccount = await prisma.stripeAccount.findFirst({
    where: { stripeAccountId: accountId },
  });

  const realAlerts = await prisma.alert.findMany({
    where: { stripeAccountId: accountId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const realLastEvent = await prisma.stripeEvent.findFirst({
    where: { stripeAccountId: accountId },
    orderBy: { createdAt: "desc" },
  });

  const demoStripeAccount =
   demoStripeAccounts.find(
  (account: (typeof demoStripeAccounts)[number]) =>
    account.stripeAccountId === accountId
)??
    null;

  const isDemo = !realStripeAccount && !!demoStripeAccount;
  const stripeAccount = realStripeAccount ?? demoStripeAccount;

  const alerts = isDemo
    ? demoAlerts
        .filter(
  (alert: (typeof demoAlerts)[number]) => alert.stripeAccountId === accountId
)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
    : realAlerts;

  const lastEvent = isDemo
    ? (() => {
        const createdAt = demoLastEventByAccount.get(accountId);
        return createdAt ? { createdAt } : null;
      })()
    : realLastEvent;

  const now = isDemo ? DEMO_NOW : new Date();

  const name = stripeAccount?.name ?? accountId;
  const activeAlerts = alerts.filter((a) => a.windowEnd > now);
  const historicalAlerts = alerts.filter((a) => a.windowEnd <= now);
  const topAlert = activeAlerts[0] ?? null;

  const hero = buildStatusSummary(
    topAlert as
      | { type: string; severity: string; context?: string | null; message: string }
      | null
  );

  const baselineGrid = topAlert ? buildBaselineGrid(accountId, topAlert) : null;

  const triggerReasons = topAlert ? buildTriggerReason(topAlert) : [];

 

 
const activeRevenueWindow = getActiveRevenueWindow(baselineGrid);

const parsedTopAlert = safeParseContext(topAlert?.context);
const actualRevenueValue =
  parsedTopAlert && typeof parsedTopAlert.currentRevenue === "number"
    ? parsedTopAlert.currentRevenue
    : null;

const paymentFailureData =
  parsedTopAlert &&
  typeof parsedTopAlert.failedPayments === "number" &&
  typeof parsedTopAlert.baseline === "number"
    ? {
        failedPayments: parsedTopAlert.failedPayments,
        baseline: parsedTopAlert.baseline,
        windowLabel:
          typeof parsedTopAlert.window === "string"
            ? parsedTopAlert.window
            : "recent window",
      }
    : null;
  return (
    <PageShell>
      <div
        style={{
          maxWidth: 1160,
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

        <Surface>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.35fr) minmax(280px, 0.65fr)",
              gap: 18,
              alignItems: "start",
            }}
          >
            <div style={{ display: "grid", gap: 18 }}>
              <SectionTitle
                eyebrow="Incident overview"
                title={name}
                subtitle={accountId}
              />

              <div
                style={{
                  borderRadius: 24,
                  border: hero.status.border,
                  background: hero.status.soft,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 800,
                      lineHeight: 1.2,
                      letterSpacing: "-0.03em",
                      color: "#0f172a",
                      maxWidth: 760,
                    }}
                  >
                    {hero.title}
                  </div>

                  <StatusPill meta={hero.status} />
                </div>

                <div
                  style={{
                    fontSize: 15,
                    lineHeight: 1.85,
                    color: "#475569",
                    maxWidth: 900,
                  }}
                >
                  {hero.body}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
              }}
            >
              <MicroStat
                label="Current state"
                value={hero.status.label}
                tone={topAlert ? "attention" : "good"}
              />
              <MicroStat
                label="Last activity"
                value={fmtDate(lastEvent?.createdAt)}
              />
              <MicroStat
                label="Active issues"
                value={activeAlerts.length}
                tone={topAlert ? "attention" : "good"}
              />
            </div>
          </div>
        </Surface>

        {topAlert ? (
          <>

<Surface>
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) 220px",
      gap: 18,
      alignItems: "start",
    }}
  >
    <div style={{ display: "grid", gap: 16 }}>
      <SectionTitle
        eyebrow="Current issue"
        title={alertLabel(topAlert.type)}
      />

      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          lineHeight: 1.65,
          color: "#0f172a",
        }}
      >
        {buildReadableAlertMessage(topAlert)}
      </div>

      {triggerReasons.length > 0 ? (
        <ReasonStack
          title="How RevenueWatch reached this alert"
          items={triggerReasons}
        />
      ) : null}

      <div
        style={{
          fontSize: 13,
          lineHeight: 1.8,
          color: "#64748b",
        }}
      >
        Triggered{" "}
        <strong style={{ color: "#0f172a" }}>
          {fmtDate(topAlert.createdAt)}
        </strong>{" "}
        · Active until{" "}
        <strong style={{ color: "#0f172a" }}>
          {fmtDate(topAlert.windowEnd)}
        </strong>
      </div>
    </div>

    <div style={{ display: "grid", gap: 12 }}>
      <MicroStat
  label="Measured over"
  value={
    parsedTopAlert && typeof parsedTopAlert.window === "string"
      ? parsedTopAlert.window
      : "Current window"
  }
/>
    </div>
  </div>
</Surface>

      {topAlert?.type === "revenue_drop" && baselineGrid ? (
  <div style={{ display: "grid", gap: 18 }}>
    {activeRevenueWindow && actualRevenueValue !== null ? (
      <ActiveWindowCard
        label={`${activeRevenueWindow.day} · ${activeRevenueWindow.columnLabel}`}
        expectedValue={activeRevenueWindow.expectedValue}
        actualValue={actualRevenueValue}
      />
    ) : null}

    <BaselineGridCard grid={baselineGrid} />
  </div>
) : null}

{topAlert?.type === "payment_failed" && paymentFailureData ? (
  <PaymentFailureCard
    failedPayments={paymentFailureData.failedPayments}
    baseline={paymentFailureData.baseline}
    windowLabel={paymentFailureData.windowLabel}
  />
) : null}
          </>
        ) : null}




             {!topAlert ? (
  <Surface>
    <SectionTitle
      eyebrow="Monitoring"
      title="This account is being monitored normally"
      subtitle="RevenueWatch is checking revenue patterns and payment-failure levels in read-only mode."
    />

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 14,
      }}
    >
      <MicroStat
        label="Revenue monitoring"
        value="Active"
        tone="good"
      />
      <MicroStat
        label="Payment failure monitoring"
        value="Active"
        tone="good"
      />
      <MicroStat
        label="Current state"
        value="No active alerts"
        tone="good"
      />
    </div>
  </Surface>
) : null}


        <Surface>
        <SectionTitle
  eyebrow="Past alerts"
  title="Previous incidents"
/>

          {historicalAlerts.length === 0 ? (
            <div
              style={{
                border: "1px dashed #dbe4ef",
                borderRadius: 20,
                padding: 18,
                background: "#fbfcfe",
                color: "#64748b",
                fontSize: 15,
              }}
            >
              No past alerts for this account yet.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {historicalAlerts.map((alert: (typeof historicalAlerts)[number]) => {
                const sev = severityMeta(alert.severity);

                return (
                  <div
                    key={alert.id}
                    style={{
                      borderRadius: 18,
                      border: "1px solid #edf2f7",
                      background: "#fbfcfe",
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                        marginBottom: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 17,
                          fontWeight: 800,
                          color: "#0f172a",
                        }}
                      >
                        {alertLabel(alert.type)}
                      </div>

                      <StatusChip status={sev} label={sev.label} />
                    </div>

                    <div
                      style={{
                        color: "#334155",
                        lineHeight: 1.75,
                        marginBottom: 10,
                        fontSize: 14,
                      }}
                    >
                      {buildReadableAlertMessage(alert)}
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color: "#64748b",
                        lineHeight: 1.75,
                      }}
                    >
                      Triggered {fmtDate(alert.createdAt)} · Ended{" "}
                      {fmtDate(alert.windowEnd)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Surface>


      </div>
    </PageShell>
  );
}