"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./leads.module.css";

const initialState = {
  name: "",
  handle: "",
  productName: "",
  website: "",
  notes: "",
};

export function LeadManualAddForm() {
  const router = useRouter();
  const [values, setValues] = useState(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const response = await fetch("/api/internal/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...values,
        source: "manual",
        status: "saved",
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setMessage(payload?.error ?? "Could not save the lead.");
      setSubmitting(false);
      return;
    }

    setValues(initialState);
    setMessage("Lead saved.");
    setSubmitting(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className={styles.formStack}>
      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Name</span>
          <input
            value={values.name}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
            required
            className={styles.input}
            placeholder="Jane Founder"
          />
        </label>

        <label className={styles.field}>
          <span>Handle</span>
          <input
            value={values.handle}
            onChange={(event) => setValues((current) => ({ ...current, handle: event.target.value }))}
            className={styles.input}
            placeholder="@janedoe"
          />
        </label>
      </div>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Product</span>
          <input
            value={values.productName}
            onChange={(event) =>
              setValues((current) => ({ ...current, productName: event.target.value }))
            }
            className={styles.input}
            placeholder="Acme SaaS"
          />
        </label>

        <label className={styles.field}>
          <span>Website</span>
          <input
            value={values.website}
            onChange={(event) => setValues((current) => ({ ...current, website: event.target.value }))}
            className={styles.input}
            placeholder="https://..."
          />
        </label>
      </div>

      <label className={styles.field}>
        <span>Notes</span>
        <textarea
          value={values.notes}
          onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
          className={styles.textarea}
          rows={4}
          placeholder="Why this founder could be a fit for Parveil..."
        />
      </label>

      <div className={styles.formFooter}>
        <button type="submit" className={styles.primaryButton} disabled={submitting}>
          {submitting ? "Saving..." : "Save lead"}
        </button>
        {message ? <span className={styles.inlineMuted}>{message}</span> : null}
      </div>
    </form>
  );
}
