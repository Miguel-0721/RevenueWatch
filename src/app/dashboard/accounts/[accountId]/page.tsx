import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import SeverityHelpPopover from "@/components/SeverityHelpPopover";
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

function fmtDetectedDate(d?: Date | null) {
  if (!d) return null;

  const target = new Date(d);
  const monthDay = target.toLocaleDateString([], {
    month: "long",
    day: "numeric",
  });
  const time = target.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${monthDay} at ${time}`;
}

function buildApproxDateFromRelativeLabel(label?: string, now: Date = new Date()) {
  if (!label) return undefined;

  const match = label.match(/(\d+)\s+(minute|hour|day)s?\s+ago/i);
  if (!match) return undefined;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const date = new Date(now);

  if (unit === "minute") {
    date.setMinutes(date.getMinutes() - amount);
  } else if (unit === "hour") {
    date.setHours(date.getHours() - amount);
  } else if (unit === "day") {
    date.setDate(date.getDate() - amount);
  }

  return date;
}

function fmtUtcHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function nextHourLabel(label: string) {
  const match = label.match(/^(\d{2}):(\d{2})$/);
  if (!match) return label;

  const hour = Number(match[1]);
  return `${String((hour + 1) % 24).padStart(2, "0")}:${match[2]}`;
}

function buildTickIndexes(length: number) {
  if (length <= 1) return [0];

  if (length <= 8) {
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
    return `Sales are ${dropPercent}% lower than usual for this time period.`;
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
  const focusedBucketCount = 5;
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
    const triggerIndex = revenueSeries.findIndex((point) => point.revenue <= thresholdValue);
    const anchorIndex = triggerIndex >= 0 ? triggerIndex : revenueSeries.length - 1;
    const windowStart = Math.max(0, anchorIndex - (focusedBucketCount - 1));
    const visibleSeries = revenueSeries.slice(windowStart, anchorIndex + 1);
    const points = visibleSeries.map((point, index) => ({
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

  const anchorHour = topAlert?.createdAt?.getUTCHours() ?? now.getUTCHours();
  const points = Array.from({ length: focusedBucketCount }, (_, index) => {
    const relativeHour = focusedBucketCount - 1 - index;
    const hour = (anchorHour - relativeHour + 24) % 24;
    const bucketProgress = index / Math.max(1, focusedBucketCount - 1);
    const dayCurve = 0.9 + Math.sin((hour / 24) * Math.PI * 2 - 0.5) * 0.08;
    const workdayLift = hour >= 8 && hour <= 21 ? 1.05 : 0.88;
    const expected = Math.round(expectedValue * dayCurve * workdayLift);
    const drift = 0.95 + ((index % 3) - 1) * 0.015;
    const actual =
      index === focusedBucketCount - 1
        ? actualValue
        : Math.round(expected * Math.min(1.02, drift + bucketProgress * 0.02));

    return {
      index,
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
      activeIndex: points.length - 1,
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

function buildCountTicks(maxValue: number) {
  const roughStep = Math.max(1, maxValue / 3);
  const niceSteps = [5, 10, 20, 25, 50, 100, 200];
  const step = niceSteps.find((candidate) => candidate >= roughStep) ?? niceSteps[niceSteps.length - 1];
  const top = Math.max(step, Math.ceil(maxValue / step) * step);

  return Array.from({ length: Math.floor(top / step) + 1 }, (_, index) => index * step);
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
    const visibleSeries = failureSeries.slice(-6);
    const points = visibleSeries.map((point, index) => ({
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
  };
}

function FailureChart({ model }: { model: FailureChartModel }) {
  const scaleMax = Math.max(model.peakFailures, model.threshold);
  const countTicks = buildCountTicks(scaleMax);
  const maxValue = countTicks[countTicks.length - 1] ?? scaleMax;
  const thresholdPercent = Math.min(86, Math.max(12, (model.threshold / maxValue) * 100));
  const bucketCount = model.points.length;
  const timeBoundaryLabels = [
    ...model.points.map((point) => point.label),
    nextHourLabel(model.points[model.points.length - 1]?.label ?? "00:00"),
  ];
  const barLayouts = model.points.map((point, index) => {
    const startPercent = (index / Math.max(1, bucketCount)) * 100;
    const endPercent = ((index + 1) / Math.max(1, bucketCount)) * 100;
    const bucketWidthPercent = endPercent - startPercent;
    const barWidthPercent = bucketWidthPercent * 0.56;
    const leftPercent = startPercent + (bucketWidthPercent - barWidthPercent) / 2;

    return {
      point,
      leftPercent,
      widthPercent: barWidthPercent,
    };
  });

  const thresholdChipWidthPercent = 16;
  const thresholdChipHalfWidth = thresholdChipWidthPercent / 2;
  const thresholdChipBuffer = 2.5;
  const thresholdChipMinCenter = Math.max(55, thresholdChipHalfWidth + 2);
  const thresholdChipMaxCenter = 100 - thresholdChipHalfWidth - 2;

  let thresholdChipCenter = Math.min(78, thresholdChipMaxCenter);

  for (const bar of [...barLayouts].reverse()) {
    const barLeft = bar.leftPercent;
    const barRight = bar.leftPercent + bar.widthPercent;
    const chipLeft = thresholdChipCenter - thresholdChipHalfWidth;
    const chipRight = thresholdChipCenter + thresholdChipHalfWidth;
    const collides =
      chipRight >= barLeft - thresholdChipBuffer &&
      chipLeft <= barRight + thresholdChipBuffer;

    if (collides) {
      thresholdChipCenter = Math.max(
        thresholdChipMinCenter,
        thresholdChipCenter - 4
      );
    }
  }

  thresholdChipCenter = Math.min(thresholdChipMaxCenter, thresholdChipCenter);

  return (
    <>
      <div className={styles.failureChartWrap}>
        <div className={styles.failureYAxis}>
          {countTicks.map((tick) => (
            <span
              key={tick}
              style={{
                top: `${100 - Math.min(100, Math.max(0, (tick / maxValue) * 100))}%`,
              }}
            >
              {formatCount(tick)}
            </span>
          ))}
        </div>
        <div
          className={styles.failureThresholdLine}
          style={{
            bottom: `${thresholdPercent}%`,
          }}
        />
        <div
          className={styles.failureThreshold}
          style={{
            left: `${thresholdChipCenter}%`,
            bottom: `calc(${thresholdPercent}% - 10px)`,
          }}
        >
          Threshold: {formatCount(model.threshold)}
        </div>

        <div className={styles.failureBars} aria-label="Failed payments over the current period">
          {barLayouts.map(({ point, leftPercent, widthPercent }) => {
            const isActive = point.index === model.activeIndex;
            const height = Math.max(8, (point.failures / maxValue) * 100);
            const isAboveThreshold = point.failures >= model.threshold;
            const barClassName =
              isActive && isAboveThreshold
                ? styles.failureBarActive
                : isAboveThreshold
                  ? styles.failureBarThreshold
                  : styles.failureBar;

            return (
              <span
                key={`${point.index}-${point.label}`}
                className={barClassName}
                style={{
                  height: `${height}%`,
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                }}
                title={`${point.label}–${nextHourLabel(point.label)}: ${formatCount(point.failures)} failed payment${point.failures === 1 ? "" : "s"}`}
              />
            );
          })}
        </div>

        <div className={styles.failureTimeAxis}>
          {timeBoundaryLabels.map((label, index) => (
            <span
              key={`${index}-${label}`}
              style={{
                left: `${(index / Math.max(1, timeBoundaryLabels.length - 1)) * 100}%`,
                transform:
                  index === 0
                    ? "translateX(0)"
                    : index === timeBoundaryLabels.length - 1
                      ? "translateX(-100%)"
                      : "translateX(-50%)",
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.chartFooter}>
        <div className={styles.legend}>
          <span>
            <i className={styles.legendRed} /> Failed payments
          </span>
          <span>
            <i className={styles.legendDash} /> Threshold
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
        <div className={styles.panelEyebrowRow}>
          <span className={styles.panelEyebrow}>
            <span className={styles.panelStatusDot} aria-hidden="true" />
            {topAlert ? "Current issue" : "Current state"}
          </span>
          {topAlert && (topAlert.type === "payment_failed" || topAlert.type === "revenue_drop") ? (
            <SeverityHelpPopover alertType={topAlert.type} />
          ) : null}
        </div>
        <h3>{topAlert ? alertLabel(topAlert.type) : "Monitoring active"}</h3>
        <p>
          {topAlert
            ? buildReadableAlertMessage(topAlert)
            : "No issues detected. RevenueWatch is checking this account in read-only mode."}
        </p>
        {topAlert ? (
          <div className={styles.detectedAt}>
            Detected: {fmtDetectedDate(topAlert.createdAt) ?? "Recently"}
          </div>
        ) : null}
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
              <span>Current revenue</span>
              <strong className={model.isAlerting ? styles.dangerText : undefined}>
                {formatMoneyAmount(model.actualValue)}
              </strong>
            </div>
            <div className={styles.panelMetric}>
              <span>Usual revenue</span>
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
            <strong>Usual revenue is based on similar recent time periods.</strong>
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
              <h2>Failed payments during this period</h2>
              <p>Each bar shows how many failed payments happened during that time period.</p>
              <div className={styles.chartMeta}>Current period</div>
            </div>
            <span className={styles.liveBadge}>
              <span />
              Live issue
            </span>
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
  const previousPoint =
    triggerPoint.index > 0 ? model.points[triggerPoint.index - 1] : triggerPoint;
  const thresholdY = y(model.thresholdValue);
  const yTicks = buildMoneyTicks(maxValue);
  const xTickIndexes = buildTickIndexes(model.points.length);
  const previousX = x(previousPoint.index);
  const triggerX = x(triggerPoint.index);
  const triggerY = y(triggerPoint.actual);
  const thresholdLabelWidth = 140;
  const thresholdLabelPadding = 24;
  const thresholdLabelHalfWidth = thresholdLabelWidth / 2;
  const leftLimit = plot.left + thresholdLabelHalfWidth + 12;
  const rightLimit = plot.right - thresholdLabelHalfWidth - 12;
  const leftCandidate = previousX - thresholdLabelHalfWidth - 32;
  const rightCandidate = triggerX + thresholdLabelHalfWidth + 32;
  const hasRoomLeft = leftCandidate - leftLimit >= thresholdLabelPadding;
  const thresholdLabelX = hasRoomLeft
    ? Math.max(leftLimit, leftCandidate)
    : Math.min(rightLimit, rightCandidate);

  return (
    <section className={styles.chartCard}>
      <div className={styles.chartLayout}>
        <div className={styles.chartMain}>
          <div className={styles.chartHeader}>
            <div>
              <h2>Revenue during this period</h2>
              <p>Each point shows how much revenue came in during that time period.</p>
              <div className={styles.chartMeta}>Current period</div>
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
                left: `${(thresholdLabelX / width) * 100}%`,
              }}
            >
              Threshold ({formatMoneyAmount(model.thresholdValue)})
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
  const detectedAt = fmtDetectedDate(alert.createdAt);

  return (
    <article className={styles.alertRow}>
      <div className={isCritical ? styles.alertIconCritical : styles.alertIconWarning}>!</div>
      <div>
        <h3>{alertLabel(alert.type)}</h3>
        <p>{buildReadableAlertMessage(alert)}</p>
        <span>
          {getSeverityLabel(alert.severity)} · {detectedAt ? `Detected ${detectedAt}` : alert.detectedLabel ? `Detected ${alert.detectedLabel}` : `Triggered ${fmtDate(alert.createdAt)}`}
          {activeUntil}
        </span>
      </div>
    </article>
  );
}

function HistoryRow({ alert }: { alert: AlertLike }) {
  return (
    <article className={styles.resolvedRow}>
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
            createdAt: buildApproxDateFromRelativeLabel(demoAccount.detectedAt, now),
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
  const headerStatus =
    topAlert?.severity === "critical"
      ? { label: "High severity", className: styles.statusCritical }
      : topAlert
        ? { label: "Review needed", className: styles.statusWarning }
        : { label: "Monitoring active", className: styles.statusHealthy };

  return (
    <main className={styles.page}>
      <Navbar mode="app" />

      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <div className={styles.titleRow}>
              <h1>{accountName}</h1>
              <span className={headerStatus.className}>{headerStatus.label}</span>
            </div>
            <p className={styles.headerSubtitle}>
              Review this account&apos;s current monitoring status and alert activity.
            </p>
          </div>

          <div className={styles.actions}>
            <Link href="/dashboard" className={styles.secondaryAction}>
              Back to dashboard
            </Link>
          </div>
        </header>

        <AccountMonitor model={chartModel} topAlert={topAlert} paymentContext={paymentContext} lastEventAt={lastEvent?.createdAt} />

        <section className={styles.lowerGrid}>
          <div>
            <div className={styles.sectionHeading}>
              <h2>Current Issue</h2>
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
