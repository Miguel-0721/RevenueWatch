"use client";

import { useActionState, useEffect, useState } from "react";
import styles from "./page.module.css";
import { renameAccountAction, type RenameAccountState } from "./actions";

const initialState: RenameAccountState = {};

export default function RenameAccountControl({
  accountId,
  currentName,
}: {
  accountId: string;
  currentName: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(currentName);
  const [state, formAction, isPending] = useActionState(renameAccountAction, initialState);

  useEffect(() => {
    setDraftName(currentName);
  }, [currentName]);

  useEffect(() => {
    if (state.success) {
      setIsEditing(false);
    }
  }, [state.success]);

  function handleCancel() {
    setDraftName(currentName);
    setIsEditing(false);
  }

  return (
    <div className={styles.renameControl}>
      <button
        type="button"
        className={styles.renameTrigger}
        onClick={() => setIsEditing((value) => !value)}
        aria-expanded={isEditing}
        aria-controls="rename-account-form"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm2.92 2.33H5v-.92l8.06-8.06.92.92L5.92 19.58ZM20.71 7.04a1.004 1.004 0 0 0 0-1.42L18.37 3.29a1.004 1.004 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.83Z"
          />
        </svg>
        Edit
      </button>

      {isEditing ? (
        <form id="rename-account-form" action={formAction} className={styles.renameForm}>
          <input type="hidden" name="accountId" value={accountId} />
          <label className={styles.renameLabel}>
            Display name
            <input
              type="text"
              name="name"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              className={styles.renameInput}
              autoFocus
              maxLength={120}
            />
          </label>
          <p className={styles.renameHelp}>
            This only changes the display name inside RevenueWatch. Your Stripe account is not changed.
          </p>
          {state.error ? <p className={styles.renameError}>{state.error}</p> : null}
          <div className={styles.renameActions}>
            <button
              type="button"
              className={styles.renameSecondary}
              onClick={handleCancel}
              disabled={isPending}
            >
              Cancel
            </button>
            <button type="submit" className={styles.renamePrimary} disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
