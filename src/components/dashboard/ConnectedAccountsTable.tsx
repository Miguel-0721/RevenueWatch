"use client";

import { useRouter } from "next/navigation";
import styles from "@/app/dashboard/page.module.css";

type ConnectedAccountRow = {
  stripeAccountId: string;
  name: string;
  statusLabel: string;
  activeSubscriptions: number;
  estimatedMrr: string;
  activeAlerts: number;
  lastActivity: string;
  href?: string;
};

function statusTone(status: string) {
  if (status === "Attention needed") return styles.statusAttention;
  if (status === "Review needed") return styles.statusReview;
  if (status === "Monitoring active") return styles.statusMonitoring;
  return styles.statusNeutral;
}

export default function ConnectedAccountsTable({
  accounts,
}: {
  accounts: ConnectedAccountRow[];
}) {
  const router = useRouter();

  const navigateToAccount = (href?: string) => {
    if (!href) return;
    router.push(href);
  };

  return (
    <div className={styles.tableWrap}>
      <table className={styles.accountsTable}>
        <thead>
          <tr>
            <th>Account</th>
            <th>Status</th>
            <th>Active subscriptions</th>
            <th>Estimated MRR</th>
            <th>Active alerts</th>
            <th>Last activity</th>
            <th aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {accounts.length === 0 ? (
            <tr>
              <td colSpan={7} className={styles.emptyRow}>
                No connected Stripe accounts yet.
              </td>
            </tr>
          ) : (
            accounts.map((account) => {
              const isClickable = Boolean(account.href);

              return (
                <tr
                  key={account.stripeAccountId}
                  className={isClickable ? styles.accountRowClickable : undefined}
                  onClick={isClickable ? () => navigateToAccount(account.href) : undefined}
                  onKeyDown={
                    isClickable
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigateToAccount(account.href);
                          }
                        }
                      : undefined
                  }
                  tabIndex={isClickable ? 0 : undefined}
                  role={isClickable ? "link" : undefined}
                >
                  <td>
                    <div className={styles.accountCell}>
                      <span className={styles.accountLink}>{account.name}</span>
                      <small>{account.lastActivity}</small>
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.statusPill} ${statusTone(account.statusLabel)}`}>
                      {account.statusLabel}
                    </span>
                  </td>
                  <td>{account.activeSubscriptions}</td>
                  <td>{account.estimatedMrr}</td>
                  <td>{account.activeAlerts}</td>
                  <td>{account.lastActivity}</td>
                  <td className={styles.accountChevronCell} aria-hidden="true">
                    <span className={styles.accountChevron}>{"\u203a"}</span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
