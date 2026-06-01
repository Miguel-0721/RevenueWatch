"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import StitchIcon from "./StitchIcon";
import styles from "./DashboardShell.module.css";

const navItems = [
  { href: "/dashboard/inbox", label: "Inbox", icon: "inbox" as const, badge: "3" },
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" as const },
  { href: "/dashboard/accounts", label: "Accounts", icon: "account_balance_wallet" as const },
  { href: "/dashboard/billing", label: "Billing", icon: "payments" as const },
  { href: "#", label: "Settings", icon: "settings" as const },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard/inbox") {
    return pathname === "/dashboard/inbox" || pathname === "/dashboard/stitch-preview";
  }

  if (href === "#") {
    return false;
  }

  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardSidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const preview = searchParams.get("preview");

  return (
    <nav className={styles.sidebarNav} aria-label="Dashboard sections">
      {navItems.map((item) => {
        const active = isActivePath(pathname, item.href);

        if (item.href === "#") {
          return (
            <span key={item.label} className={styles.sidebarLink}>
              <StitchIcon name={item.icon} className={styles.sidebarIcon} />
              <span>{item.label}</span>
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={
              preview === "subscription-health"
                ? `${item.href}?preview=subscription-health`
                : item.href
            }
            className={`${styles.sidebarLink}${active ? ` ${styles.sidebarLinkActive}` : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <StitchIcon name={item.icon} className={styles.sidebarIcon} />
            <span>{item.label}</span>
            {item.badge ? <span className={styles.sidebarLinkBadge}>{item.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
