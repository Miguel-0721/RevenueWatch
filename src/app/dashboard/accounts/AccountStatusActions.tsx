"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import styles from "./AccountStatusActions.module.css";

type AccountStatus = "active" | "paused" | "disconnected";
type AccountAction = "pause" | "resume" | "disconnect";

type AccountStatusActionsProps = {
  stripeAccountId: string;
  status: AccountStatus;
  align?: "right" | "left";
  label?: string;
  variant?: "compact" | "header";
};

const DISCONNECT_CONFIRMATION =
  "Disconnect this account from Parveil?\n\nThis removes the account from active monitoring in Parveil. No changes are made to your Stripe account, and historical Parveil data is kept.";

function getActionCopy(action: AccountAction) {
  if (action === "pause") {
    return "Stops monitoring and alert emails for this account. No changes are made to Stripe.";
  }

  if (action === "resume") {
    return "Starts monitoring this account again.";
  }

  return "This removes the account from active monitoring in Parveil. No changes are made to your Stripe account, and historical Parveil data is kept.";
}

export function AccountStatusActions({
  stripeAccountId,
  status,
  align = "right",
  label = "Manage",
  variant = "compact",
}: AccountStatusActionsProps) {
  const router = useRouter();
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const [loadingAction, setLoadingAction] = useState<AccountAction | null>(null);

  async function handleAction(action: AccountAction) {
    if (loadingAction) return;

    if (action === "disconnect" && !window.confirm(DISCONNECT_CONFIRMATION)) {
      return;
    }

    setLoadingAction(action);

    try {
      const response = await fetch("/api/stripe/account-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stripeAccountId,
          action,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        window.alert(payload?.error || "We couldn't update that account.");
        return;
      }

      detailsRef.current?.removeAttribute("open");
      router.refresh();
    } catch {
      window.alert("We couldn't update that account.");
    } finally {
      setLoadingAction(null);
    }
  }

  if (status === "disconnected") {
    return null;
  }

  const isPaused = status === "paused";
  const primaryAction: AccountAction = isPaused ? "resume" : "pause";
  const primaryLabel = isPaused ? "Resume monitoring" : "Pause monitoring";

  return (
    <details
      ref={detailsRef}
      className={`${styles.root} ${align === "left" ? styles.alignLeft : ""} ${
        variant === "header" ? styles.headerVariant : ""
      }`}
    >
      <summary className={styles.trigger}>
        {label}
        <span className={styles.caret} aria-hidden="true" />
      </summary>

      <div className={styles.menu}>
        <div className={styles.menuLabel}>Account actions</div>

        <button
          type="button"
          className={styles.menuAction}
          onClick={() => handleAction(primaryAction)}
          disabled={loadingAction !== null}
        >
          <span className={styles.menuActionTitle}>
            {loadingAction === primaryAction
              ? primaryAction === "resume"
                ? "Resuming..."
                : "Pausing..."
              : primaryLabel}
          </span>
        </button>

        <div className={styles.menuDivider} />

        <button
          type="button"
          className={styles.menuActionDanger}
          onClick={() => handleAction("disconnect")}
          disabled={loadingAction !== null}
        >
          <span className={styles.menuActionDangerTitle}>
            {loadingAction === "disconnect" ? "Disconnecting..." : "Disconnect account"}
          </span>
        </button>
      </div>
    </details>
  );
}
