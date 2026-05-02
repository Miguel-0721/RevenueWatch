import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getDemoAccountById, getDemoAlertHistory } from "@/lib/demoData";
import { prisma } from "@/lib/prisma";
import styles from "./page.module.css";

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
  accountName?: string | null;
  detectedLabel?: string;
  displayTimestamp?: string;
};

type RevenueContext = {
  parsed: Record<string, unknown>;
  baselineAmount: number;
  currentAmount: number;
  dropRatio: number;
  threshold: number;
  alertThresholdAmount: number;
  baselineLabel: string;
  windowLabel: string;
};

type PaymentFailureContext = {
  failures: number;
  normalFailures: number | null;
  threshold: number;
  windowLabel: string;
};

type ChartPoint = {
  index: number;
  label: string;
  expected: number;
  actual: number;
};

type RevenueChartModel = {
  points: ChartPoint[];
  expectedValue: number;
  actualValue: number;
  thresholdValue: number;
  peakValue: number;
  lowValue: number;
  activeIndex: number;
  windowLabel: string;
  isAlerting: boolean;
};

type FailureChartPoint = {
  index: number;
  label: string;
  failures: number;
};

type FailureChartModel = {
  points: FailureChartPoint[];
  failures: number;
  normalFailures: number | null;
  threshold: number;
  windowLabel: string;
  peakFailures: number;
  activeIndex: number;
  windowStartLabel: string;
  windowEndLabel: string;
};

function safeParseContext(input?: string | null) {
  if (!input) return null;

  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    return null;
  }
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

function fmtDate(d?: Date | null) {
  if (!d) return "No activity yet";
  return new Date(d).toLocaleString();
}

function fmtUtcHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function buildTickIndexes(length: number) {
  if (length <= 1) return [0];

  if (length <= 6) {
    return Array.from({ length }, (_, index) => index);
  }

  const candidates = [
    0,
    Math.floor((length - 1) / 3),
    Math.floor(((length - 1) * 2) / 3),
    length - 1,
  ];
  return [...new Set(candidates)];
}

function alertLabel(type: string) {
  if (type === "revenue_drop") return "Revenue drop detected";
  if (type === "payment_failed") return "Payment failure spike";
  return type.replace(/_/g, " ");
}

function getSeverityLabel(severity?: string) {
  if (severity === "critical") return "Critical";
  return "Warning";
}

function getRevenueContext(alert?: AlertLike | null): RevenueContext | null {
  if (!alert || alert.type !== "revenue_drop") return null;

  const parsed = safeParseContext(alert.context);
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
        : typeof parsed.alertThresholdAmount === "number"
          ? 1 - parsed.alertThresholdAmount / baselineAmount
          : 0.5,
    alertThresholdAmount:
      typeof parsed.alertThresholdAmount === "number"
        ? parsed.alertThresholdAmount
        : Math.round(baselineAmount * 0.5),
    baselineLabel:
      typeof parsed.baselineLabel === "string" ? parsed.baselineLabel : "recent performance",
    windowLabel:
      typeof parsed.window === "string" ? parsed.window : "current monitoring window",
  };
}

function getPaymentFailureContext(alert?: AlertLike | null): PaymentFailureContext | null {
  if (!alert || alert.type !== "payment_failed") return null;

  const parsed = safeParseContext(alert.context);
  if (!parsed) return null;

  const failures =
    typeof parsed.failuresCounted === "number"
      ? parsed.failuresCounted
      : typeof parsed.failedPayments === "number"
        ? parsed.failedPayments
        : null;

  if (failures === null) return null;

  return {
    failures,
    normalFailures:
      typeof parsed.normalFailures === "number"
        ? parsed.normalFailures
        : typeof parsed.baseline === "number"
          ? parsed.baseline
          : null,
    threshold:
      typeof parsed.failureThreshold === "number" ? parsed.failureThreshold : 5,
    windowLabel:
      typeof parsed.window === "string" ? parsed.window : "current monitoring window",
  };
}

function buildReadableAlertMessage(alert: AlertLike) {
  const parsed = safeParseContext(alert.context);
  if (parsed && typeof parsed.displayMessage === "string") {
    return parsed.displayMessage;
  }

  const revenueContext = getRevenueContext(alert);
  if (revenueContext) {
    const dropPercent = Math.round(revenueContext.dropRatio * 100);
    return `Sales are ${dropPercent}% lower than usual for this window.`;
  }

  const paymentContext = getPaymentFailureContext(alert);
  if (paymentContext) {
    return alert.message ?? "Payment failures are significantly higher than usual compared to recent activity.";
  }

  return alert.message ?? "Alert details unavailable.";
}

function buildRevenueChartModel(accountId: string, topAlert: AlertLike | null, now: Date): RevenueChartModel {
  const parsed = safeParseContext(topAlert?.context);
  const revenueContext = getRevenueContext(topAlert);
  const defaultExpected = 2400;
  const expectedValue = revenueContext?.baselineAmount ?? defaultExpected;
  const actualValue = revenueContext?.currentAmount ?? Math.round(defaultExpected * 0.94);
  const thresholdValue = revenueContext?.alertThresholdAmount ?? Math.round(expectedValue * 0.5);
  const revenueSeries = Array.isArray(parsed?.revenueSeries)
    ? parsed.revenueSeries
        .filter(
          (point): point is { time: string; revenue: number } =>
            typeof point === "object" &&
            point !== null &&
            typeof (point as { time?: unknown }).time === "string" &&
            typeof (point as { revenue?: unknown }).revenue === "number"
        )
    : null;

  if (revenueSeries && revenueSeries.length > 0) {
    const points = revenueSeries.map((point, index) => ({
      index,
      label: point.time,
      expected: expectedValue,
      actual: point.revenue,
    }));
    const actualValues = points.map((point) => point.actual);
    const latestValue = actualValues[actualValues.length - 1] ?? actualValue;

    return {
      points,
      expectedValue,
      actualValue: latestValue,
      thresholdValue,
      peakValue: Math.max(...actualValues),
      lowValue: Math.min(...actualValues),
      activeIndex: points.length - 1,
      windowLabel: revenueContext?.windowLabel ?? "current monitoring window",
      isAlerting: latestValue < thresholdValue,
    };
  }

  const activeHour = now.getUTCHours();
  const points = Array.from({ length: 24 }, (_, hour) => {
    const dayCurve = 0.86 + Math.sin((hour / 24) * Math.PI * 2 - 0.5) * 0.16;
    const workdayLift = hour >= 8 && hour <= 21 ? 1.1 : 0.74;
    const expected = Math.round(expectedValue * dayCurve * workdayLift);
    const actual = hour === activeHour ? actualValue : Math.round(expected * (0.92 + (hour % 5) * 0.03));

    return {
      index: hour,
      label: fmtUtcHour(hour),
      expected,
      actual,
    };
  });

  return {
    points,
    expectedValue,
    actualValue,
    thresholdValue,
    peakValue: Math.max(...points.map((point) => point.actual)),
    lowValue: Math.min(...points.map((point) => point.actual)),
    activeIndex: activeHour,
    windowLabel: revenueContext?.windowLabel ?? "current monitoring window",
    isAlerting: actualValue < thresholdValue,
  };
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    }

    const previous = points[index - 1];
    const controlX = (previous.x + point.x) / 2;

    return `${path} C${controlX.toFixed(1)},${previous.y.toFixed(1)} ${controlX.toFixed(1)},${point.y.toFixed(1)} ${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }, "");
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
}

function buildMoneyTicks(maxValue: number) {
  const rawTicks = [0, maxValue * 0.33, maxValue * 0.66, maxValue];

  return rawTicks.map((value) => {
    if (value === 0) return 0;
    const rounded = Math.ceil(value / 500) * 500;
    return Math.max(500, rounded);
  });
}

function buildFailureChartModel(topAlert: AlertLike | null, paymentContext: PaymentFailureContext | null): FailureChartModel {
  const parsed = safeParseContext(topAlert?.context);
  const failures = paymentContext?.failures ?? 0;
  const threshold = paymentContext?.threshold ?? 5;
  const failureSeries = Array.isArray(parsed?.failureSeries)
    ? parsed.failureSeries
        .filter(
          (point): point is { time: string; failures: number } =>
            typeof point === "object" &&
            point !== null &&
            typeof (point as { time?: unknown }).time === "string" &&
            typeof (point as { failures?: unknown }).failures === "number"
        )
    : null;

  if (failureSeries && failureSeries.length > 0) {
    const points = failureSeries.map((point, index) => ({
      index,
      label: point.time,
      failures: point.failures,
    }));

    return {
      points,
      failures,
      normalFailures: paymentContext?.normalFailures ?? null,
      threshold,
      windowLabel: paymentContext?.windowLabel ?? "current monitoring window",
      peakFailures: Math.max(...points.map((point) => point.failures)),
      activeIndex: points.length - 1,
      windowStartLabel: points[0].label,
      windowEndLabel: points[points.length - 1].label,
    };
  }

  const points = Array.from({ length: 12 }, (_, index) => ({
    index,
    label: index === 0 ? "Start" : index === 11 ? "Now" : "",
    failures: index === 11 ? failures : Math.max(0, Math.round(failures * (index / 16))),
  }));

  return {
    points,
    failures,
    normalFailures: paymentContext?.normalFailures ?? null,
    threshold,
    windowLabel: paymentContext?.windowLabel ?? "current monitoring window",
    peakFailures: Math.max(...points.map((point) => point.failures)),
    activeIndex: points.length - 1,
    windowStartLabel: points[0].label,
    windowEndLabel: points[points.length - 1].label,
  };
}

function FailureChart({ model }: { model: FailureChartModel }) {
  const maxValue = Math.max(model.peakFailures, model.threshold) * 1.25;

  return (
    <>
      <div className={styles.failureChartWrap}>
        <div
          className={styles.failureThresholdLine}
          style={{
            bottom: `${Math.min(86, Math.max(12, (model.threshold / maxValue) * 100))}%`,
          }}
        />
        <div className={styles.failureThreshold}>Threshold: {formatCount(model.threshold)}</div>

        <div className={styles.failureBars} aria-label="Failed payments over the current window">
          {model.points.map((point) => {
            const isActive = point.index === model.activeIndex;
            const height = Math.max(8, (point.failures / maxValue) * 100);

            return (
              <div key={`${point.index}-${point.label}`} className={styles.failureBarSlot}>
                <span
                  className={isActive ? styles.failureBarActive : styles.failureBar}
                  style={{ height: `${height}%` }}
                  title={`${formatCount(point.failures)} failures`}
                />
              </div>
            );
          })}
        </div>

        <div className={styles.failureTimeAxis}>
          <span>{model.windowStartLabel}</span>
          <span>{model.windowEndLabel}</span>
        </div>
      </div>

      <div className={styles.chartFooter}>
        <div className={styles.legend}>
          <span>
            <i className={styles.legendRed} /> Failed payments
          </span>
          <span>
            <i className={styles.legendBlue} /> Threshold
          </span>
        </div>
      </div>
    </>
  );
}

function MonitorInsightPanel({
  model,
  topAlert,
  paymentContext,
  lastEventAt,
}: {
  model?: RevenueChartModel | null;
  topAlert: AlertLike | null;
  paymentContext: PaymentFailureContext | null;
  lastEventAt?: Date | null;
}) {
  const isPaymentFailure = topAlert?.type === "payment_failed" && paymentContext;
  const isRevenueDrop = topAlert?.type === "revenue_drop" && model;

  const panelClassName = `${styles.monitorPanel} ${
    topAlert ? styles.monitorPanelIssue : styles.monitorPanelNormal
  }`;

  return (
    <aside className={panelClassName}>
      <div>
        <span className={styles.panelEyebrow}>
          <span className={styles.panelStatusDot} aria-hidden="true" />
          {topAlert ? "Current issue" : "Current state"}
        </span>
        <h3>{topAlert ? alertLabel(topAlert.type) : "Monitoring active"}</h3>
        <p>
          {topAlert
            ? buildReadableAlertMessage(topAlert)
            : "No issues detected. RevenueWatch is checking this account in read-only mode."}
        </p>
      </div>

      <div className={styles.panelGrid}>
        {isPaymentFailure ? (
          <>
            <div className={styles.panelMetric}>
              <span>Current failed payments</span>
              <strong className={styles.dangerText}>{formatCount(paymentContext.failures)}</strong>
            </div>
            <div className={styles.panelMetric}>
              <span>Usual failed payments</span>
              <strong>{formatCount(paymentContext.normalFailures ?? paymentContext.threshold)}</strong>
            </div>
            <div className={styles.panelMetric}>
              <span>Alert threshold</span>
              <strong>{formatCount(paymentContext.threshold)}</strong>
            </div>
          </>
        ) : isRevenueDrop && model ? (
          <>
            <div className={styles.panelMetric}>
              <span>Current window revenue</span>
              <strong className={model.isAlerting ? styles.dangerText : undefined}>
                {formatMoneyAmount(model.actualValue)}
              </strong>
            </div>
            <div className={styles.panelMetric}>
              <span>Usual window revenue</span>
              <strong>{formatMoneyAmount(model.expectedValue)}</strong>
            </div>
            <div className={styles.panelMetric}>
              <span>Alert threshold</span>
              <strong>{formatMoneyAmount(model.thresholdValue)}</strong>
            </div>
          </>
        ) : (
          <>
            <div className={styles.panelMetric}>
              <span>Status</span>
              <strong>Monitoring active</strong>
            </div>
            <div className={styles.panelMetric}>
              <span>Last activity</span>
              <strong>{fmtDate(lastEventAt)}</strong>
            </div>
          </>
        )}
      </div>

      {isRevenueDrop ? (
        <div className={styles.panelContext}>
          <div>
            <span>Comparison basis</span>
            <strong>Usual revenue is based on normal performance over similar recent windows</strong>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function HealthyMonitorCard({ lastEventAt }: { lastEventAt?: Date | null }) {
  return (
    <section className={styles.chartCard}>
      <div className={styles.chartLayoutSingle}>
        <div className={styles.chartMain}>
          <div className={styles.chartHeader}>
            <div>
              <h2>Monitoring active</h2>
              <p>No issues detected for this account right now.</p>
              <div className={styles.chartMeta}>Read-only monitoring</div>
            </div>
          </div>
        </div>

        <MonitorInsightPanel topAlert={null} paymentContext={null} lastEventAt={lastEventAt} />
      </div>
    </section>
  );
}

function PaymentFailureMonitor({
  topAlert,
  paymentContext,
  lastEventAt,
}: {
  topAlert: AlertLike;
  paymentContext: PaymentFailureContext;
  lastEventAt?: Date | null;
}) {
  const failureModel = buildFailureChartModel(topAlert, paymentContext);

  return (
    <section className={styles.chartCard}>
      <div className={styles.chartLayout}>
        <div className={styles.chartMain}>
          <div className={styles.chartHeader}>
            <div>
              <h2>Payment failures during this monitoring window</h2>
              <p>Payment failures increased above normal levels during this window.</p>
              <div className={styles.chartMeta}>Monitoring window: {paymentContext.windowLabel}</div>
            </div>
            <span className={styles.liveBadge}>
              <span />
              Live issue
            </span>
          </div>

          <div className={styles.failureSummaryCard}>
            <div className={styles.failureMiniBlock}>
              <span>Current failed payments</span>
              <strong>{formatCount(paymentContext.failures)}</strong>
            </div>
            <div className={styles.failureMiniBlock}>
              <span>Usual failed payments</span>
              <strong>{formatCount(paymentContext.normalFailures ?? paymentContext.threshold)}</strong>
            </div>
            <div className={styles.failureMiniBlock}>
              <span>Alert threshold</span>
              <strong>{formatCount(paymentContext.threshold)}</strong>
            </div>
          </div>

          <div className={styles.failureMiniChart}>
            <FailureChart model={failureModel} />
          </div>
        </div>

        <MonitorInsightPanel topAlert={topAlert} paymentContext={paymentContext} lastEventAt={lastEventAt} />
      </div>
    </section>
  );
}

function RevenueAlertMonitor({
  model,
  topAlert,
  paymentContext,
  lastEventAt,
}: {
  model: RevenueChartModel;
  topAlert: AlertLike;
  paymentContext: PaymentFailureContext | null;
  lastEventAt?: Date | null;
}) {
  const width = 1000;
  const height = 300;
  const plot = {
    left: 74,
    right: 980,
    top: 18,
    bottom: 246,
  };
  const plotWidth = plot.right - plot.left;
  const plotHeight = plot.bottom - plot.top;
  const maxValue =
    Math.max(
      ...model.points.flatMap((point) => [point.expected, point.actual]),
      model.thresholdValue
    ) * 1.18;

  const domain = Math.max(1, model.points.length - 1);
  const x = (index: number) => plot.left + (index / domain) * plotWidth;
  const y = (value: number) => plot.bottom - (value / maxValue) * plotHeight;
  const actualCoordinates = model.points.map((point) => ({
    x: x(point.index),
    y: y(point.actual),
  }));
  const actualPath = buildLinePath(actualCoordinates);
  const activePoint = model.points[model.activeIndex];
  const triggerPoint =
    model.points.find((point) => point.actual <= model.thresholdValue) ?? activePoint;
  const thresholdY = y(model.thresholdValue);
  const yTicks = buildMoneyTicks(maxValue);
  const xTickIndexes = buildTickIndexes(model.points.length);
  const triggerX = x(triggerPoint.index);
  const triggerY = y(triggerPoint.actual);

  return (
    <section className={styles.chartCard}>
      <div className={styles.chartLayout}>
        <div className={styles.chartMain}>
          <div className={styles.chartHeader}>
            <div>
              <h2>Revenue per monitoring window</h2>
              <p>Each point shows revenue measured during a recent monitoring window.</p>
              <div className={styles.chartMeta}>Monitoring window: {model.windowLabel}</div>
            </div>
            <span className={styles.liveBadge}>
              <span />
              Live issue
            </span>
          </div>

          <div className={styles.chartWrap}>
            <div
              className={styles.thresholdPill}
              style={{
                top: `${(thresholdY / height) * 100}%`,
                left: "68%",
              }}
            >
              Alert threshold
            </div>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="none"
              className={styles.chartSvg}
              role="img"
              aria-label="Revenue chart showing current revenue and the alert threshold"
            >
              <defs>
                <linearGradient id="accountChartFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#0058bc" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="#0058bc" stopOpacity="0" />
                </linearGradient>
              </defs>
              {yTicks.map((tick, index) => {
                const tickY = y(tick);

                return (
                  <g key={`${tick}-${index}`}>
                    <line x1={plot.left} x2={plot.right} y1={tickY} y2={tickY} className={styles.gridLine} />
                    <text x={plot.left - 14} y={tickY + 4} textAnchor="end" className={styles.axisLabel}>
                      {formatMoneyAmount(tick)}
                    </text>
                  </g>
                );
              })}
              {xTickIndexes.map((tickIndex) => (
                <text
                  key={tickIndex}
                  x={x(tickIndex)}
                  y={height - 12}
                  textAnchor={
                    tickIndex === 0 ? "start" : tickIndex === model.points.length - 1 ? "end" : "middle"
                  }
                  className={styles.axisLabel}
                >
                  {model.points[tickIndex]?.label}
                </text>
              ))}
              <rect
                x={plot.left}
                y={thresholdY}
                width={plot.right - plot.left}
                height={plot.bottom - thresholdY}
                className={styles.issueZone}
              />
              {model.isAlerting ? (
                <line x1={x(triggerPoint.index)} x2={x(triggerPoint.index)} y1={plot.top} y2={plot.bottom} className={styles.triggerLine} />
              ) : null}
              <path d={`${actualPath} L${plot.right},${plot.bottom} L${plot.left},${plot.bottom} Z`} fill="url(#accountChartFill)" />
              <line x1={plot.left} x2={plot.right} y1={thresholdY} y2={thresholdY} className={styles.thresholdLine} />
              <path d={actualPath} className={styles.actualPath} />
              {model.isAlerting ? (
                <>
                  <circle cx={triggerX} cy={triggerY} r="4" className={styles.alertPoint} />
                </>
              ) : (
                <circle cx={x(activePoint.index)} cy={y(activePoint.actual)} r="4" className={styles.activePoint} />
              )}
            </svg>
          </div>

          <div className={`${styles.chartFooter} ${styles.chartFooterCompact}`}>
            <div className={styles.legend}>
              <span>
                <i className={styles.legendBlue} /> Current revenue
              </span>
              <span>
                <i className={styles.legendRed} /> Alert threshold ({formatMoneyAmount(model.thresholdValue)})
              </span>
            </div>
          </div>
        </div>

        <MonitorInsightPanel model={model} topAlert={topAlert} paymentContext={paymentContext} lastEventAt={lastEventAt} />
      </div>
    </section>
  );
}

function AccountMonitor({
  model,
  topAlert,
  paymentContext,
  lastEventAt,
}: {
  model: RevenueChartModel;
  topAlert: AlertLike | null;
  paymentContext: PaymentFailureContext | null;
  lastEventAt?: Date | null;
}) {
  if (!topAlert) {
    return <HealthyMonitorCard lastEventAt={lastEventAt} />;
  }

  if (topAlert.type === "payment_failed" && paymentContext) {
    return <PaymentFailureMonitor topAlert={topAlert} paymentContext={paymentContext} lastEventAt={lastEventAt} />;
  }

  return <RevenueAlertMonitor model={model} topAlert={topAlert} paymentContext={paymentContext} lastEventAt={lastEventAt} />;
}

function ActiveAlertRow({ alert, now }: { alert: AlertLike; now: Date }) {
  const isCritical = alert.severity === "critical";
  const activeUntil =
    alert.windowEnd && alert.windowEnd > now ? ` - Active until ${fmtDate(alert.windowEnd)}` : "";

  return (
    <article className={styles.alertRow}>
      <div className={isCritical ? styles.alertIconCritical : styles.alertIconWarning}>!</div>
      <div>
        <h3>{alertLabel(alert.type)}</h3>
        <p>{buildReadableAlertMessage(alert)}</p>
        <span>
          {getSeverityLabel(alert.severity)} - {alert.detectedLabel ? `Detected ${alert.detectedLabel}` : `Triggered ${fmtDate(alert.createdAt)}`}
          {activeUntil}
        </span>
      </div>
    </article>
  );
}

function HistoryRow({ alert }: { alert: AlertLike }) {
  return (
    <article className={styles.resolvedRow}>
      <span className={styles.resolvedIcon}>OK</span>
      <div>
        <h3>{alertLabel(alert.type)}</h3>
        <p>{alert.message}</p>
        <span>{alert.displayTimestamp ?? `Ended ${fmtDate(alert.windowEnd)}`}</span>
      </div>
    </article>
  );
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const [account, alerts, lastEvent] = await Promise.all([
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

  const demoAccount = getDemoAccountById(accountId);

  if (!account && !demoAccount) {
    notFound();
  }

  const now = new Date();
  const activeAlerts =
    demoAccount && demoAccount.status === "active_issue"
      ? [
          {
            id: `demo-alert-${demoAccount.id}`,
            type: demoAccount.alertType,
            severity: demoAccount.severity === "high" ? "critical" : "warning",
            message: demoAccount.message,
            stripeAccountId: demoAccount.id,
            accountName: demoAccount.name,
            detectedLabel: demoAccount.detectedAt,
            context: JSON.stringify(
              demoAccount.alertType === "revenue_drop"
                ? {
                    baselineAmount: demoAccount.usualRevenue,
                    expectedRevenue: demoAccount.usualRevenue,
                    currentAmount: demoAccount.currentRevenue,
                    currentRevenue: demoAccount.currentRevenue,
                    alertThresholdAmount: demoAccount.alertThreshold,
                    threshold:
                      typeof demoAccount.alertThreshold === "number" &&
                      typeof demoAccount.usualRevenue === "number"
                        ? 1 - demoAccount.alertThreshold / demoAccount.usualRevenue
                        : 0.5,
                    baselineLabel: "recent performance",
                    window: "current monitoring window",
                    revenueSeries: demoAccount.revenueSeries,
                    displayMessage: demoAccount.message,
                  }
                : {
                    failedPayments: demoAccount.currentFailures,
                    failuresCounted: demoAccount.currentFailures,
                    baseline: demoAccount.normalFailures,
                    normalFailures: demoAccount.normalFailures,
                    failureThreshold:
                      typeof demoAccount.normalFailures === "number" ? demoAccount.normalFailures * 2 : 5,
                    window: "current monitoring window",
                    failureSeries: demoAccount.failureSeries,
                    displayMessage: demoAccount.message,
                  }
            ),
          } satisfies AlertLike,
        ]
      : alerts.filter((alert) => alert.windowEnd && alert.windowEnd > now);

  const historicalAlerts =
    demoAccount
      ? getDemoAlertHistory()
          .filter((entry) => entry.accountName === demoAccount.name)
          .map(
            (entry, index) =>
              ({
                id: `demo-history-${index}`,
                type: entry.type,
                severity: "warning",
                message: entry.message,
                stripeAccountId: demoAccount.id,
                accountName: demoAccount.name,
                displayTimestamp: entry.timestamp,
              }) satisfies AlertLike
          )
      : alerts.filter((alert) => !alert.windowEnd || alert.windowEnd <= now);

  const topAlert = activeAlerts[0] ?? null;
  const chartModel = buildRevenueChartModel(accountId, topAlert, now);
  const paymentContext = getPaymentFailureContext(topAlert);
  const accountName = account?.name ?? demoAccount?.name ?? accountId;

  return (
    <main className={styles.page}>
      <Navbar mode="app" />

      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <div className={styles.kickerRow}>
              <span className={activeAlerts.length > 0 ? styles.activeNode : styles.nominalNode}>
                {activeAlerts.length > 0 ? "Attention needed" : "Monitoring"}
              </span>
              <span className={styles.accountId}>ID: {accountId}</span>
            </div>
            <h1>
              {accountName} <span>Account details</span>
            </h1>
          </div>

          <div className={styles.actions}>
            <Link href="/dashboard" className={styles.secondaryAction}>
              Back to dashboard
            </Link>
            <Link href="/api/stripe/connect" className={styles.primaryAction}>
              Add account
            </Link>
          </div>
        </header>

        <AccountMonitor model={chartModel} topAlert={topAlert} paymentContext={paymentContext} lastEventAt={lastEvent?.createdAt} />

        <section className={styles.lowerGrid}>
          <div>
            <div className={styles.sectionHeading}>
              <h2>Active & Recent Alerts</h2>
              <span>{activeAlerts.length} flagged items</span>
            </div>

            <div className={styles.alertStack} id="current-alert">
              {activeAlerts.length > 0 ? (
                activeAlerts.map((alert) => <ActiveAlertRow key={alert.id ?? alert.type} alert={alert} now={now} />)
              ) : (
                <div className={styles.emptyState}>No active alerts for this account right now.</div>
              )}
            </div>
          </div>

          <div>
            <div className={styles.sectionHeading}>
              <h2>Alert History</h2>
              <span>Past alert activity</span>
            </div>

            <div className={styles.resolvedStack}>
              {historicalAlerts.length > 0 ? (
                historicalAlerts.map((alert) => <HistoryRow key={alert.id} alert={alert} />)
              ) : (
                <div className={styles.emptyState}>No alert history yet.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
