type RevenueWatchLogoProps = {
  className?: string;
  compact?: boolean;
  size?: "default" | "header" | "footer" | "sidebar";
};

export default function RevenueWatchLogo({
  className,
  compact = false,
  size = "default",
}: RevenueWatchLogoProps) {
  const classes = [
    "rw-logo",
    compact ? "rw-logo-compact" : "",
    `rw-logo-${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} aria-label="Parveil">
      <span className="rw-logo-frame">
        <img
          src="/parveil-logo.png"
          alt="Parveil"
          className="rw-logo-image"
        />
      </span>
    </span>
  );
}
