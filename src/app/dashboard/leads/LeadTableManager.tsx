"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { LeadRecord } from "@/lib/leads";
import { LeadRowActions } from "./LeadRowActions";
import styles from "./leads.module.css";

function scoreLabel(score: number) {
  if (score >= 8) return "Very strong";
  if (score >= 6) return "Strong";
  if (score >= 4) return "Possible fit";
  return "Low fit";
}

function formatSource(source: string) {
  return source.replace(/_/g, " ");
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

type PendingAction = "delete-selected" | "clear-skipped" | "clear-all" | null;

export function LeadTableManager({ leads }: { leads: LeadRecord[] }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const leadIds = useMemo(() => leads.map((lead) => lead.id), [leads]);
  const allSelected = leadIds.length > 0 && selectedIds.length === leadIds.length;

  function toggleLead(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  }

  function toggleAll() {
    setSelectedIds((current) => (current.length === leadIds.length ? [] : leadIds));
  }

  async function runBulkDelete() {
    if (selectedIds.length === 0) {
      setError("Select at least one lead to delete.");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedIds.length} selected lead${selectedIds.length === 1 ? "" : "s"}? This only removes Parveil Leads records.`
    );
    if (!confirmed) return;

    setPendingAction("delete-selected");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/internal/leads/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: selectedIds }),
      });

      const payload = await response.json();
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Could not delete the selected leads.");
      }

      setSelectedIds([]);
      setNotice(`Deleted ${payload.deletedCount} lead${payload.deletedCount === 1 ? "" : "s"}.`);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not delete the selected leads."
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function runCleanup(mode: "skipped" | "all") {
    const confirmationMessage =
      mode === "all"
        ? "This will permanently delete all Parveil Leads records. It will not affect Stripe monitoring data. Continue?"
        : "Delete all skipped Parveil Leads records? This will not affect Stripe monitoring data.";

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    setPendingAction(mode === "all" ? "clear-all" : "clear-skipped");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/internal/leads/cleanup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode }),
      });

      const payload = await response.json();
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Cleanup failed.");
      }

      setSelectedIds([]);
      setNotice(
        mode === "all"
          ? `Deleted all ${payload.deletedCount} Parveil Leads record${payload.deletedCount === 1 ? "" : "s"}.`
          : `Deleted ${payload.deletedCount} skipped lead${payload.deletedCount === 1 ? "" : "s"}.`
      );
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Cleanup failed.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <div className={styles.bulkActionBar}>
        <div className={styles.bulkActionMeta}>
          <strong>{selectedIds.length}</strong>
          <span>selected</span>
        </div>

        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={pendingAction !== null || selectedIds.length === 0}
            onClick={runBulkDelete}
          >
            {pendingAction === "delete-selected" ? "Deleting..." : "Delete selected"}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={pendingAction !== null}
            onClick={() => runCleanup("skipped")}
          >
            {pendingAction === "clear-skipped" ? "Clearing..." : "Clear skipped leads"}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={pendingAction !== null}
            onClick={() => runCleanup("all")}
          >
            {pendingAction === "clear-all" ? "Clearing..." : "Clear all leads"}
          </button>
        </div>
      </div>

      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {error ? <div className={styles.noticeMuted}>{error}</div> : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.checkboxColumn}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  aria-label="Select all leads"
                  onChange={toggleAll}
                />
              </th>
              <th>Lead</th>
              <th>Source</th>
              <th>Signals</th>
              <th>Score</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td className={styles.checkboxColumn}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(lead.id)}
                    aria-label={`Select ${lead.name}`}
                    onChange={() => toggleLead(lead.id)}
                  />
                </td>
                <td>
                  <div className={styles.leadCell}>
                    <Link href={`/dashboard/leads/${lead.id}`} className={styles.leadLink}>
                      {lead.name}
                    </Link>
                    <span>{lead.productName || lead.handle || lead.website || "No product yet"}</span>
                  </div>
                </td>
                <td className={styles.mutedCell}>{formatSource(lead.source)}</td>
                <td>
                  <div className={styles.signalList}>
                    {(lead.painSignals || []).slice(0, 3).map((signal) => (
                      <span key={signal} className={styles.signalChip}>
                        {signal.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <div className={styles.scoreCell}>
                    <strong>{lead.score}/10</strong>
                    <span>{scoreLabel(lead.score)}</span>
                  </div>
                </td>
                <td>
                  <span className={styles.statusBadge}>{formatStatus(lead.status)}</span>
                </td>
                <td>
                  <LeadRowActions lead={lead} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
