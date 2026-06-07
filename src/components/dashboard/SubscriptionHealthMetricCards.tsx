import Link from "next/link";
import type { CSSProperties } from "react";
import styles from "@/app/dashboard/page.module.css";

const DASHBOARD_ACTIVE_SPARKLINE = [18, 20, 19, 25, 23, 28] as const;
const DASHBOARD_MRR_SPARKLINE = [14, 15, 17, 16, 20, 22] as const;
const METRIC_SPARKLINE_STROKE_WIDTH = 1.25;
const METRIC_SPARKLINE_VERTICAL_SCALE = 1.56;
const METRIC_SPARKLINE_STYLE = {
  "--metric-sparkline-stroke-width": String(METRIC_SPARKLINE_STROKE_WIDTH),
  "--metric-sparkline-vertical-scale": String(METRIC_SPARKLINE_VERTICAL_SCALE),
} as CSSProperties;

type MetricSparklineProps = {
  points: number[];
};

export type MetricCardProps = {
  label: string;
  value: string | number;
  helper: string;
  badgeLabel?: string;
  periodLabel?: string;
  sparkline?: number[];
  compact?: boolean;
  tone?: "default" | "review" | "risk";
  tooltip?: string;
  href?: string;
  ariaLabel?: string;
};

export type SecondaryMetricCardProps = {
  label: string;
  value: string | number;
  helper: string;
  toneClassName: string;
  tooltip?: string;
  href?: string;
  ariaLabel?: string;
};

export function getDashboardSparklinePoints(variant: "active" | "mrr") {
  return [...(variant === "active" ? DASHBOARD_ACTIVE_SPARKLINE : DASHBOARD_MRR_SPARKLINE)];
}

export function buildDashboardSparklineSeries({
  variant,
  finalValue,
}: {
  variant: "active" | "mrr";
  finalValue: number;
}) {
  const template = getDashboardSparklinePoints(variant);
  const safeFinalValue = Math.max(0, Math.round(finalValue));

  if (safeFinalValue <= 0) {
    return template;
  }

  const templateLastPoint = template[template.length - 1] || 1;

  return template.map((point) => Math.max(0, Math.round((safeFinalValue * point) / templateLastPoint)));
}

function MetricSparkline({ points }: MetricSparklineProps) {
  if (points.length < 2) {
    return null;
  }

  const width = 272;
  const height = 40;
  const insetTop = 0;
  const insetRight = 2;
  const insetBottom = 0;
  const insetLeft = 2;
  const minValue = Math.min(...points);
  const maxValue = Math.max(...points);
  const range = maxValue - minValue || 1;
  const usableWidth = width - insetLeft - insetRight;
  const usableHeight = height - insetTop - insetBottom;
  const stepX = usableWidth / (points.length - 1);

  const path = points.reduce((segments, point, index) => {
    const x = Number((insetLeft + index * stepX).toFixed(2));
    const normalized = (point - minValue) / range;
    const y = Number((insetTop + (1 - normalized) * usableHeight).toFixed(2));
    return `${segments}${index === 0 ? "M" : " L"}${x} ${y}`;
  }, "");

  return (
    <svg
      className={styles.metricSparkline}
      viewBox={`0 0 ${width} ${height}`}
      style={METRIC_SPARKLINE_STYLE}
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
}

export function InfoTooltip({ text }: { text: string }) {
  const tooltipId = `dashboard-tooltip-${text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;

  return (
    <span className={styles.infoTooltipWrap}>
      <button
        type="button"
        className={styles.infoTooltip}
        aria-label={text}
        aria-describedby={tooltipId}
      >
        i
      </button>
      <span id={tooltipId} role="tooltip" className={styles.infoTooltipBubble}>
        {text}
      </span>
    </span>
  );
}

export function MetricCard({
  label,
  value,
  helper,
  badgeLabel,
  periodLabel,
  sparkline,
  compact = false,
  tone = "default",
  tooltip,
  href,
  ariaLabel,
}: MetricCardProps) {
  const toneClass =
    tone === "review"
      ? styles.metricBadgeReview
      : tone === "risk"
        ? styles.metricBadgeRisk
        : styles.metricTrendPill;

  return (
    <article
      className={`${styles.metricCard} ${compact ? styles.metricCardCompact : styles.metricCardLarge} ${
        href ? styles.clickableCard : ""
      }`}
    >
      {href ? (
        <Link
          href={href}
          className={styles.cardOverlayLink}
          aria-label={ariaLabel ?? `View ${label.toLowerCase()} details`}
        />
      ) : null}
      <div className={styles.metricCardHeader}>
        <span className={styles.metricLabelRow}>
          <span className={styles.metricLabel}>{label}</span>
          {periodLabel ? <span className={styles.metricPeriodPill}>{periodLabel}</span> : null}
          {tooltip ? <InfoTooltip text={tooltip} /> : null}
        </span>
        {badgeLabel ? <span className={toneClass}>{badgeLabel}</span> : null}
      </div>
      <strong className={compact ? styles.metricValueSmall : styles.metricValue}>{value}</strong>
      {!compact ? (
        <div className={styles.metricSparklineWrap}>
          {sparkline ? <MetricSparkline points={sparkline} /> : null}
        </div>
      ) : null}
      <small className={styles.metricHelper}>{helper}</small>
    </article>
  );
}

export function SecondaryMetricCard({
  label,
  value,
  helper,
  toneClassName,
  tooltip,
  href,
  ariaLabel,
}: SecondaryMetricCardProps) {
  return (
    <article
      className={`${styles.secondaryCard} ${toneClassName} ${href ? styles.clickableCard : ""}`}
    >
      {href ? (
        <Link
          href={href}
          className={styles.cardOverlayLink}
          aria-label={ariaLabel ?? `View ${label.toLowerCase()} details`}
        />
      ) : null}
      <span className={styles.secondaryLabelRow}>
        <span>{label}</span>
        {tooltip ? <InfoTooltip text={tooltip} /> : null}
      </span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}
