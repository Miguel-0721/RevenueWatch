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
  dropThreshold?: number;
};

type RevenueChartPoint = {
  hour: number;
  expected: number;
  actual: number;
};

type RevenueChartModel = {
  points: RevenueChartPoint[];
  expectedValue: number;
  actualValue: number;
  thresholdValue: number;
  dropThreshold: number;
  activeHour: number;
  baselineLabel: string;
  windowLabel: string;
  isAlerting: boolean;
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

function formatContextMoney(parsed: Record<string, unknown> | null, value: number) {
  const amount = parsed?.amountUnit === "cents" ? value / 100 : value;
  return formatMoneyAmount(amount);
}

function getRevenueColumnFromHour(hourOfDay: number) {
  if (hourOfDay >= 6 && hourOfDay < 12) return 0;
  if (hourOfDay >= 12 && hourOfDay < 18) return 1;
  if (hourOfDay >= 18 && hourOfDay < 22) return 2;
  return 3;
}

function getRevenueContext(alert: AlertLike) {
  const parsed = safeParseContext(alert.context) as Record<string, unknown> | null;
  if (!parsed) return null;

  const baselineAmount =
    typeof parsed.baselineAmount === "number"
      ? parsed.baselineAmount
      : typeof parsed.expectedRevenue === "number"
        ? parsed.expectedRevenue
        : null;

  const currentAmount =
    typeof parsed.currentAmount === "number"
      ? parsed.currentAmount
      : typeof parsed.currentRevenue === "number"
        ? parsed.currentRevenue
        : null;

  if (baselineAmount === null || currentAmount === null || baselineAmount <= 0) {
    return null;
  }

  const currentWindowMinutes =
    typeof parsed.currentWindowMinutes === "number"
      ? parsed.currentWindowMinutes
      : null;

  return {
    parsed,
    baselineAmount,
    currentAmount,
    dropRatio:
      typeof parsed.dropRatio === "number"
        ? parsed.dropRatio
        : (baselineAmount - currentAmount) / baselineAmount,
    threshold:
      typeof parsed.threshold === "number"
        ? parsed.threshold
        : 0.5,
    alertThresholdAmount:
      typeof parsed.alertThresholdAmount === "number"
        ? parsed.alertThresholdAmount
        : Math.round(baselineAmount * 0.5),
    baselineLabel:
      typeof parsed.baselineLabel === "string"
        ? parsed.baselineLabel
        : "matched historical windows",
    baselineSampleCount:
      typeof parsed.baselineSampleCount === "number"
        ? parsed.baselineSampleCount
        : null,
    windowLabel:
      currentWindowMinutes !== null
        ? `last ${currentWindowMinutes} minutes`
        : typeof parsed.window === "string"
          ? parsed.window
          : "current window",
    activeRevenueColumn:
      typeof parsed.activeRevenueColumn === "number"
        ? parsed.activeRevenueColumn
        : null,
    hourOfDay:
      typeof parsed.hourOfDay === "number"
        ? parsed.hourOfDay
        : null,
  };
}

function getPaymentFailureContext(alert: AlertLike) {
  const parsed = safeParseContext(alert.context) as Record<string, unknown> | null;
  if (!parsed) return null;

  const failures =
    typeof parsed.failuresCounted === "number"
      ? parsed.failuresCounted
      : typeof parsed.failedPayments === "number"
        ? parsed.failedPayments
        : null;

  if (failures === null) return null;

  const failureWindowMinutes =
    typeof parsed.failureWindowMinutes === "number"
      ? parsed.failureWindowMinutes
      : null;

  return {
    failures,
    threshold:
      typeof parsed.failureThreshold === "number"
        ? parsed.failureThreshold
        : 5,
    windowLabel:
      failureWindowMinutes !== null
        ? `last ${failureWindowMinutes} minutes`
        : typeof parsed.window === "string"
          ? parsed.window
          : "recent window",
  };
}

function buildReadableAlertMessage(alert: AlertLike) {
  const parsed = safeParseContext(alert.context);

if (!parsed) return alert.message ?? "Alert details unavailable.";

 const paymentContext = getPaymentFailureContext(alert);
 if (alert.type === "payment_failed" && paymentContext) {
  return `${formatCount(paymentContext.failures)} failed payments were detected in the ${paymentContext.windowLabel}, reaching the alert threshold of ${formatCount(paymentContext.threshold)}.`;
}

  const revenueContext = getRevenueContext(alert);
  if (alert.type === "revenue_drop" && revenueContext) {
    const dropPercent = Math.round(revenueContext.dropRatio * 100);

    return `Revenue is down ${dropPercent}% vs expected (${formatMoneyAmount(
      revenueContext.parsed.amountUnit === "cents"
        ? revenueContext.currentAmount / 100
        : revenueContext.currentAmount
    )} vs ${formatMoneyAmount(
      revenueContext.parsed.amountUnit === "cents"
        ? revenueContext.baselineAmount / 100
        : revenueContext.baselineAmount
    )}) in the ${revenueContext.windowLabel}.`;
  }

  return alert.message ?? "Alert details unavailable.";
}

function buildMeaningText(alert: AlertLike) {
  if (alert.type === "payment_failed") {
  const paymentContext = getPaymentFailureContext(alert);
  if (paymentContext) {
    if (alert.severity === "critical") {
      return `${formatCount(paymentContext.failures)} failed payments were observed in the ${paymentContext.windowLabel}. RevenueWatch uses a fixed spike threshold for payment failures, so this indicates a likely checkout or payment issue rather than a normal baseline comparison.`;
    }

    return `${formatCount(paymentContext.failures)} failed payments were observed in the ${paymentContext.windowLabel}. This reached the fixed alert threshold and should be reviewed.`;
  }

    if (alert.severity === "critical") {
      return "Failed payments are well above the normal level for this account, which may point to a real checkout or payment issue.";
    }

    return "Failed payments are above the normal level for this account and should be reviewed.";
  }

  if (alert.type === "revenue_drop") {
    const revenueContext = getRevenueContext(alert);

    if (revenueContext) {
      const difference = revenueContext.baselineAmount - revenueContext.currentAmount;
      if (alert.severity === "critical") {
        return `This account would normally be expected to generate about ${formatMoneyAmount(
          revenueContext.parsed.amountUnit === "cents"
            ? revenueContext.baselineAmount / 100
            : revenueContext.baselineAmount
        )} in this kind of period, but it has only generated ${formatMoneyAmount(
          revenueContext.parsed.amountUnit === "cents"
            ? revenueContext.currentAmount / 100
            : revenueContext.currentAmount
        )}. That puts it ${formatMoneyAmount(
          revenueContext.parsed.amountUnit === "cents" ? difference / 100 : difference
        )} below normal. The baseline used ${revenueContext.baselineLabel}.`;
      }

      return `This account would normally be expected to generate about ${formatMoneyAmount(
        revenueContext.parsed.amountUnit === "cents"
          ? revenueContext.baselineAmount / 100
          : revenueContext.baselineAmount
      )} in this kind of period, but it has only generated ${formatMoneyAmount(
        revenueContext.parsed.amountUnit === "cents"
          ? revenueContext.currentAmount / 100
          : revenueContext.currentAmount
      )}. That puts it ${formatMoneyAmount(
        revenueContext.parsed.amountUnit === "cents" ? difference / 100 : difference
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
  const parsed = safeParseContext(alert.context) as Record<string, unknown> | null;
  if (!parsed) return [];
const paymentContext = getPaymentFailureContext(alert);
if (alert.type === "payment_failed" && paymentContext) {
  const reasons = [
    `It observed ${formatCount(
      paymentContext.failures
    )} failed payments in the ${paymentContext.windowLabel}.`,
    `The configured alert threshold is ${formatCount(
      paymentContext.threshold
    )} failed payments.`,
  ];

  reasons.push(
    "Payment failure alerts use a fixed spike threshold, not a historical baseline, because failures are rare and inconsistent."
  );

  reasons.push(
    alert.severity === "critical"
      ? "The increase was large enough to classify this issue as critical."
      : "The increase was large enough to classify this issue as a warning."
  );

  return reasons;
}




  const revenueContext = getRevenueContext(alert);
  if (alert.type === "revenue_drop" && revenueContext) {
    const shortfall = revenueContext.baselineAmount - revenueContext.currentAmount;

    const reasons = [
      `RevenueWatch compared this account against ${revenueContext.baselineLabel}.`,
      `It expected about ${formatContextMoney(
        revenueContext.parsed,
        revenueContext.baselineAmount
      )} for the ${revenueContext.windowLabel}.`,
      `It observed ${formatContextMoney(
        revenueContext.parsed,
        revenueContext.currentAmount
      )} instead.`,
      `That created a shortfall of ${formatContextMoney(revenueContext.parsed, shortfall)}.`,
    ];

    if (revenueContext.baselineSampleCount !== null) {
      reasons.push(
        `The selected baseline used ${formatCount(
          revenueContext.baselineSampleCount
        )} historical matching windows.`
      );
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
  const revenueContext = getRevenueContext(alert);
  const defaults = getDemoMonitoringDefaults(accountId);

  const expectedRevenue =
    revenueContext
      ? revenueContext.parsed.amountUnit === "cents"
        ? revenueContext.baselineAmount / 100
        : revenueContext.baselineAmount
      : parsed && typeof parsed.expectedRevenue === "number"
        ? parsed.expectedRevenue
      : defaults.expectedRevenue;

  const currentRevenue =
    revenueContext
      ? revenueContext.parsed.amountUnit === "cents"
        ? revenueContext.currentAmount / 100
        : revenueContext.currentAmount
      : parsed && typeof parsed.currentRevenue === "number"
        ? parsed.currentRevenue
        : expectedRevenue;

  const activeRevenueColumn =
    revenueContext?.hourOfDay !== null && revenueContext?.hourOfDay !== undefined
      ? getRevenueColumnFromHour(revenueContext.hourOfDay)
      : revenueContext?.activeRevenueColumn !== null && revenueContext?.activeRevenueColumn !== undefined
      ? revenueContext.activeRevenueColumn
      : parsed && typeof parsed.activeRevenueColumn === "number"
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

  const dayIndex = referenceDate.getUTCDay();
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
    dropThreshold: revenueContext?.threshold,
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

function buildRevenueMonitorModel(
  accountId: string,
  alert: AlertLike | null,
  now: Date
): RevenueChartModel {
  const revenueContext =
    alert?.type === "revenue_drop" ? getRevenueContext(alert) : null;
  const defaults = getDemoMonitoringDefaults(accountId);
  const amountIsCents = revenueContext?.parsed.amountUnit === "cents";

  const expectedValue = revenueContext
    ? amountIsCents
      ? revenueContext.baselineAmount / 100
      : revenueContext.baselineAmount
    : defaults.expectedRevenue;

  const actualValue = revenueContext
    ? amountIsCents
      ? revenueContext.currentAmount / 100
      : revenueContext.currentAmount
    : Math.round(expectedValue * 0.94);

  const dropThreshold = revenueContext?.threshold ?? 0.5;
  const thresholdValue = Math.round(expectedValue * (1 - dropThreshold));
  const activeHour = revenueContext?.hourOfDay ?? now.getUTCHours();

  const points = Array.from({ length: 24 }, (_, hour) => {
    const wave = 0.9 + Math.sin((hour / 24) * Math.PI * 2 - 0.7) * 0.12;
    const businessLift = hour >= 8 && hour <= 20 ? 1.08 : 0.78;
    const expected = Math.round(expectedValue * wave * businessLift);
    const distance = Math.min(Math.abs(hour - activeHour), 24 - Math.abs(hour - activeHour));
    const alertDip = revenueContext && distance <= 1;
    const actual = alertDip
      ? Math.round(actualValue * (distance === 0 ? 1 : 1.08))
      : Math.round(expected * (0.9 + ((hour % 5) * 0.035)));

    return {
      hour,
      expected,
      actual,
    };
  });

  points[activeHour] = {
    hour: activeHour,
    expected: expectedValue,
    actual: actualValue,
  };

  return {
    points,
    expectedValue,
    actualValue,
    thresholdValue,
    dropThreshold,
    activeHour,
    baselineLabel: revenueContext?.baselineLabel ?? "same day and same hour",
    windowLabel: revenueContext?.windowLabel ?? "current hour",
    isAlerting: actualValue < thresholdValue,
  };
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
    acct_sample_northstar: {
      expectedRevenue: 8200,
      baselineFailures: 3,
      activeRevenueColumn: 1,
    },
    acct_sample_brightgrowth: {
      expectedRevenue: 1240,
      baselineFailures: 2,
      activeRevenueColumn: 2,
    },
    acct_sample_meridian: {
      expectedRevenue: 3100,
      baselineFailures: 2,
      activeRevenueColumn: 2,
    },
    acct_sample_atlas: {
      expectedRevenue: 4200,
      baselineFailures: 3,
      activeRevenueColumn: 2,
    },
    acct_sample_pixel: {
      expectedRevenue: 980,
      baselineFailures: 2,
      activeRevenueColumn: 1,
    },
    acct_sample_bluepeak: {
      expectedRevenue: 2200,
      baselineFailures: 2,
      activeRevenueColumn: 2,
    },
    acct_sample_luma: {
      expectedRevenue: 2600,
      baselineFailures: 2,
      activeRevenueColumn: 2,
    },
    acct_sample_forge: {
      expectedRevenue: 2100,
      baselineFailures: 2,
      activeRevenueColumn: 1,
    },
    acct_sample_cedar: {
      expectedRevenue: 940,
      baselineFailures: 2,
      activeRevenueColumn: 2,
    },
    acct_sample_nova: {
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

function RevenueMonitorCard({ model }: { model: RevenueChartModel }) {
  const width = 760;
  const height = 300;
  const padding = { top: 24, right: 24, bottom: 38, left: 52 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const values = model.points.flatMap((point) => [point.expected, point.actual]);
  const maxValue = Math.max(...values, model.thresholdValue) * 1.18;
  const minValue = 0;

  const x = (hour: number) => padding.left + (hour / 23) * chartWidth;
  const y = (value: number) =>
    padding.top +
    chartHeight -
    ((value - minValue) / (maxValue - minValue)) * chartHeight;

  const buildPath = (key: "expected" | "actual") =>
    model.points
      .map((point, index) => {
        const command = index === 0 ? "M" : "L";
        return `${command} ${x(point.hour).toFixed(1)} ${y(point[key]).toFixed(1)}`;
      })
      .join(" ");

  const actualPath = buildPath("actual");
  const expectedPath = buildPath("expected");
  const thresholdY = y(model.thresholdValue);
  const activePoint = model.points[model.activeHour];

  return (
    <Surface style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.35fr) minmax(260px, 0.65fr)",
          gap: 0,
        }}
      >
        <div style={{ padding: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "flex-start",
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <SectionTitle
              eyebrow="Revenue monitor"
              title="Current day vs expected baseline"
              subtitle={`RevenueWatch compares this account against ${model.baselineLabel}. This is not a forecast; it is the historical pattern used for monitoring.`}
            />

            <StatusChip
              status={model.isAlerting ? severityMeta("critical") : healthyMeta()}
              label={model.isAlerting ? "Below threshold" : "Within range"}
            />
          </div>

          <div
            style={{
              border: "1px solid #e7edf5",
              borderRadius: 24,
              background:
                "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
              overflow: "hidden",
            }}
          >
            <svg
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label="Revenue monitor chart showing actual revenue, expected baseline, and alert threshold"
              style={{ display: "block", width: "100%", height: "auto" }}
            >
              {[0.25, 0.5, 0.75].map((ratio) => {
                const gridY = padding.top + chartHeight * ratio;
                return (
                  <line
                    key={ratio}
                    x1={padding.left}
                    x2={width - padding.right}
                    y1={gridY}
                    y2={gridY}
                    stroke="#e7edf5"
                    strokeWidth="1"
                  />
                );
              })}

              {[0, 6, 12, 18, 23].map((hour) => (
                <g key={hour}>
                  <line
                    x1={x(hour)}
                    x2={x(hour)}
                    y1={padding.top}
                    y2={padding.top + chartHeight}
                    stroke="#eef2f7"
                    strokeWidth="1"
                  />
                  <text
                    x={x(hour)}
                    y={height - 14}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="12"
                    fontWeight="700"
                  >
                    {hour === 23 ? "23:00" : `${hour}:00`}
                  </text>
                </g>
              ))}

              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={thresholdY}
                y2={thresholdY}
                stroke="#b91c1c"
                strokeWidth="2"
                strokeDasharray="8 8"
              />
              <text
                x={width - padding.right}
                y={thresholdY - 8}
                textAnchor="end"
                fill="#991b1b"
                fontSize="12"
                fontWeight="800"
              >
                Alert threshold
              </text>

              <path
                d={expectedPath}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="3"
                strokeDasharray="7 7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <path
                d={`${actualPath} L ${x(23).toFixed(1)} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`}
                fill="url(#actualFill)"
                opacity="0.72"
              />

              <path
                d={actualPath}
                fill="none"
                stroke="#0067d9"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <circle
                cx={x(activePoint.hour)}
                cy={y(activePoint.actual)}
                r="7"
                fill={model.isAlerting ? "#dc2626" : "#0067d9"}
                stroke="#ffffff"
                strokeWidth="3"
              />

              <defs>
                <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0067d9" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#0067d9" stopOpacity="0.03" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              marginTop: 14,
              color: "#475569",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <span>Blue line: actual revenue</span>
            <span>Dashed gray: expected baseline</span>
            <span>Dashed red: alert threshold</span>
          </div>
        </div>

        <div
          style={{
            borderLeft: "1px solid #e7edf5",
            background: "#fbfcfe",
            padding: 22,
            display: "grid",
            alignContent: "start",
            gap: 12,
          }}
        >
          <MicroStat
            label="Expected in window"
            value={formatMoneyAmount(model.expectedValue)}
          />
          <MicroStat
            label="Alert if below"
            value={formatMoneyAmount(model.thresholdValue)}
            tone={model.isAlerting ? "attention" : "neutral"}
          />
          <MicroStat
            label="Actual observed"
            value={formatMoneyAmount(model.actualValue)}
            tone={model.isAlerting ? "attention" : "good"}
          />
          <MicroStat
            label="Measured over"
            value={model.windowLabel}
          />
        </div>
      </div>
    </Surface>
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
            Supporting pattern
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
            This is illustrative supporting context, not a full reconstruction
            of every historical payment. The highlighted cell shows the time
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
                const threshold = Math.round(value * (1 - (grid.dropThreshold ?? 0.5)));

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
  dropThreshold = 0.5,
}: {
  label: string;
  expectedValue: number;
  actualValue: number;
  dropThreshold?: number;
}) {
  const alertThreshold = Math.round(expectedValue * (1 - dropThreshold));
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
  threshold,
  windowLabel,
}: {
  failedPayments: number;
  threshold: number;
  windowLabel: string;
}) {
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
            Threshold reached in the {windowLabel}
          </div>

          <div
            style={{
              fontSize: 14,
              lineHeight: 1.8,
              color: "#475569",
              maxWidth: 860,
            }}
          >
            RevenueWatch counts failed payments in a short window and triggers only
            when the fixed spike threshold is reached.
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
              Alert threshold
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: "#0f172a",
                lineHeight: 1.15,
              }}
            >
              {formatCount(threshold)}
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
              Threshold result
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: "#92400e",
                lineHeight: 1.15,
              }}
            >
              Reached
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
          RevenueWatch triggers this alert when failed payments reach{" "}
          <strong style={{ color: "#0f172a" }}>
            {formatCount(threshold)}
          </strong>{" "}
          in the {windowLabel}. It observed{" "}
          <strong style={{ color: "#0f172a" }}>
            {formatCount(failedPayments)}
          </strong>
          , which suggests multiple customers may be unable to complete payment.
        </div>
      </div>
    </Surface>
  );
}

function AlertListCard({
  eyebrow,
  title,
  emptyText,
  alerts,
  now,
}: {
  eyebrow: string;
  title: string;
  emptyText: string;
  alerts: AlertLike[];
  now: Date;
}) {
  return (
    <Surface>
      <SectionTitle eyebrow={eyebrow} title={title} />

      {alerts.length === 0 ? (
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
          {emptyText}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {alerts.map((alert) => {
            const sev = severityMeta(alert.severity ?? "warning");

            return (
              <div
                key={alert.id ?? `${alert.type}-${alert.createdAt?.toISOString()}`}
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
                  Triggered {fmtDate(alert.createdAt)} ·{" "}
                  {alert.windowEnd && alert.windowEnd > now
                    ? `Active until ${fmtDate(alert.windowEnd)}`
                    : `Ended ${fmtDate(alert.windowEnd)}`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Surface>
  );
}



/* ---------------- DEMO DATA ---------------- */

const DEMO_NOW = new Date("2026-03-24T10:30:00Z");

const demoStripeAccounts = [
  {
    id: "sample-1",
    name: "Atlas Commerce",
    stripeAccountId: "acct_sample_atlas",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "sample-2",
    name: "Northstar Digital",
    stripeAccountId: "acct_sample_northstar",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "sample-3",
    name: "BluePeak Subscriptions",
    stripeAccountId: "acct_sample_bluepeak",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "sample-4",
    name: "Meridian Market",
    stripeAccountId: "acct_sample_meridian",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "sample-5",
    name: "Luma Health Co",
    stripeAccountId: "acct_sample_luma",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "sample-6",
    name: "Forge Analytics",
    stripeAccountId: "acct_sample_forge",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "sample-7",
    name: "Cedar Creative",
    stripeAccountId: "acct_sample_cedar",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "sample-8",
    name: "Pixel Harbor",
    stripeAccountId: "acct_sample_pixel",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "sample-9",
    name: "BrightGrowth Studio",
    stripeAccountId: "acct_sample_brightgrowth",
    status: "active",
    createdAt: DEMO_NOW,
  },
  {
    id: "sample-10",
    name: "Nova Ops",
    stripeAccountId: "acct_sample_nova",
    status: "active",
    createdAt: DEMO_NOW,
  },
];

const demoLastEventByAccount = new Map<string, Date>([
  ["acct_sample_atlas", new Date("2026-03-24T10:26:00Z")],
  ["acct_sample_northstar", new Date("2026-03-24T10:19:00Z")],
  ["acct_sample_bluepeak", new Date("2026-03-24T10:12:00Z")],
  ["acct_sample_meridian", new Date("2026-03-24T10:03:00Z")],
  ["acct_sample_luma", new Date("2026-03-24T09:57:00Z")],
  ["acct_sample_forge", new Date("2026-03-24T09:49:00Z")],
  ["acct_sample_cedar", new Date("2026-03-24T09:42:00Z")],
  ["acct_sample_pixel", new Date("2026-03-24T09:34:00Z")],
  ["acct_sample_brightgrowth", new Date("2026-03-24T09:27:00Z")],
  ["acct_sample_nova", new Date("2026-03-24T09:12:00Z")],
]);

const demoAlerts = [
  {
    id: "sample-alert-1",
    type: "payment_failed",
    severity: "critical",
    message: "Payment failures spiked above normal levels in the last 30 minutes.",
    stripeAccountId: "acct_sample_atlas",
    accountName: "Atlas Commerce",
    createdAt: new Date("2026-03-24T09:52:00Z"),
    windowEnd: new Date("2026-03-24T13:52:00Z"),
    context: JSON.stringify({
      failuresCounted: 18,
      failureThreshold: 5,
      failureWindowMinutes: 30,
    }),
  },
  {
    id: "sample-alert-2",
    type: "revenue_drop",
    severity: "critical",
    message: "Revenue is significantly below expected levels for this account.",
    stripeAccountId: "acct_sample_northstar",
    accountName: "Northstar Digital",
    createdAt: new Date("2026-03-24T09:16:00Z"),
    windowEnd: new Date("2026-03-24T13:16:00Z"),
    context: JSON.stringify({
      baselineAmount: 8200,
      currentAmount: 4920,
      currentWindowMinutes: 60,
      threshold: 0.5,
      baselineLabel: "same day and same hour",
      baselineSampleCount: 6,
      hourOfDay: 9,
    }),
  },
  {
    id: "sample-alert-3",
    type: "payment_failed",
    severity: "warning",
    message: "Payment failures increased for this account and should be reviewed.",
    stripeAccountId: "acct_sample_bluepeak",
    accountName: "BluePeak Subscriptions",
    createdAt: new Date("2026-03-24T08:24:00Z"),
    windowEnd: new Date("2026-03-24T11:24:00Z"),
    context: JSON.stringify({
      failuresCounted: 9,
      failureThreshold: 5,
      failureWindowMinutes: 30,
    }),
  },
  {
    id: "sample-alert-4",
    type: "revenue_drop",
    severity: "warning",
    message: "Revenue dipped below normal weekday levels during the current monitoring window.",
    stripeAccountId: "acct_sample_meridian",
    accountName: "Meridian Market",
    createdAt: new Date("2026-03-24T07:46:00Z"),
    windowEnd: new Date("2026-03-24T10:46:00Z"),
    context: JSON.stringify({
      baselineAmount: 3100,
      currentAmount: 2418,
      currentWindowMinutes: 60,
      threshold: 0.5,
      baselineLabel: "same day and same hour",
      baselineSampleCount: 5,
      hourOfDay: 7,
    }),
  },
  {
    id: "sample-history-1",
    type: "payment_failed",
    severity: "warning",
    message: "A temporary payment failure increase returned to normal.",
    stripeAccountId: "acct_sample_luma",
    accountName: "Luma Health Co",
    createdAt: new Date("2026-03-23T09:30:00Z"),
    windowEnd: new Date("2026-03-23T12:30:00Z"),
    context: JSON.stringify({
      failuresCounted: 7,
      failureThreshold: 5,
      failureWindowMinutes: 30,
    }),
  },
  {
    id: "sample-history-2",
    type: "revenue_drop",
    severity: "warning",
    message: "A short revenue dip recovered within the same business day.",
    stripeAccountId: "acct_sample_forge",
    accountName: "Forge Analytics",
    createdAt: new Date("2026-03-22T09:10:00Z"),
    windowEnd: new Date("2026-03-22T12:10:00Z"),
    context: JSON.stringify({
      baselineAmount: 2600,
      currentAmount: 1980,
      currentWindowMinutes: 60,
      threshold: 0.5,
      baselineLabel: "same day and same hour",
      baselineSampleCount: 5,
      hourOfDay: 9,
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

  const demoStripeAccount =
   demoStripeAccounts.find(
  (account: (typeof demoStripeAccounts)[number]) =>
    account.stripeAccountId === accountId
)??
    null;

  const [realStripeAccount, realAlerts, realLastEvent] = demoStripeAccount
    ? [null, [], null]
    : await Promise.all([
        prisma.stripeAccount.findFirst({
          where: { stripeAccountId: accountId },
        }),
        prisma.alert.findMany({
          where: { stripeAccountId: accountId },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma.stripeEvent.findFirst({
          where: { stripeAccountId: accountId },
          orderBy: { createdAt: "desc" },
        }),
      ]);

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
  const revenueMonitorModel = buildRevenueMonitorModel(accountId, topAlert, now);

  const hero = buildStatusSummary(
    topAlert as
      | { type: string; severity: string; context?: string | null; message: string }
      | null
  );

  const baselineGrid = topAlert ? buildBaselineGrid(accountId, topAlert) : null;

  const triggerReasons = topAlert ? buildTriggerReason(topAlert) : [];

 

 
const activeRevenueWindow = getActiveRevenueWindow(baselineGrid);

const revenueTopContext = topAlert ? getRevenueContext(topAlert) : null;
const actualRevenueValue =
  revenueTopContext
    ? revenueTopContext.parsed.amountUnit === "cents"
      ? revenueTopContext.currentAmount / 100
      : revenueTopContext.currentAmount
    : null;

const paymentFailureData = topAlert ? getPaymentFailureContext(topAlert) : null;
const measuredWindowLabel =
  revenueTopContext?.windowLabel ??
  paymentFailureData?.windowLabel ??
  "Current window";
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

        <RevenueMonitorCard model={revenueMonitorModel} />

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
  value={measuredWindowLabel}
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
        dropThreshold={baselineGrid.dropThreshold}
      />
    ) : null}

    <BaselineGridCard grid={baselineGrid} />
  </div>
) : null}

{topAlert?.type === "payment_failed" && paymentFailureData ? (
  <PaymentFailureCard
    failedPayments={paymentFailureData.failures}
    threshold={paymentFailureData.threshold}
    windowLabel={paymentFailureData.windowLabel}
  />
) : null}
          </>
        ) : null}

        <AlertListCard
          eyebrow="Active alerts"
          title="Open issues for this account"
          emptyText="No active alerts for this account right now."
          alerts={activeAlerts}
          now={now}
        />



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


        <AlertListCard
          eyebrow="Recent history"
          title="Previous incidents"
          emptyText="No past alerts for this account yet."
          alerts={historicalAlerts}
          now={now}
        />


      </div>
    </PageShell>
  );
}
