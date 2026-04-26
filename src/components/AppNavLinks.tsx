"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const appNavItems = [
  { label: "Dashboard", href: "/dashboard", match: "dashboard" },
  { label: "Alerts", href: "/alerts", match: "alerts" },
] as const;

export default function AppNavLinks() {
  const pathname = usePathname();

  const activeMatch =
    pathname?.startsWith("/alerts")
      ? "alerts"
      : "dashboard";

  return (
    <nav className="rw-app-nav" aria-label="Product">
      {appNavItems.map((item) => {
        const isActive = item.match === activeMatch;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`rw-app-nav-link${isActive ? " rw-app-nav-link-active" : ""}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
