export type IconName =
  | "arrow_forward"
  | "block"
  | "check_circle"
  | "encrypted"
  | "error"
  | "lock"
  | "monitoring"
  | "notifications"
  | "query_stats"
  | "schedule"
  | "shield_lock"
  | "sync"
  | "trending_down"
  | "verified"
  | "verified_user"
  | "visibility"
  | "warning";

type StitchIconProps = {
  name: IconName;
  className?: string;
  filled?: boolean;
};

function Path({ name, filled = false }: { name: IconName; filled?: boolean }) {
  const stroke = filled ? "none" : "currentColor";
  const base = {
    fill: filled ? "currentColor" : "none",
    stroke,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "monitoring":
      return (
        <>
          <path {...base} d="M3 12h4l2.2-5.2L12.8 18l2.4-6H21" />
          <path {...base} d="M12 21a9 9 0 1 1 0-18" opacity="0.85" />
        </>
      );
    case "verified":
      return (
        <>
          <path {...base} d="M12 3.5 18 6v5.3c0 4-2.5 7.6-6 9.2-3.5-1.6-6-5.2-6-9.2V6l6-2.5Z" />
          <path {...base} d="m8.8 12.2 2.1 2.1 4.4-4.6" />
        </>
      );
    case "arrow_forward":
      return (
        <>
          <path {...base} d="M5 12h12" />
          <path {...base} d="m13 6 6 6-6 6" />
        </>
      );
    case "error":
    case "warning":
      return (
        <>
          <path {...base} d="M12 4.5 20 19H4l8-14.5Z" />
          <path {...base} d="M12 9v4.6" />
          <circle cx="12" cy="16.2" r="0.9" fill="currentColor" stroke="none" />
        </>
      );
    case "visibility":
      return (
        <>
          <path {...base} d="M2.5 12s3.5-5.5 9.5-5.5S21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="3.2" {...base} />
        </>
      );
    case "block":
      return (
        <>
          <circle cx="12" cy="12" r="8.2" {...base} />
          <path {...base} d="m8.7 15.3 6.6-6.6" />
        </>
      );
    case "notifications":
      return (
        <>
          <path {...base} d="M12 4.5a4.6 4.6 0 0 0-4.6 4.6v2.2c0 .8-.2 1.6-.7 2.3L5.5 15h13l-1.2-1.4c-.5-.7-.7-1.5-.7-2.3V9.1A4.6 4.6 0 0 0 12 4.5Z" />
          <path {...base} d="M10 18a2.2 2.2 0 0 0 4 0" />
        </>
      );
    case "sync":
      return (
        <>
          <path {...base} d="M7.5 8.5A5 5 0 0 1 16 6l1.5 1.5" />
          <path {...base} d="M16.5 15.5A5 5 0 0 1 8 18l-1.5-1.5" />
          <path {...base} d="M17.5 4.8v2.9h-2.9" />
          <path {...base} d="M6.5 19.2v-2.9h2.9" />
        </>
      );
    case "query_stats":
      return (
        <>
          <path {...base} d="M5 16V9.5" />
          <path {...base} d="M10 16V7" />
          <path {...base} d="M15 16v-4.5" />
          <path {...base} d="M4 18h14" />
          <path {...base} d="m6 8.5 4-3 3.2 4 4.8-4.2" />
        </>
      );
    case "schedule":
      return (
        <>
          <circle cx="12" cy="12" r="8.2" {...base} />
          <path {...base} d="M12 7.8V12l3 1.8" />
        </>
      );
    case "trending_down":
      return (
        <>
          <path {...base} d="m5 8 5 5 4-4 5 5" />
          <path {...base} d="M19 10v4h-4" />
        </>
      );
    case "check_circle":
      return (
        <>
          <circle cx="12" cy="12" r="8.2" {...base} />
          <path {...base} d="m8.5 12.1 2.4 2.4 4.7-5" />
        </>
      );
    case "shield_lock":
      return (
        <>
          <path {...base} d="M12 3.5 18 6v5.3c0 4-2.5 7.6-6 9.2-3.5-1.6-6-5.2-6-9.2V6l6-2.5Z" />
          <rect x="9.2" y="10.7" width="5.6" height="4.5" rx="1.2" {...base} />
          <path {...base} d="M10.3 10.7V9.6a1.7 1.7 0 1 1 3.4 0v1.1" />
        </>
      );
    case "verified_user":
      return (
        <>
          <path {...base} d="M12 3.5 18 6v5.3c0 4-2.5 7.6-6 9.2-3.5-1.6-6-5.2-6-9.2V6l6-2.5Z" />
          <path {...base} d="m9 12.1 1.9 1.9 4.2-4.3" />
        </>
      );
    case "lock":
      return (
        <>
          <rect x="7.2" y="10.5" width="9.6" height="8" rx="1.6" {...base} />
          <path {...base} d="M9 10.5V8.8a3 3 0 0 1 6 0v1.7" />
        </>
      );
    case "encrypted":
      return (
        <>
          <path {...base} d="m6.5 8.5 5.5-5.5 5.5 5.5" />
          <path {...base} d="M8 12h8" />
          <path {...base} d="M10 16h4" />
          <path {...base} d="M12 8.5V20" />
        </>
      );
  }
}

export default function StitchIcon({ name, className, filled }: StitchIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
      style={{ width: "1em", height: "1em", display: "block", flexShrink: 0 }}
    >
      <Path name={name} filled={filled} />
    </svg>
  );
}
