"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LeadRecord, ReplyType } from "@/lib/leads";
import styles from "./leads.module.css";

const replyTypes: ReplyType[] = [
  "public_reply",
  "dm",
  "product_hunt_comment",
  "follow_up",
  "objection_response",
];

const statuses = [
  "new",
  "saved",
  "skipped",
  "contacted",
  "replied",
  "interested",
  "trial_offered",
  "connected_stripe",
  "customer",
  "not_fit",
  "no_response",
];

export function LeadDetailEditor({ lead }: { lead: LeadRecord }) {
  const router = useRouter();
  const [status, setStatus] = useState(lead.status);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [postText, setPostText] = useState(lead.postText ?? "");
  const [replyType, setReplyType] = useState<ReplyType>("public_reply");
  const [suggestedReply, setSuggestedReply] = useState(lead.suggestedReply ?? "");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveLead() {
    setSaving(true);
    setMessage(null);

    const response = await fetch(`/api/internal/leads/${lead.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
        notes,
        postText,
        suggestedReply,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setMessage(payload?.error ?? "Could not save changes.");
      setSaving(false);
      return;
    }

    setMessage("Lead updated.");
    setSaving(false);
    router.refresh();
  }

  async function generateReply() {
    setGenerating(true);
    setMessage(null);

    const response = await fetch(`/api/internal/leads/${lead.id}/generate-reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputText: postText,
        replyType,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setMessage(payload?.error ?? "Could not generate a reply.");
      setGenerating(false);
      return;
    }

    setSuggestedReply(payload.reply ?? "");
    setMessage("Reply generated.");
    setGenerating(false);
    router.refresh();
  }

  async function copyReply() {
    if (!suggestedReply) return;
    await navigator.clipboard.writeText(suggestedReply);
    setMessage("Reply copied.");
  }

  return (
    <section className={styles.panel} id="reply-generator">
      <div className={styles.panelHeader}>
        <h2>Outreach workspace</h2>
        <span className={styles.panelMeta}>Manual contact only</span>
      </div>

      <div className={styles.formStack}>
        <label className={styles.field}>
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className={styles.input}>
            {statuses.map((entry) => (
              <option key={entry} value={entry}>
                {entry.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Notes</span>
          <textarea
            className={styles.textarea}
            rows={5}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Why this lead matters, what to mention, and what to avoid."
          />
        </label>

        <label className={styles.field}>
          <span>Paste their post or message</span>
          <textarea
            className={styles.textarea}
            rows={7}
            value={postText}
            onChange={(event) => setPostText(event.target.value)}
            placeholder="Paste the Product Hunt comment, X post, or DM context here."
          />
        </label>

        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Reply type</span>
            <select
              value={replyType}
              onChange={(event) => setReplyType(event.target.value as ReplyType)}
              className={styles.input}
            >
              {replyTypes.map((entry) => (
                <option key={entry} value={entry}>
                  {entry.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={generating || !postText.trim()}
            onClick={generateReply}
          >
            {generating ? "Generating..." : "Generate reply"}
          </button>
          <button type="button" className={styles.secondaryButton} disabled={saving} onClick={saveLead}>
            {saving ? "Saving..." : "Save changes"}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={!suggestedReply}
            onClick={copyReply}
          >
            Copy reply
          </button>
        </div>

        <label className={styles.field}>
          <span>Generated reply</span>
          <textarea
            className={styles.textarea}
            rows={6}
            value={suggestedReply}
            onChange={(event) => setSuggestedReply(event.target.value)}
            placeholder="Generated reply appears here."
          />
        </label>

        {message ? <div className={styles.noticeMuted}>{message}</div> : null}
      </div>
    </section>
  );
}
