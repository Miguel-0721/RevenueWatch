"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const appNavItems = [
  { label: "Dashboard", href: "/dashboard", match: "dashboard" },
  { label: "Accounts", href: "/dashboard#connected-accounts", match: "accounts" },
  { label: "Alerts", href: "/alerts", match: "alerts" },
] as const;

export default function AppNavLinks() {
  const pathname = usePathname();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);

    updateHash();
    window.addEventListener("hashchange", updateHash);

    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  const activeMatch =
    pathname === "/dashboard" && hash === "#connected-accounts"
      ? "accounts"
      : pathname === "/dashboard"
        ? "dashboard"
        : pathname?.startsWith("/alerts")
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
