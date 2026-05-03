"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./SeverityHelpPopover.module.css";

type SeverityHelpPopoverProps = {
  alertType: "revenue_drop" | "payment_failed";
};

export default function SeverityHelpPopover({
  alertType,
}: SeverityHelpPopoverProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const body =
    alertType === "payment_failed"
      ? {
          review: "Review Needed: payment failures are around 2× higher than usual.",
          high: "High Severity: payment failures are around 4× higher than usual.",
        }
      : {
          review: "Review Needed: revenue is 30%+ lower than usual.",
          high: "High Severity: revenue is 50%+ lower than usual.",
        };

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <button
        type="button"
        className={styles.trigger}
        aria-label="How severity works"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        ?
      </button>

      {open ? (
        <div className={styles.popover} role="dialog" aria-label="How severity works">
          <h4>How severity works</h4>
          <div className={styles.body}>
            <div>{body.review}</div>
            <div>{body.high}</div>
          </div>
          <div className={styles.note}>
            RevenueWatch compares the current period with similar recent periods for this account.
          </div>
        </div>
      ) : null}
    </div>
  );
}
