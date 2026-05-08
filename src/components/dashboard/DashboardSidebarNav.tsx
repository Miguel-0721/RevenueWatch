"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./DashboardShell.module.css";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.sidebarNavIcon}>
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.75 4.75h6.5v6.5h-6.5Zm8 0h6.5v4.5h-6.5Zm0 6h6.5v8.5h-6.5Zm-8 8.5h6.5v-4.5h-6.5Z"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/alerts",
    label: "Alerts",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.sidebarNavIcon}>
        <path
          fill="currentColor"
          d="M12 22a2.49 2.49 0 0 0 2.45-2h-4.9A2.49 2.49 0 0 0 12 22Zm7-6V11a7 7 0 1 0-14 0v5l-2 2v1h18v-1l-2-2Z"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/accounts",
    label: "Accounts",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.sidebarNavIcon}>
        <path
          fill="currentColor"
          d="M12 2 5 5v6c0 5 3.4 9.74 7 11 3.6-1.26 7-6 7-11V5l-7-3Zm0 9.25a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5Zm3.5 4.25h-7v-.4c0-1.63 2.34-2.6 3.5-2.6s3.5.97 3.5 2.6v.4Z"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/billing",
    label: "Billing",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.sidebarNavIcon}>
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.75 7.25h14.5a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-1.5 1.5H4.75a1.5 1.5 0 0 1-1.5-1.5v-6.5a1.5 1.5 0 0 1 1.5-1.5Zm0 3.5h16"
        />
      </svg>
    ),
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.sidebarNav} aria-label="Dashboard sections">
      {navItems.map((item) => {
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.sidebarLink}${active ? ` ${styles.sidebarLinkActive}` : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
