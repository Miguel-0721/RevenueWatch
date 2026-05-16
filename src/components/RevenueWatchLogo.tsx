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
    <span className={classes} aria-label="Parveil">
      <span className="rw-logo-wordmark">Parveil</span>
    </span>
  );
}
