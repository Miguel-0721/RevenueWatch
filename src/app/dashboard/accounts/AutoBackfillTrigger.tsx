"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type AutoBackfillTriggerProps = {
  stripeAccountIds: string[];
};

const ATTEMPTED_STORAGE_KEY = "parveil-backfill-attempted-accounts";

function readAttemptedAccounts() {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const raw = window.sessionStorage.getItem(ATTEMPTED_STORAGE_KEY);

    if (!raw) {
      return new Set<string>();
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }

    return new Set(
      parsed.filter((value): value is string => typeof value === "string")
    );
  } catch {
    return new Set<string>();
  }
}

function writeAttemptedAccounts(values: Set<string>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      ATTEMPTED_STORAGE_KEY,
      JSON.stringify(Array.from(values))
    );
  } catch {
    // Ignore storage issues and keep the page usable.
  }
}

export function AutoBackfillTrigger({
  stripeAccountIds,
}: AutoBackfillTriggerProps) {
  const router = useRouter();
  const attemptedRef = useRef<Set<string>>(new Set());
  const refreshedRef = useRef(false);

  useEffect(() => {
    attemptedRef.current = readAttemptedAccounts();
    let cancelled = false;

    async function run() {
      let shouldRefresh = false;

      for (const stripeAccountId of stripeAccountIds) {
        if (attemptedRef.current.has(stripeAccountId)) {
          continue;
        }

        attemptedRef.current.add(stripeAccountId);
        writeAttemptedAccounts(attemptedRef.current);

        try {
          const response = await fetch("/api/internal/backfill-stripe-account", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ stripeAccountId }),
          });

          const data = (await response.json().catch(() => null)) as
            | {
                ok?: boolean;
                backfillStatus?: string;
                alreadyCompleted?: boolean;
                alreadyRunning?: boolean;
              }
            | null;

          if (!response.ok || !data?.ok) {
            continue;
          }

          if (data.backfillStatus === "completed" || data.alreadyCompleted) {
            shouldRefresh = true;
          }
        } catch {
          // Keep the page usable even if the background backfill request fails.
        }
      }

      if (!cancelled && shouldRefresh && !refreshedRef.current) {
        refreshedRef.current = true;
        router.refresh();
      }
    }

    if (stripeAccountIds.length > 0) {
      void run();
    }

    return () => {
      cancelled = true;
    };
  }, [router, stripeAccountIds]);

  return null;
}
