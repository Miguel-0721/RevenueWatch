"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LeadCandidate } from "@/lib/leads";
import styles from "./leads.module.css";

type ScanState = {
  loadingMode: "product-hunt" | "x" | "both" | null;
  message: string | null;
  candidates: LeadCandidate[];
};

function buildInitialState(initialCandidates: LeadCandidate[]): ScanState {
  return {
    loadingMode: null,
    message: null,
    candidates: initialCandidates,
  };
}

export function DiscoverLeadsPanel({ initialCandidates }: { initialCandidates: LeadCandidate[] }) {
  const router = useRouter();
  const [state, setState] = useState<ScanState>(() => buildInitialState(initialCandidates));
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function runScan(mode: "product-hunt" | "x" | "both") {
    setState((current) => ({ ...current, loadingMode: mode, message: null }));

    try {
      const response = await fetch(`/api/internal/leads/discover/${mode}`, {
        method: "POST",
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        setState({
          loadingMode: null,
          message: payload?.error ?? payload?.message ?? "Could not run discovery.",
          candidates: payload?.candidates ?? [],
        });
        return;
      }

      setState({
        loadingMode: null,
        message: payload?.message ?? "Scan complete.",
        candidates: payload?.candidates ?? [],
      });
      return;
    } catch (error) {
      setState({
        loadingMode: null,
        message: error instanceof Error ? error.message : "Could not run discovery.",
        candidates: [],
      });
    }
  }

  async function saveCandidate(candidate: LeadCandidate, status: "saved" | "skipped") {
    const key =
      candidate.postUrl || candidate.sourceUrl || candidate.profileUrl || candidate.website || candidate.name;
    setSavingKey(`${status}:${key}`);

    await fetch("/api/internal/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...candidate,
        status,
      }),
    });

    setState((current) => ({
      ...current,
      candidates: current.candidates.filter((entry) => {
        const entryKey =
          entry.postUrl || entry.sourceUrl || entry.profileUrl || entry.website || entry.name;
        return entryKey !== key;
      }),
      message:
        status === "saved"
          ? "Lead marked as saved."
          : "Lead marked as skipped.",
    }));
    setSavingKey(null);
    router.refresh();
  }

  async function clearDiscoveredCandidates() {
    const confirmed = window.confirm(
      "This will permanently delete unreviewed Product Hunt leads with status new. It will not affect saved, skipped, contacted, or Stripe monitoring data. Continue?"
    );
    if (!confirmed) return;

    setState((current) => ({ ...current, loadingMode: "product-hunt", message: null }));

    try {
      const response = await fetch("/api/internal/leads/cleanup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: "product-hunt-new" }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error ?? "Could not clear discovered candidates.");
      }

      setState({
        loadingMode: null,
        message: `Cleared ${payload.deletedCount} unreviewed Product Hunt candidate${payload.deletedCount === 1 ? "" : "s"}.`,
        candidates: [],
      });
      router.refresh();
    } catch (error) {
      setState((current) => ({
        ...current,
        loadingMode: null,
        message: error instanceof Error ? error.message : "Could not clear discovered candidates.",
      }));
    }
  }

  const loadingDiscoveryCopy =
    state.loadingMode === "product-hunt" || state.loadingMode === "both"
      ? "Running a deeper ranked scan. Product Hunt may take a bit longer when pulling up to 100 candidates."
      : null;

  return (
    <div className={styles.discoverStack}>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Run scans</h2>
          <span className={styles.panelMeta}>Manual only</span>
        </div>

        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={state.loadingMode !== null}
            onClick={() => runScan("product-hunt")}
          >
            {state.loadingMode === "product-hunt" ? "Running Product Hunt..." : "Run Product Hunt scan"}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={state.loadingMode !== null}
            onClick={() => runScan("x")}
          >
            {state.loadingMode === "x" ? "Running X..." : "Run X scan"}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={state.loadingMode !== null}
            onClick={() => runScan("both")}
          >
            {state.loadingMode === "both" ? "Running both..." : "Run both scans"}
          </button>
        </div>

        <p className={styles.helperText}>
          Parveil Leads never follows, DMs, likes, replies, or posts automatically. It only finds
          leads, scores them, and suggests copy for you to use manually.
        </p>

        {loadingDiscoveryCopy ? <div className={styles.noticeMuted}>{loadingDiscoveryCopy}</div> : null}
        {state.message ? <div className={styles.notice}>{state.message}</div> : null}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Discovered candidates</h2>
          <div className={styles.headerActions}>
            <span className={styles.panelMeta}>{state.candidates.length} results</span>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={state.loadingMode !== null || state.candidates.length === 0}
              onClick={clearDiscoveredCandidates}
            >
              Clear discovered candidates
            </button>
          </div>
        </div>

        {state.candidates.length === 0 ? (
          <div className={styles.emptyState}>
            No candidates yet. Run a Product Hunt scan, an X scan, or both. If credentials are
            missing, the API will return a clear message instead of scanning.
          </div>
        ) : (
          <div className={styles.discoveryGrid}>
            {state.candidates.map((candidate) => {
              const key =
                candidate.postUrl ||
                candidate.sourceUrl ||
                candidate.profileUrl ||
                candidate.website ||
                candidate.name;
              const isSaving = savingKey?.endsWith(key) ?? false;

              return (
                <article key={key} className={styles.discoveryCard}>
                  <div className={styles.discoveryTop}>
                    <div>
                      <strong>{candidate.name}</strong>
                      <span>{candidate.productName || candidate.handle || candidate.source}</span>
                    </div>
                    <span className={styles.scoreBadge}>{candidate.score ?? 0}/10</span>
                  </div>

                  <p>{candidate.bio || candidate.postText || "No extra context returned from this source."}</p>

                  <div className={styles.reasonList}>
                    {(candidate.scoreReasons ?? []).slice(0, 3).map((reason) => (
                      <span key={reason}>{reason}</span>
                    ))}
                  </div>

                  <div className={styles.linkCluster}>
                    {candidate.profileUrl ? (
                      <a href={candidate.profileUrl} target="_blank" rel="noreferrer">
                        Open profile
                      </a>
                    ) : null}
                    {candidate.website ? (
                      <a href={candidate.website} target="_blank" rel="noreferrer">
                        Open website
                      </a>
                    ) : null}
                    {candidate.sourceUrl ? (
                      <a href={candidate.sourceUrl} target="_blank" rel="noreferrer">
                        Open source
                      </a>
                    ) : null}
                  </div>

                  <div className={styles.actionRow}>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={isSaving}
                      onClick={() => saveCandidate(candidate, "saved")}
                    >
                      {isSaving ? "Saving..." : "Save lead"}
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      disabled={isSaving}
                      onClick={() => saveCandidate(candidate, "skipped")}
                    >
                      Skip
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
