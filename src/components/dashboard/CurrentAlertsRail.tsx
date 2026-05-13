"use client";

import SeverityHelpPopover from "@/components/SeverityHelpPopover";
import { formatMoneyAmount, normalizeCurrencyCode } from "@/lib/currency";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import detailStyles from "@/app/dashboard/accounts/[accountId]/page.module.css";
import styles from "./CurrentAlertsRail.module.css";

type CurrentAlertRailItem = {
  id: string;
  accountName: string;
  type: string;
  typeLabel: string;
  message: string;
  severityKind: "critical" | "warning";
  severityLabel: string;
  severityTextColor: string;
  severityBgColor: string;
  typeColor: string;
  detectedLabel: string;
  href: string;
  context?: string | null;
  createdAt?: string | null;
};

type RevenueContext = {
  baselineAmount: number;
  currentAmount: number;
  dropRatio: number;
  alertThresholdAmount: number;
  windowLabel: string;
  currency: string;
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
  activeIndex: number;
  isAlerting: boolean;
  currency: string;
};

type FailureChartPoint = {
  index: number;
  label: string;
  failures: number;
};

type FailureChartModel = {
  points: FailureChartPoint[];
  threshold: number;
  peakFailures: number;
  activeIndex: number;
};

type SeverityPresentation = ReturnType<typeof getSeverityPresentation>;

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.arrowIcon}>
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="m14.5 6.5-5 5 5 5"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.arrowIcon}>
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="m9.5 6.5 5 5-5 5"
      />
    </svg>
  );
}

function safeParseContext(input?: string | null) {
  if (!input) return null;

  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtDetectedDate(value?: string | null) {
  if (!value) return "Recently";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  const monthDay = date.toLocaleDateString([], {
    month: "long",
    day: "numeric",
  });
  const time = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${monthDay} at ${time}`;
}

function nextHourLabel(label: string) {
  const match = label.match(/^(\d{2}):(\d{2})$/);
  if (!match) return label;

  const hour = Number(match[1]);
  return `${String((hour + 1) % 24).padStart(2, "0")}:${match[2]}`;
}

function buildTickIndexes(length: number) {
  if (length <= 1) return [0];
  if (length <= 8) return Array.from({ length }, (_, index) => index);

  const candidates = [
    0,
    Math.floor((length - 1) / 3),
    Math.floor(((length - 1) * 2) / 3),
    length - 1,
  ];

  return [...new Set(candidates)];
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
  const step =
    niceSteps.find((candidate) => candidate >= roughStep) ?? niceSteps[niceSteps.length - 1];
  const top = Math.max(step, Math.ceil(maxValue / step) * step);

  return Array.from({ length: Math.floor(top / step) + 1 }, (_, index) => index * step);
}

function getSeverityPresentation(severity?: string) {
  if (severity === "critical") {
    return {
      label: "High severity",
      accentColor: "#ba1a1a",
      accentSoft: "#ffdad6",
      accentZone: "rgba(186, 26, 26, 0.03)",
      accentShadow: "rgba(186, 26, 26, 0.09)",
      accentLine: "rgba(186, 26, 26, 0.34)",
      barSoft: "rgba(255, 188, 188, 0.62)",
      barStrong: "rgba(186, 26, 26, 0.82)",
      barActive: "#ba1a1a",
      barShadow: "rgba(186, 26, 26, 0.14)",
      legendClass: detailStyles.legendRed,
      dashClass: detailStyles.legendDashRed,
      panelClass: detailStyles.monitorPanelIssueCritical,
      statusClass: detailStyles.statusCritical,
    };
  }

  return {
    label: "Review needed",
    accentColor: "#9a6700",
    accentSoft: "#fff1c2",
    accentZone: "rgba(154, 103, 0, 0.045)",
    accentShadow: "rgba(154, 103, 0, 0.1)",
    accentLine: "rgba(154, 103, 0, 0.34)",
    barSoft: "rgba(255, 218, 133, 0.5)",
    barStrong: "rgba(183, 121, 31, 0.76)",
    barActive: "#b7791f",
    barShadow: "rgba(183, 121, 31, 0.16)",
    legendClass: detailStyles.legendAmber,
    dashClass: detailStyles.legendDashAmber,
    panelClass: detailStyles.monitorPanelIssueWarning,
    statusClass: detailStyles.statusWarning,
  };
}

function getRevenueContext(alert?: CurrentAlertRailItem | null): RevenueContext | null {
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
    baselineAmount,
    currentAmount,
    dropRatio:
      typeof parsed.dropRatio === "number"
        ? parsed.dropRatio
        : (baselineAmount - currentAmount) / baselineAmount,
    alertThresholdAmount:
      typeof parsed.alertThresholdAmount === "number"
        ? parsed.alertThresholdAmount
        : Math.round(baselineAmount * 0.5),
    windowLabel:
      typeof parsed.window === "string" ? parsed.window : "current monitoring window",
    currency:
      typeof parsed.currency === "string"
        ? normalizeCurrencyCode(parsed.currency)
        : "EUR",
  };
}

function getPaymentFailureContext(alert?: CurrentAlertRailItem | null): PaymentFailureContext | null {
  if (!alert || alert.type !== "payment_failed") return null;

  const parsed = safeParseContext(alert.context);
  if (!parsed) return null;

  const failures =
    typeof parsed.failuresCounted === "number"
      ? parsed.failuresCounted
      : typeof parsed.failedPayments === "number"
        ? parsed.failedPayments
        : typeof parsed.currentFailures === "number"
          ? parsed.currentFailures
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
      typeof parsed.failureThreshold === "number"
        ? parsed.failureThreshold
        : typeof parsed.normalFailures === "number"
          ? parsed.normalFailures * 2
          : 5,
    windowLabel:
      typeof parsed.window === "string" ? parsed.window : "current monitoring window",
  };
}

function buildReadableAlertMessage(alert: CurrentAlertRailItem) {
  const parsed = safeParseContext(alert.context);
  if (parsed && typeof parsed.displayMessage === "string") {
    return parsed.displayMessage;
  }

  const revenueContext = getRevenueContext(alert);
  if (revenueContext) {
    return `Sales are ${Math.round(revenueContext.dropRatio * 100)}% lower than usual for this time period.`;
  }

  const paymentContext = getPaymentFailureContext(alert);
  if (paymentContext) {
    return alert.message;
  }

  return alert.message;
}

function buildRevenueChartModel(alert: CurrentAlertRailItem, now: Date): RevenueChartModel {
  const parsed = safeParseContext(alert.context);
  const revenueContext = getRevenueContext(alert);
  const expectedValue = revenueContext?.baselineAmount ?? 2400;
  const actualValue = revenueContext?.currentAmount ?? Math.round(expectedValue * 0.94);
  const thresholdValue = revenueContext?.alertThresholdAmount ?? Math.round(expectedValue * 0.5);
  const focusedBucketCount = 5;
  const revenueSeries = Array.isArray(parsed?.revenueSeries)
    ? parsed.revenueSeries.filter(
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
      activeIndex: points.length - 1,
      isAlerting: latestValue < thresholdValue,
      currency: revenueContext?.currency ?? "EUR",
    };
  }

  const createdAt = alert.createdAt ? new Date(alert.createdAt) : now;
  const anchorHour = Number.isNaN(createdAt.getTime()) ? now.getUTCHours() : createdAt.getUTCHours();
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
      label: `${String(hour).padStart(2, "0")}:00`,
      expected,
      actual,
    };
  });

  return {
    points,
    expectedValue,
    actualValue,
    thresholdValue,
    activeIndex: points.length - 1,
    isAlerting: actualValue < thresholdValue,
    currency: revenueContext?.currency ?? "EUR",
  };
}

function buildFailureChartModel(
  alert: CurrentAlertRailItem,
  paymentContext: PaymentFailureContext | null
): FailureChartModel {
  const parsed = safeParseContext(alert.context);
  const threshold = paymentContext?.threshold ?? 5;
  const failureSeries = Array.isArray(parsed?.failureSeries)
    ? parsed.failureSeries.filter(
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
      threshold,
      peakFailures: Math.max(...points.map((point) => point.failures)),
      activeIndex: points.length - 1,
    };
  }

  const failures = paymentContext?.failures ?? 0;
  const points = Array.from({ length: 6 }, (_, index) => ({
    index,
    label: `${String((10 + index) % 24).padStart(2, "0")}:00`,
    failures: index === 5 ? failures : Math.max(0, Math.round(failures * (index / 9))),
  }));

  return {
    points,
    threshold,
    peakFailures: Math.max(...points.map((point) => point.failures)),
    activeIndex: points.length - 1,
  };
}

function FailureChart({
  model,
  severity,
}: {
  model: FailureChartModel;
  severity: SeverityPresentation;
}) {
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

    return { point, leftPercent, widthPercent: barWidthPercent };
  });
  const thresholdChipWidthPercent = 16;
  const thresholdChipHalfWidth = thresholdChipWidthPercent / 2;
  const thresholdChipCenter = Math.min(100 - thresholdChipHalfWidth - 2, Math.max(thresholdChipHalfWidth + 2, 50));

  return (
    <>
      <div className={detailStyles.failureChartWrap}>
        <div className={detailStyles.failureYAxis}>
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
          className={detailStyles.failureThresholdLine}
          style={{
            bottom: `${thresholdPercent}%`,
            borderTopColor: severity.accentColor,
          }}
        />
        <div
          className={detailStyles.failureThreshold}
          style={{
            left: `${thresholdChipCenter}%`,
            bottom: `calc(${thresholdPercent}% - 10px)`,
            background: severity.accentSoft,
            color: severity.accentColor,
          }}
        >
          Threshold: {formatCount(model.threshold)}
        </div>

        <div className={detailStyles.failureBars} aria-label="Failed payments over the current period">
          {barLayouts.map(({ point, leftPercent, widthPercent }) => {
            const isActive = point.index === model.activeIndex;
            const height = Math.max(8, (point.failures / maxValue) * 100);
            const isAboveThreshold = point.failures >= model.threshold;
            const barClassName =
              isActive && isAboveThreshold
                ? detailStyles.failureBarActive
                : isAboveThreshold
                  ? detailStyles.failureBarThreshold
                  : detailStyles.failureBar;

            return (
              <span
                key={`${point.index}-${point.label}`}
                className={barClassName}
                style={{
                  height: `${height}%`,
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                  background: isActive
                    ? severity.barActive
                    : isAboveThreshold
                      ? severity.barStrong
                      : severity.barSoft,
                  boxShadow: isActive ? `0 8px 16px ${severity.barShadow}` : undefined,
                }}
              />
            );
          })}
        </div>

        <div className={detailStyles.failureTimeAxis}>
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

      <div className={detailStyles.chartFooter}>
        <div className={detailStyles.legend}>
          <span>
            <i className={severity.legendClass} /> Failed payments
          </span>
          <span>
            <i className={severity.dashClass} /> Threshold
          </span>
        </div>
      </div>
    </>
  );
}

function MonitorInsightPanel({
  alert,
  model,
  paymentContext,
  severity,
}: {
  alert: CurrentAlertRailItem;
  model?: RevenueChartModel | null;
  paymentContext: PaymentFailureContext | null;
  severity: SeverityPresentation;
}) {
  const isPaymentFailure = alert.type === "payment_failed" && paymentContext;
  const isRevenueDrop = alert.type === "revenue_drop" && model;

  return (
    <aside className={`${detailStyles.monitorPanel} ${severity.panelClass}`}>
      <div>
        <div className={detailStyles.panelEyebrowRow}>
          <span className={detailStyles.panelEyebrow}>
            <span
              className={detailStyles.panelStatusDot}
              aria-hidden="true"
              style={{ background: severity.accentColor }}
            />
            Current issue
          </span>
          {alert.type === "payment_failed" || alert.type === "revenue_drop" ? (
            <SeverityHelpPopover alertType={alert.type} />
          ) : null}
        </div>
        <h3>{alert.typeLabel}</h3>
        <p>{buildReadableAlertMessage(alert)}</p>
        <div className={detailStyles.detectedAt}>Detected: {fmtDetectedDate(alert.createdAt)}</div>
      </div>

      <div className={detailStyles.panelGrid}>
        {isPaymentFailure ? (
          <>
            <div className={detailStyles.panelMetric}>
              <span>Current failed payments</span>
              <strong style={{ color: severity.accentColor }}>
                {formatCount(paymentContext.failures)}
              </strong>
            </div>
            <div className={detailStyles.panelMetric}>
              <span>Usual failed payments</span>
              <strong>
                {paymentContext.normalFailures !== null
                  ? formatCount(paymentContext.normalFailures)
                  : "Not enough history yet"}
              </strong>
            </div>
            <div className={detailStyles.panelMetric}>
              <span>Alert threshold</span>
              <strong>{formatCount(paymentContext.threshold)}</strong>
            </div>
          </>
        ) : isRevenueDrop && model ? (
          <>
            <div className={detailStyles.panelMetric}>
              <span>Current revenue</span>
              <strong style={model.isAlerting ? { color: severity.accentColor } : undefined}>
                {formatMoneyAmount(model.actualValue, model.currency)}
                </strong>
            </div>
            <div className={detailStyles.panelMetric}>
              <span>Usual revenue</span>
              <strong>{formatMoneyAmount(model.expectedValue, model.currency)}</strong>
            </div>
            <div className={detailStyles.panelMetric}>
              <span>Alert threshold</span>
              <strong>{formatMoneyAmount(model.thresholdValue, model.currency)}</strong>
            </div>
          </>
        ) : null}
      </div>

      {isRevenueDrop ? (
        <div className={detailStyles.panelContext}>
          <div>
            <span>Comparison basis</span>
            <strong>Usual revenue is based on similar recent time periods.</strong>
          </div>
        </div>
      ) : null}

      <div className={styles.detailActions}>
        <Link href={alert.href} className={styles.detailReviewLink}>
          Review account
        </Link>
      </div>
    </aside>
  );
}

function PaymentFailureMonitor({
  alert,
  paymentContext,
  severity,
}: {
  alert: CurrentAlertRailItem;
  paymentContext: PaymentFailureContext;
  severity: SeverityPresentation;
}) {
  const failureModel = buildFailureChartModel(alert, paymentContext);

  return (
    <section className={detailStyles.chartCard}>
      <div className={detailStyles.chartLayout}>
        <div className={detailStyles.chartMain}>
          <div className={detailStyles.chartHeader}>
            <div>
              <h2>Failed payments during this period</h2>
              <p>Each bar shows how many failed payments happened during that time period.</p>
              <div className={detailStyles.chartMeta}>Current period</div>
            </div>
            <span className={detailStyles.liveBadge} style={{ color: severity.accentColor }}>
              <span
                style={{
                  background: severity.accentColor,
                  boxShadow: `0 0 0 6px ${severity.accentShadow}`,
                }}
              />
              {severity.label}
            </span>
          </div>

          <div className={detailStyles.failureMiniChart}>
            <FailureChart model={failureModel} severity={severity} />
          </div>
        </div>

        <MonitorInsightPanel
          alert={alert}
          paymentContext={paymentContext}
          severity={severity}
        />
      </div>
    </section>
  );
}

function RevenueAlertMonitor({
  alert,
  model,
  paymentContext,
  severity,
}: {
  alert: CurrentAlertRailItem;
  model: RevenueChartModel;
  paymentContext: PaymentFailureContext | null;
  severity: SeverityPresentation;
}) {
  const width = 1000;
  const height = 300;
  const plot = { left: 74, right: 980, top: 18, bottom: 246 };
  const plotWidth = plot.right - plot.left;
  const plotHeight = plot.bottom - plot.top;
  const maxValue =
    Math.max(...model.points.flatMap((point) => [point.expected, point.actual]), model.thresholdValue) *
    1.18;
  const domain = Math.max(1, model.points.length - 1);
  const x = (index: number) => plot.left + (index / domain) * plotWidth;
  const y = (value: number) => plot.bottom - (value / maxValue) * plotHeight;
  const actualCoordinates = model.points.map((point) => ({
    x: x(point.index),
    y: y(point.actual),
  }));
  const actualPath = buildLinePath(actualCoordinates);
  const activePoint = model.points[model.activeIndex];
  const triggerPoint = model.points.find((point) => point.actual <= model.thresholdValue) ?? activePoint;
  const previousPoint = triggerPoint.index > 0 ? model.points[triggerPoint.index - 1] : triggerPoint;
  const thresholdY = y(model.thresholdValue);
  const yTicks = buildMoneyTicks(maxValue);
  const xTickIndexes = buildTickIndexes(model.points.length);
  const triggerX = x(triggerPoint.index);
  const triggerY = y(triggerPoint.actual);
  const thresholdLabelWidth = 140;
  const thresholdLabelHalfWidth = thresholdLabelWidth / 2;
  const leftLimit = plot.left + thresholdLabelHalfWidth + 12;
  const rightLimit = plot.right - thresholdLabelHalfWidth - 12;
  const centeredCandidate = plot.left + plotWidth / 2;
  const thresholdLabelX = Math.min(rightLimit, Math.max(leftLimit, centeredCandidate));

  return (
    <section className={detailStyles.chartCard}>
      <div className={detailStyles.chartLayout}>
        <div className={detailStyles.chartMain}>
          <div className={detailStyles.chartHeader}>
            <div>
              <h2>Revenue during this period</h2>
              <p>Each point shows how much revenue came in during that time period.</p>
              <div className={detailStyles.chartMeta}>Current period</div>
            </div>
            <span className={detailStyles.liveBadge} style={{ color: severity.accentColor }}>
              <span
                style={{
                  background: severity.accentColor,
                  boxShadow: `0 0 0 6px ${severity.accentShadow}`,
                }}
              />
              {severity.label}
            </span>
          </div>

          <div className={detailStyles.chartWrap}>
            <div
              className={detailStyles.thresholdPill}
              style={{
                top: `${(thresholdY / height) * 100}%`,
                left: `${(thresholdLabelX / width) * 100}%`,
                background: severity.accentSoft,
                color: severity.accentColor,
                boxShadow: `0 1px 2px ${severity.accentShadow}`,
              }}
            >
              Threshold ({formatMoneyAmount(model.thresholdValue, model.currency)})
            </div>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="none"
              className={detailStyles.chartSvg}
              role="img"
              aria-label="Revenue chart showing current revenue and the alert threshold"
            >
              <defs>
                <linearGradient id="dashboardSelectedAlertFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#0058bc" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="#0058bc" stopOpacity="0" />
                </linearGradient>
              </defs>

              {yTicks.map((tick, index) => {
                const tickY = y(tick);
                return (
                  <g key={`${tick}-${index}`}>
                    <line x1={plot.left} x2={plot.right} y1={tickY} y2={tickY} className={detailStyles.gridLine} />
                    <text x={plot.left - 14} y={tickY + 4} textAnchor="end" className={detailStyles.axisLabel}>
                      {formatMoneyAmount(tick, model.currency)}
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
                  className={detailStyles.axisLabel}
                >
                  {model.points[tickIndex]?.label}
                </text>
              ))}

              <rect
                x={plot.left}
                y={thresholdY}
                width={plot.right - plot.left}
                height={plot.bottom - thresholdY}
                style={{ fill: severity.accentZone }}
              />
              {model.isAlerting ? (
                <line
                  x1={x(triggerPoint.index)}
                  x2={x(triggerPoint.index)}
                  y1={plot.top}
                  y2={plot.bottom}
                  style={{ stroke: severity.accentLine, strokeWidth: 1, strokeDasharray: "4 7" }}
                />
              ) : null}
              <path
                d={`${actualPath} L${plot.right},${plot.bottom} L${plot.left},${plot.bottom} Z`}
                fill="url(#dashboardSelectedAlertFill)"
              />
              <line
                x1={plot.left}
                x2={plot.right}
                y1={thresholdY}
                y2={thresholdY}
                style={{
                  fill: "none",
                  stroke: severity.accentColor,
                  strokeWidth: 1.5,
                  strokeDasharray: "9 6",
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                }}
              />
              <path d={actualPath} className={detailStyles.actualPath} />
              {model.isAlerting ? (
                <circle
                  cx={triggerX}
                  cy={triggerY}
                  r="4"
                  style={{ fill: severity.accentColor, stroke: "#ffffff", strokeWidth: 2 }}
                />
              ) : (
                <circle
                  cx={x(activePoint.index)}
                  cy={y(activePoint.actual)}
                  r="4"
                  className={detailStyles.activePoint}
                />
              )}
            </svg>
          </div>

          <div className={`${detailStyles.chartFooter} ${detailStyles.chartFooterCompact}`}>
            <div className={detailStyles.legend}>
              <span>
                <i className={detailStyles.legendBlue} /> Current revenue
              </span>
              <span>
                <i className={severity.legendClass} /> Alert threshold ({formatMoneyAmount(model.thresholdValue, model.currency)})
              </span>
            </div>
          </div>
        </div>

        <MonitorInsightPanel
          alert={alert}
          model={model}
          paymentContext={paymentContext}
          severity={severity}
        />
      </div>
    </section>
  );
}

function SelectedAlertDetail({
  alert,
  canSelectLeft,
  canSelectRight,
  onSelectLeft,
  onSelectRight,
}: {
  alert: CurrentAlertRailItem;
  canSelectLeft: boolean;
  canSelectRight: boolean;
  onSelectLeft: () => void;
  onSelectRight: () => void;
}) {
  const now = new Date();
  const severity = getSeverityPresentation(alert.severityKind);
  const paymentContext = getPaymentFailureContext(alert);

  if (alert.type === "payment_failed" && paymentContext) {
    return (
      <div className={styles.detailSection}>
        <div className={styles.detailHeader}>
          <div>
            <span className={styles.detailKicker}>Selected alert</span>
            <div className={styles.detailTitleRow}>
              <h3 className={styles.detailAccountName}>{alert.accountName}</h3>
              <span className={severity.statusClass}>{severity.label}</span>
            </div>
            <p className={styles.detailSummary}>
              Review the payment failure spike that triggered for this account.
            </p>
          </div>
          <div className={styles.detailNav}>
            <button
              type="button"
              className={`${styles.detailNavButton}${!canSelectLeft ? ` ${styles.detailNavButtonDisabled}` : ""}`}
              onClick={onSelectLeft}
              disabled={!canSelectLeft}
              aria-label="Select previous alert"
            >
              <ArrowLeftIcon />
            </button>
            <button
              type="button"
              className={`${styles.detailNavButton}${!canSelectRight ? ` ${styles.detailNavButtonDisabled}` : ""}`}
              onClick={onSelectRight}
              disabled={!canSelectRight}
              aria-label="Select next alert"
            >
              <ArrowRightIcon />
            </button>
          </div>
        </div>

        <PaymentFailureMonitor alert={alert} paymentContext={paymentContext} severity={severity} />
      </div>
    );
  }

  const model = buildRevenueChartModel(alert, now);

  return (
    <div className={styles.detailSection}>
      <div className={styles.detailHeader}>
        <div>
          <span className={styles.detailKicker}>Selected alert</span>
          <div className={styles.detailTitleRow}>
            <h3 className={styles.detailAccountName}>{alert.accountName}</h3>
            <span className={severity.statusClass}>{severity.label}</span>
          </div>
          <p className={styles.detailSummary}>
            Review the revenue drop that triggered for this account.
          </p>
        </div>
        <div className={styles.detailNav}>
          <button
            type="button"
            className={`${styles.detailNavButton}${!canSelectLeft ? ` ${styles.detailNavButtonDisabled}` : ""}`}
            onClick={onSelectLeft}
            disabled={!canSelectLeft}
            aria-label="Select previous alert"
          >
            <ArrowLeftIcon />
          </button>
          <button
            type="button"
            className={`${styles.detailNavButton}${!canSelectRight ? ` ${styles.detailNavButtonDisabled}` : ""}`}
            onClick={onSelectRight}
            disabled={!canSelectRight}
            aria-label="Select next alert"
          >
            <ArrowRightIcon />
          </button>
        </div>
      </div>

      <RevenueAlertMonitor alert={alert} model={model} paymentContext={paymentContext} severity={severity} />
    </div>
  );
}

export default function CurrentAlertsRail({
  alerts,
  pendingLabel,
}: {
  alerts: CurrentAlertRailItem[];
  pendingLabel: string;
}) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (selectedIndex >= alerts.length) {
      setSelectedIndex(0);
    }
  }, [alerts.length, selectedIndex]);

  useEffect(() => {
    const selectedCard = cardRefs.current[selectedIndex];
    selectedCard?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    });
  }, [selectedIndex]);

  const selectedAlert = alerts[selectedIndex] ?? null;
  const canSelectLeft = selectedIndex > 0;
  const canSelectRight = selectedIndex < alerts.length - 1;

  const fadeClasses = useMemo(
    () => `${canSelectLeft ? ` ${styles.fadeLeft}` : ""}${canSelectRight ? ` ${styles.fadeRight}` : ""}`,
    [canSelectLeft, canSelectRight]
  );

  function moveSelection(direction: "left" | "right") {
    setSelectedIndex((current) => {
      if (direction === "left") {
        return Math.max(0, current - 1);
      }
      return Math.min(alerts.length - 1, current + 1);
    });
  }

  return (
    <section className={styles.section} aria-label="Current alerts">
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Current alerts</h2>
          <p className={styles.intro}>Review the accounts that need attention right now.</p>
        </div>

        <div className={styles.controls}>
          <span className={styles.count}>{pendingLabel}</span>
          <div className={styles.arrowGroup}>
            <button
              type="button"
              className={`${styles.arrowButton}${!canSelectLeft ? ` ${styles.arrowButtonDisabled}` : ""}`}
              aria-label="Scroll alerts left"
              aria-disabled={!canSelectLeft}
              disabled={!canSelectLeft}
              onClick={() => moveSelection("left")}
            >
              <ArrowLeftIcon />
            </button>
            <button
              type="button"
              className={`${styles.arrowButton}${!canSelectRight ? ` ${styles.arrowButtonDisabled}` : ""}`}
              aria-label="Scroll alerts right"
              aria-disabled={!canSelectRight}
              disabled={!canSelectRight}
              onClick={() => moveSelection("right")}
            >
              <ArrowRightIcon />
            </button>
          </div>
        </div>
      </header>

      {alerts.length === 0 ? (
        <div className={`${styles.emptyState} ${styles.emptyStateCompact}`}>
          <h3>No active alerts</h3>
          <p>RevenueWatch is monitoring your connected Stripe accounts.</p>
        </div>
      ) : (
        <>
          <div className={`${styles.railViewport}${fadeClasses}`}>
            <div ref={railRef} className={styles.rail}>
              {alerts.map((alert, index) => (
                <button
                  key={alert.id}
                  ref={(element) => {
                    cardRefs.current[index] = element;
                  }}
                  type="button"
                  data-alert-card="true"
                  className={`${styles.cardButton}${index === selectedIndex ? ` ${styles.cardButtonSelected}` : ""}`}
                  onClick={() => setSelectedIndex(index)}
                >
                  <article
                    className={`${styles.card} ${
                      alert.severityKind === "critical" ? styles.cardCritical : styles.cardWarning
                    }${index === selectedIndex ? ` ${styles.cardSelected}` : ""}`}
                  >
                    <div className={styles.cardTop}>
                      <div className={styles.cardHeading}>
                        <h3 className={styles.accountName}>{alert.accountName}</h3>
                        <p className={styles.typeLabel} style={{ color: alert.typeColor }}>
                          {alert.typeLabel}
                        </p>
                      </div>
                      <span
                        className={styles.badge}
                        style={{
                          color: alert.severityTextColor,
                          background: alert.severityBgColor,
                        }}
                      >
                        {alert.severityLabel}
                      </span>
                    </div>

                    <p className={styles.message}>{alert.message}</p>

                    <div className={styles.cardFooter}>
                      <span className={styles.timeLabel}>{alert.detectedLabel}</span>
                      <span className={styles.reviewText}>Review</span>
                    </div>
                  </article>
                </button>
              ))}
            </div>
          </div>

          {selectedAlert ? (
            <SelectedAlertDetail
              alert={selectedAlert}
              canSelectLeft={canSelectLeft}
              canSelectRight={canSelectRight}
              onSelectLeft={() => moveSelection("left")}
              onSelectRight={() => moveSelection("right")}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
