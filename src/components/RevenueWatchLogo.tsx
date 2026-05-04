type RevenueWatchLogoProps = {
  className?: string;
  compact?: boolean;
};

export default function RevenueWatchLogo({
  className,
  compact = false,
}: RevenueWatchLogoProps) {
  const classes = ["rw-logo", compact ? "rw-logo-compact" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes}>
      <img
        src="/brand/revenuewatch-wordmark.png"
        alt="RevenueWatch"
        className="rw-logo-image"
      />
    </span>
  );
}
