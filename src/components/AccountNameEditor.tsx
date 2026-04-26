"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./AccountNameEditor.module.css";

type AccountNameEditorProps = {
  accountId: string;
  stripeAccountId: string;
  currentName: string | null;
  currentStatus: string;
};

export default function AccountNameEditor({
  accountId,
  stripeAccountId,
  currentName,
  currentStatus,
}: AccountNameEditorProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [value, setValue] = useState(currentName ?? "");
  const [displayName, setDisplayName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isPaused = currentStatus === "paused";

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  async function handleSave() {
    const trimmed = value.trim();

    if (!trimmed) {
      setError("Enter a name");
      return;
    }

    if (trimmed.length > 80) {
      setError("Use 80 characters or fewer");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/stripe-accounts/${accountId}/name`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Unable to update name");
      }

      const payload = (await response.json()) as { account: { name: string } };
      setDisplayName(payload.account.name);
      setValue(payload.account.name);
      setEditing(false);
      setMenuOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update name");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setValue(displayName ?? "");
    setError("");
    setEditing(false);
  }

  async function handleToggleMonitoring() {
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/stripe/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stripeAccountId }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(
          payload?.error ??
            `Unable to ${isPaused ? "resume" : "pause"} monitoring`
        );
      }

      setMenuOpen(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Unable to ${isPaused ? "resume" : "pause"} monitoring`
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={containerRef}>
      {editing ? (
        <div className={styles.editor}>
          <input
            className={styles.input}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={80}
            placeholder="Account name"
            aria-label="Account display name"
          />
          <button
            type="button"
            className={styles.saveButton}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving" : "Save"}
          </button>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className={styles.wrap}>
          <span className={styles.name}>{displayName ?? "Stripe account"}</span>
          <div className={styles.menuWrap}>
            <button
              type="button"
              className={styles.menuButton}
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Account actions"
              aria-expanded={menuOpen}
            >
              <span />
              <span />
              <span />
            </button>

            {menuOpen ? (
              <div className={styles.menu}>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    setEditing(true);
                    setMenuOpen(false);
                  }}
                >
                  Edit name
                </button>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={handleToggleMonitoring}
                  disabled={saving}
                >
                  {isPaused ? "Resume monitoring" : "Pause monitoring"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {error ? <div className={styles.error}>{error}</div> : null}
    </div>
  );
}
