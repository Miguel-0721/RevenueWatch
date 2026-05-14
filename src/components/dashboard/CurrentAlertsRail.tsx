"use client";

import SeverityHelpPopover from "@/components/SeverityHelpPopover";
import { getAlertSensitivityConfig } from "@/lib/alert-sensitivity";
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
  criticalThreshold: number | null;
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
  reviewThresholdValue: number;
  highSeverityThresholdValue: number;
  peakValue: number;
  lowValue: number;
  activeIndex: number;
  windowLabel: string;
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
  failures: number;
  normalFailures: number | null;
  threshold: number;
  criticalThreshold: number | null;
  windowLabel: string;
  peakFailures: number;
  activeIndex: number;
};

type SeverityPresentation = ReturnType<typeof getSeverityPresentation>;
type ThresholdDisplayMode = "review-only" | "both" | "critical-only";

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

function getNiceChartMax(value: number) {
  const padded = Math.max(2, value * 1.2);
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const normalized = padded / magnitude;
  const niceFactors = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const factor = niceFactors.find((candidate) => candidate >= normalized) ?? 10;

  return factor * magnitude;
}

function chooseFailureAxisStep(targetMax: number, highlightedValues: number[]) {
  const niceSteps = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 100];
  const candidates = niceSteps.filter((step) => step * 5 >= targetMax);

  const scored = candidates.map((step) => {
    const penalty = highlightedValues.reduce((score, value) => {
      if (!Number.isFinite(value) || value <= 0) return score;
      const remainder = value % step;
      const distance = Math.min(remainder, step - remainder);
      return score + distance;
    }, 0);

    return {
      step,
      maxValue: step * 5,
      penalty,
    };
  });

  scored.sort((a, b) => a.penalty - b.penalty || a.maxValue - b.maxValue);
  return scored[0]?.step ?? 1;
}

function buildFailureAxis(model: FailureChartModel, highlightedValues: number[]) {
  const relevantValues = [
    model.failures,
    model.normalFailures ?? 0,
    model.threshold,
    model.criticalThreshold ?? 0,
    model.peakFailures,
    ...model.points.map((point) => point.failures),
  ].filter((value) => Number.isFinite(value) && value >= 0);
  const relevantMax = Math.max(0, ...relevantValues);
  const targetMax = getNiceChartMax(relevantMax);
  const step = chooseFailureAxisStep(targetMax, highlightedValues);
  const top = step * 5;
  const ticks = Array.from({ length: 6 }, (_, index) => index * step);

  return {
    maxValue: top,
    ticks,
  };
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
        : Math.round(baselineAmount * 0.7),
    windowLabel:
      typeof parsed.window === "string" ? parsed.window : "current monitoring window",
    currency:
      typeof parsed.currency === "string"
        ? normalizeCurrencyCode(parsed.currency)
        : "EUR",
  };
}

function getThresholdDisplayMode(severity?: string | null): ThresholdDisplayMode {
  if (severity === "critical" || severity === "warning") return "both";
  return "review-only";
}

function getPaymentFailureContext(alert?: CurrentAlertRailItem | null): PaymentFailureContext | null {
  if (!alert || alert.type !== "payment_failed") return null;

  const parsed = safeParseContext(alert.context);
  if (!parsed) return null;
  const config = getAlertSensitivityConfig();

  const failures =
    typeof parsed.failuresCounted === "number"
      ? parsed.failuresCounted
      : typeof parsed.failedPayments === "number"
        ? parsed.failedPayments
        : typeof parsed.currentFailures === "number"
          ? parsed.currentFailures
          : null;

  if (failures === null) return null;

  const normalFailures =
    typeof parsed.normalFailures === "number"
      ? parsed.normalFailures
      : typeof parsed.baseline === "number"
        ? parsed.baseline
        : null;
  const threshold =
    typeof parsed.failureThreshold === "number"
      ? parsed.failureThreshold
      : normalFailures !== null
        ? normalFailures * config.failureSpikeMultiplier
        : config.failureFallbackMinCurrent;
  const baselineFloor =
    typeof parsed.baselineFloor === "number"
      ? parsed.baselineFloor
      : config.failureBaselineFloor;
  const criticalMultiplier = config.failureCriticalMultiplier;
  const reviewMultiplier =
    typeof parsed.failureSpikeMultiplier === "number" && parsed.failureSpikeMultiplier > 0
      ? parsed.failureSpikeMultiplier
      : config.failureSpikeMultiplier;
  const criticalThreshold =
    normalFailures !== null
      ? Math.round(Math.max(normalFailures, baselineFloor) * criticalMultiplier)
      : typeof parsed.failureSpikeMultiplier === "number" && parsed.failureSpikeMultiplier > 0
        ? Math.round(threshold * (criticalMultiplier / reviewMultiplier))
        : null;

  return {
    failures,
    normalFailures,
    threshold,
    criticalThreshold,
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
  const reviewThresholdValue =
    revenueContext?.alertThresholdAmount ?? Math.round(expectedValue * 0.7);
  const highSeverityThresholdValue = Math.round(expectedValue * 0.5);
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
    const triggerIndex = revenueSeries.findIndex((point) => point.revenue <= reviewThresholdValue);
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
      reviewThresholdValue,
      highSeverityThresholdValue,
      peakValue: Math.max(...actualValues),
      lowValue: Math.min(...actualValues),
      activeIndex: points.length - 1,
      windowLabel: revenueContext?.windowLabel ?? "current monitoring window",
      isAlerting: latestValue < reviewThresholdValue,
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
    reviewThresholdValue,
    highSeverityThresholdValue,
    peakValue: Math.max(...points.map((point) => point.actual)),
    lowValue: Math.min(...points.map((point) => point.actual)),
    activeIndex: points.length - 1,
    windowLabel: revenueContext?.windowLabel ?? "current monitoring window",
    isAlerting: actualValue < reviewThresholdValue,
    currency: revenueContext?.currency ?? "EUR",
  };
}

function buildFailureChartModel(
  alert: CurrentAlertRailItem,
  paymentContext: PaymentFailureContext | null
): FailureChartModel {
  const parsed = safeParseContext(alert.context);
  const failures = paymentContext?.failures ?? 0;
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
      failures,
      normalFailures: paymentContext?.normalFailures ?? null,
      threshold,
      criticalThreshold: paymentContext?.criticalThreshold ?? null,
      windowLabel: paymentContext?.windowLabel ?? "current monitoring window",
      peakFailures: Math.max(...points.map((point) => point.failures)),
      activeIndex: points.length - 1,
    };
  }

  const points = Array.from({ length: 6 }, (_, index) => ({
    index,
    label: `${String((10 + index) % 24).padStart(2, "0")}:00`,
    failures: index === 5 ? failures : Math.max(0, Math.round(failures * (index / 9))),
  }));

  return {
    points,
    failures,
    normalFailures: paymentContext?.normalFailures ?? null,
    threshold,
    criticalThreshold: paymentContext?.criticalThreshold ?? null,
    windowLabel: paymentContext?.windowLabel ?? "current monitoring window",
    peakFailures: Math.max(...points.map((point) => point.failures)),
    activeIndex: points.length - 1,
  };
}

function FailureChart({
  model,
  severity,
  thresholdDisplayMode,
}: {
  model: FailureChartModel;
  severity: SeverityPresentation;
  thresholdDisplayMode: ThresholdDisplayMode;
}) {
  const showReviewThreshold = thresholdDisplayMode !== "critical-only";
  const showCriticalThreshold =
    thresholdDisplayMode !== "review-only" && model.criticalThreshold !== null;
  const highlightedValues = [
    ...(showReviewThreshold ? [model.threshold] : []),
    ...(showCriticalThreshold && model.criticalThreshold !== null
      ? [model.criticalThreshold]
      : []),
  ];
  const axis = buildFailureAxis(model, highlightedValues);
  const countTicks = axis.ticks;
  const maxValue = axis.maxValue;
  const plotInsetTop = 22;
  const plotInsetBottom = 48;
  const plotInsetTotal = plotInsetTop + plotInsetBottom;
  const thresholdRatio = Math.min(1, Math.max(0, model.threshold / maxValue));
  const criticalThresholdRatio =
    showCriticalThreshold && model.criticalThreshold !== null
      ? Math.min(1, Math.max(0, model.criticalThreshold / maxValue))
      : null;
  const plotPositionCss = (ratio: number, offsetPx = 0) =>
    `calc(${plotInsetBottom}px + (100% - ${plotInsetTotal}px) * ${ratio}${offsetPx === 0 ? "" : ` ${offsetPx < 0 ? "-" : "+"} ${Math.abs(offsetPx)}px`})`;
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
        {countTicks.map((tick) => (
          <div
            key={`grid-${tick}`}
            className={detailStyles.failureGridLine}
            style={{
              bottom: plotPositionCss(Math.min(1, Math.max(0, tick / maxValue))),
            }}
          />
        ))}
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
        {showReviewThreshold ? (
          <>
            <div
              className={detailStyles.failureThresholdLine}
              style={{
                bottom: plotPositionCss(thresholdRatio),
                borderTopColor: "#b7791f",
              }}
            />
            <div
              className={detailStyles.failureThreshold}
              style={{
                left: `${thresholdChipCenter}%`,
                bottom: plotPositionCss(thresholdRatio, -10),
                background: "#fff1c2",
                color: "#9a6700",
              }}
            >
              Review threshold: {formatCount(model.threshold)}
            </div>
          </>
        ) : null}
        {criticalThresholdRatio !== null ? (
          <>
            <div
              className={detailStyles.failureThresholdLine}
              style={{
                bottom: plotPositionCss(criticalThresholdRatio),
                borderTopColor: "#ba1a1a",
              }}
            />
            <div
              className={detailStyles.failureThreshold}
              style={{
                left: `${thresholdChipCenter}%`,
                bottom: plotPositionCss(criticalThresholdRatio, -10),
                background: "#ffdad6",
                color: "#ba1a1a",
              }}
            >
              Critical threshold: {formatCount(model.criticalThreshold ?? 0)}
            </div>
          </>
        ) : null}

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
          {showReviewThreshold ? (
            <span>
              <i className={detailStyles.legendDashAmber} /> Review threshold
            </span>
          ) : null}
          {showCriticalThreshold ? (
            <span>
              <i className={detailStyles.legendDashRed} /> Critical threshold
            </span>
          ) : null}
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
  const thresholdDisplayMode = getThresholdDisplayMode(alert.severityKind);

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
            {thresholdDisplayMode !== "critical-only" ? (
              <div className={detailStyles.panelMetric}>
                <span>Review threshold</span>
                <strong>{formatCount(paymentContext.threshold)}</strong>
              </div>
            ) : null}
            {thresholdDisplayMode !== "review-only" && paymentContext.criticalThreshold !== null ? (
              <div className={detailStyles.panelMetric}>
                <span>Critical threshold</span>
                <strong>{formatCount(paymentContext.criticalThreshold)}</strong>
              </div>
            ) : null}
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
            {thresholdDisplayMode !== "critical-only" ? (
              <div className={detailStyles.panelMetric}>
                <span>Review threshold</span>
                <strong>{formatMoneyAmount(model.reviewThresholdValue, model.currency)}</strong>
              </div>
            ) : null}
            {thresholdDisplayMode !== "review-only" ? (
              <div className={detailStyles.panelMetric}>
                <span>Critical threshold</span>
                <strong>{formatMoneyAmount(model.highSeverityThresholdValue, model.currency)}</strong>
              </div>
            ) : null}
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
            <FailureChart
              model={failureModel}
              severity={severity}
              thresholdDisplayMode={getThresholdDisplayMode(alert.severityKind)}
            />
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

function RevenueChartFigure({
  model,
  severity,
  thresholdDisplayMode,
  expandedHeight = false,
}: {
  model: RevenueChartModel;
  severity: SeverityPresentation;
  thresholdDisplayMode: ThresholdDisplayMode;
  expandedHeight?: boolean;
}) {
  const width = 1000;
  const height = 300;
  const plot = { left: 74, right: 980, top: 18, bottom: 246 };
  const plotWidth = plot.right - plot.left;
  const plotHeight = plot.bottom - plot.top;
  const maxValue =
    Math.max(
      ...model.points.flatMap((point) => [point.expected, point.actual]),
      model.reviewThresholdValue,
      model.highSeverityThresholdValue
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
    model.points.find((point) => point.actual <= model.reviewThresholdValue) ?? activePoint;
  const reviewThresholdY = y(model.reviewThresholdValue);
  const highSeverityThresholdY = y(model.highSeverityThresholdValue);
  const showReviewThreshold = thresholdDisplayMode !== "critical-only";
  const showCriticalThreshold = thresholdDisplayMode !== "review-only";
  const showWarningZone =
    showReviewThreshold && showCriticalThreshold && severity.accentColor !== "#ba1a1a";
  const showCriticalZone =
    showCriticalThreshold && severity.accentColor === "#ba1a1a";
  const yTicks = buildMoneyTicks(maxValue);
  const xTickIndexes = buildTickIndexes(model.points.length);
  const triggerX = x(triggerPoint.index);
  const triggerY = y(triggerPoint.actual);
  const thresholdLabelX = plot.left + plotWidth / 2;
  const reviewThresholdColor = "#b7791f";
  const reviewThresholdSoft = "#fff1c2";
  const reviewThresholdShadow = "rgba(154, 103, 0, 0.12)";
  const highSeverityThresholdColor = "#ba1a1a";
  const highSeverityThresholdSoft = "#ffdad6";
  const highSeverityThresholdShadow = "rgba(186, 26, 26, 0.1)";

  return (
    <>
      <div className={`${detailStyles.chartWrap} ${expandedHeight ? detailStyles.chartWrapExpanded : ""}`.trim()}>
        {showReviewThreshold ? (
          <div
            className={detailStyles.thresholdPill}
            style={{
              top: `${(reviewThresholdY / height) * 100}%`,
              left: `${(thresholdLabelX / width) * 100}%`,
              background: reviewThresholdSoft,
              color: reviewThresholdColor,
              boxShadow: `0 1px 2px ${reviewThresholdShadow}`,
            }}
          >
            Review threshold ({formatMoneyAmount(model.reviewThresholdValue, model.currency)})
          </div>
        ) : null}
        {showCriticalThreshold ? (
          <div
            className={detailStyles.thresholdPill}
            style={{
              top: `${(highSeverityThresholdY / height) * 100}%`,
              left: `${(thresholdLabelX / width) * 100}%`,
              background: highSeverityThresholdSoft,
              color: highSeverityThresholdColor,
              boxShadow: `0 1px 2px ${highSeverityThresholdShadow}`,
            }}
          >
            Critical threshold ({formatMoneyAmount(model.highSeverityThresholdValue, model.currency)})
          </div>
        ) : null}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className={detailStyles.chartSvg}
          role="img"
          aria-label="Revenue chart showing current revenue and threshold levels"
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

          {showWarningZone ? (
            <rect
              x={plot.left}
              y={reviewThresholdY}
              width={plot.right - plot.left}
              height={Math.max(0, highSeverityThresholdY - reviewThresholdY)}
              style={{ fill: "rgba(154, 103, 0, 0.035)" }}
            />
          ) : null}
          {showCriticalZone ? (
            <rect
              x={plot.left}
              y={highSeverityThresholdY}
              width={plot.right - plot.left}
              height={plot.bottom - highSeverityThresholdY}
              style={{ fill: "rgba(186, 26, 26, 0.04)" }}
            />
          ) : null}
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
          {showReviewThreshold ? (
            <line
              x1={plot.left}
              x2={plot.right}
              y1={reviewThresholdY}
              y2={reviewThresholdY}
              style={{
                fill: "none",
                stroke: reviewThresholdColor,
                strokeWidth: 1.5,
                strokeDasharray: "9 6",
                strokeLinecap: "round",
                strokeLinejoin: "round",
              }}
            />
          ) : null}
          {showCriticalThreshold ? (
            <line
              x1={plot.left}
              x2={plot.right}
              y1={highSeverityThresholdY}
              y2={highSeverityThresholdY}
              style={{
                fill: "none",
                stroke: highSeverityThresholdColor,
                strokeWidth: 1.5,
                strokeDasharray: "9 6",
                strokeLinecap: "round",
                strokeLinejoin: "round",
              }}
            />
          ) : null}
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
          {showReviewThreshold ? (
            <span>
              <i className={detailStyles.legendDashAmber} /> Review threshold ({formatMoneyAmount(model.reviewThresholdValue, model.currency)})
            </span>
          ) : null}
          {showCriticalThreshold ? (
            <span>
              <i className={detailStyles.legendDashRed} /> Critical threshold ({formatMoneyAmount(model.highSeverityThresholdValue, model.currency)})
            </span>
          ) : null}
        </div>
      </div>
    </>
  );
}

function AlertsEmptyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? styles.emptyStateIcon}>
      <path
        fill="currentColor"
        d="M12 2 5 5v6c0 5 3.4 9.74 7 11 3.6-1.26 7-6 7-11V5l-7-3Zm0 3.1 4.8 2.06v3.83c0 3.88-2.5 7.82-4.8 9-2.3-1.18-4.8-5.12-4.8-9V7.16L12 5.1Zm-.9 3.4v4.2h1.8V8.5h-1.8Zm0 5.6v1.8h1.8v-1.8h-1.8Z"
      />
    </svg>
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

          <RevenueChartFigure
            model={model}
            severity={severity}
            thresholdDisplayMode={getThresholdDisplayMode(alert.severityKind)}
            expandedHeight
          />
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
        <div className={styles.headerTitle}>
          <div className={styles.headerTitleRow}>
            <AlertsEmptyIcon className={styles.sectionIcon} />
            <div>
              <h2 className={styles.title}>Current alerts</h2>
              <p className={styles.intro}>Review the accounts that need attention right now.</p>
            </div>
          </div>
        </div>

        <div className={styles.controls}>
          <span className={styles.count}>{pendingLabel}</span>
          {alerts.length > 0 ? (
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
          ) : null}
        </div>
      </header>

      {alerts.length === 0 ? (
        <div className={styles.emptyStateSurface}>
          <div className={styles.emptyStateCard}>
            <div className={styles.emptyStateIconWrap}>
              <AlertsEmptyIcon />
            </div>
            <div className={styles.emptyStateCopy}>
              <h3>No active alerts</h3>
              <p>
                RevenueWatch is monitoring your connected Stripe accounts. Any alerts that need
                review will appear here.
              </p>
            </div>
          </div>
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
