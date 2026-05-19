"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LeadRecord } from "@/lib/leads";
import styles from "./leads.module.css";

export function LeadRowActions({ lead }: { lead: LeadRecord }) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  async function updateLead(status: string) {
    setPendingAction(status);

    await fetch(`/api/internal/leads/${lead.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
        lastContactedAt: status === "contacted" ? new Date().toISOString() : undefined,
      }),
    });

    setPendingAction(null);
    router.refresh();
  }

  return (
    <div className={styles.rowActions}>
      <div className={styles.linkCluster}>
        {lead.profileUrl ? (
          <a href={lead.profileUrl} target="_blank" rel="noreferrer">
            Open profile
          </a>
        ) : null}
        {lead.website ? (
          <a href={lead.website} target="_blank" rel="noreferrer">
            Open website
          </a>
        ) : null}
        {lead.sourceUrl ? (
          <a href={lead.sourceUrl} target="_blank" rel="noreferrer">
            Open source
          </a>
        ) : null}
      </div>

      <div className={styles.linkCluster}>
        <Link href={`/dashboard/leads/${lead.id}#reply-generator`}>Generate reply</Link>
        <button
          type="button"
          className={styles.textButton}
          disabled={pendingAction === "contacted"}
          onClick={() => updateLead("contacted")}
        >
          {pendingAction === "contacted" ? "Saving..." : "Mark contacted"}
        </button>
        <button
          type="button"
          className={styles.textButtonMuted}
          disabled={pendingAction === "skipped"}
          onClick={() => updateLead("skipped")}
        >
          {pendingAction === "skipped" ? "Saving..." : "Mark skipped"}
        </button>
      </div>
    </div>
  );
}
