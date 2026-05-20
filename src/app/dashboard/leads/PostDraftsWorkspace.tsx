"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ClipboardEvent } from "react";
import type { PostDraftRecord, PostDraftStatus, PostDraftType } from "@/lib/post-drafts";
import { POST_DRAFT_STATUSES, POST_DRAFT_TYPES } from "@/lib/post-drafts";
import styles from "./leads.module.css";

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

function buildDraftKey(draft: PostDraftRecord) {
  return draft.id;
}

async function uploadScreenshotFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/internal/leads/post-drafts/upload", {
    method: "POST",
    body: formData,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error ?? "Could not upload the screenshot.");
  }

  return payload.screenshotUrl as string;
}

export function PostDraftsWorkspace({ initialDrafts }: { initialDrafts: PostDraftRecord[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<PostDraftRecord[]>(initialDrafts);
  const [title, setTitle] = useState("");
  const [postType, setPostType] = useState<PostDraftType>("founder_update");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [screenshotNotes, setScreenshotNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadingCreateScreenshot, setUploadingCreateScreenshot] = useState(false);

  async function createDraft() {
    if (!title.trim()) {
      setMessage("Draft title is required.");
      return;
    }

    setCreating(true);
    setMessage(null);

    const response = await fetch("/api/internal/post-drafts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        postType,
        screenshotUrl: screenshotUrl || null,
        screenshotNotes: screenshotNotes || null,
        status: "draft",
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.ok === false) {
      setMessage(payload?.error ?? "Could not create the post draft.");
      setCreating(false);
      return;
    }

    setDrafts((current) => [payload.draft, ...current]);
    setTitle("");
    setPostType("founder_update");
    setScreenshotUrl("");
    setScreenshotNotes("");
    setMessage("Post draft created.");
    setCreating(false);
    router.refresh();
  }

  async function saveDraft(draftId: string, next: Partial<PostDraftRecord>) {
    setSavingKey(draftId);
    setMessage(null);

    const response = await fetch(`/api/internal/post-drafts/${draftId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(next),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok === false) {
      setMessage(payload?.error ?? "Could not save the draft.");
      setSavingKey(null);
      return;
    }

    setDrafts((current) => current.map((draft) => (draft.id === draftId ? payload.draft : draft)));
    setSavingKey(null);
    setMessage("Draft updated.");
    router.refresh();
  }

  async function generateDraft(draft: PostDraftRecord) {
    setGeneratingKey(draft.id);
    setMessage(null);

    const response = await fetch(`/api/internal/post-drafts/${draft.id}/generate`, {
      method: "POST",
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok === false) {
      setMessage(payload?.error ?? "Could not generate the post draft.");
      setGeneratingKey(null);
      return;
    }

    setDrafts((current) => current.map((entry) => (entry.id === draft.id ? payload.draft : entry)));
    setGeneratingKey(null);
    setMessage("Post draft generated.");
    router.refresh();
  }

  async function copyText(postText: string | null) {
    if (!postText) return;
    await navigator.clipboard.writeText(postText);
    setMessage("Post text copied.");
  }

  async function handleCreateScreenshotFile(file: File) {
    setUploadingCreateScreenshot(true);
    setMessage(null);

    try {
      const uploadedUrl = await uploadScreenshotFile(file);
      setScreenshotUrl(uploadedUrl);
      setMessage("Screenshot uploaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not upload the screenshot.");
    } finally {
      setUploadingCreateScreenshot(false);
    }
  }

  return (
    <div className={styles.discoverStack}>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Create post draft</h2>
          <span className={styles.panelMeta}>Manual only</span>
        </div>

        <div className={styles.formStack}>
          <label className={styles.field}>
            <span>Draft title</span>
            <input
              className={styles.input}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What is this post about?"
            />
          </label>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Post type</span>
              <select
                value={postType}
                onChange={(event) => setPostType(event.target.value as PostDraftType)}
                className={styles.input}
              >
                {POST_DRAFT_TYPES.map((entry) => (
                  <option key={entry} value={entry}>
                    {formatLabel(entry)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Screenshot URL or path</span>
              <input
                className={styles.input}
                value={screenshotUrl}
                onChange={(event) => setScreenshotUrl(event.target.value)}
                placeholder="Optional screenshot URL or local path"
              />
            </label>
          </div>

          <label className={styles.field}>
            <span>Screenshot notes</span>
            <textarea
              className={styles.textarea}
              rows={4}
              value={screenshotNotes}
              onChange={(event) => setScreenshotNotes(event.target.value)}
              placeholder="What screenshot should be used and what should it show?"
            />
          </label>

          <ScreenshotUploadField
            value={screenshotUrl}
            disabled={creating || uploadingCreateScreenshot}
            uploading={uploadingCreateScreenshot}
            onChange={setScreenshotUrl}
            onUpload={handleCreateScreenshotFile}
          />

          <div className={styles.noticeMuted}>
            Before posting, make sure the screenshot does not show private customer data, API
            keys, emails, Stripe account IDs, internal lead data, or admin-only information.
          </div>

          <div className={styles.actionRow}>
            <button type="button" className={styles.primaryButton} disabled={creating} onClick={createDraft}>
              {creating ? "Creating..." : "Create draft"}
            </button>
          </div>
        </div>
      </section>

      {message ? <div className={styles.notice}>{message}</div> : null}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Saved post drafts</h2>
          <span className={styles.panelMeta}>{drafts.length} drafts</span>
        </div>

        {drafts.length === 0 ? (
          <div className={styles.emptyState}>
            No post drafts yet. Create a draft, generate copy, then review it manually before
            posting anywhere.
          </div>
        ) : (
          <div className={styles.discoveryGrid}>
            {drafts.map((draft) => (
              <PostDraftCard
                key={buildDraftKey(draft)}
                draft={draft}
                saving={savingKey === draft.id}
                generating={generatingKey === draft.id}
                onSave={saveDraft}
                onGenerate={generateDraft}
                onCopy={copyText}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PostDraftCard({
  draft,
  saving,
  generating,
  onSave,
  onGenerate,
  onCopy,
}: {
  draft: PostDraftRecord;
  saving: boolean;
  generating: boolean;
  onSave: (draftId: string, next: Partial<PostDraftRecord>) => Promise<void>;
  onGenerate: (draft: PostDraftRecord) => Promise<void>;
  onCopy: (postText: string | null) => Promise<void>;
}) {
  const [title, setTitle] = useState(draft.title);
  const [postType, setPostType] = useState(draft.postType as PostDraftType);
  const [status, setStatus] = useState(draft.status as PostDraftStatus);
  const [postText, setPostText] = useState(draft.postText ?? "");
  const [screenshotUrl, setScreenshotUrl] = useState(draft.screenshotUrl ?? "");
  const [screenshotNotes, setScreenshotNotes] = useState(draft.screenshotNotes ?? "");
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  async function handleCardScreenshotFile(file: File) {
    setUploadingScreenshot(true);
    setUploadMessage(null);

    try {
      const uploadedUrl = await uploadScreenshotFile(file);
      setScreenshotUrl(uploadedUrl);
      setUploadMessage("Screenshot uploaded.");
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "Could not upload the screenshot.");
    } finally {
      setUploadingScreenshot(false);
    }
  }

  return (
    <article className={styles.discoveryCard}>
      <div className={styles.discoveryTop}>
        <div>
          <strong>{draft.title}</strong>
          <span>
            {formatLabel(draft.postType)} · {formatLabel(draft.status)}
          </span>
        </div>
        <span className={styles.statusBadge}>{formatLabel(draft.status)}</span>
      </div>

      <div className={styles.formStack}>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Title</span>
            <input className={styles.input} value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Status</span>
            <select
              className={styles.input}
              value={status}
              onChange={(event) => setStatus(event.target.value as PostDraftStatus)}
            >
              {POST_DRAFT_STATUSES.map((entry) => (
                <option key={entry} value={entry}>
                  {formatLabel(entry)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Post type</span>
            <select
              className={styles.input}
              value={postType}
              onChange={(event) => setPostType(event.target.value as PostDraftType)}
            >
              {POST_DRAFT_TYPES.map((entry) => (
                <option key={entry} value={entry}>
                  {formatLabel(entry)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Screenshot URL or path</span>
            <input
              className={styles.input}
              value={screenshotUrl}
              onChange={(event) => setScreenshotUrl(event.target.value)}
            />
          </label>
        </div>

        <label className={styles.field}>
          <span>Screenshot notes</span>
          <textarea
            className={styles.textarea}
            rows={3}
            value={screenshotNotes}
            onChange={(event) => setScreenshotNotes(event.target.value)}
          />
        </label>

        <ScreenshotUploadField
          value={screenshotUrl}
          disabled={saving || generating || uploadingScreenshot}
          uploading={uploadingScreenshot}
          onChange={setScreenshotUrl}
          onUpload={handleCardScreenshotFile}
        />
        {uploadMessage ? <div className={styles.noticeMuted}>{uploadMessage}</div> : null}

        <div className={styles.noticeMuted}>
          Before posting, make sure the screenshot does not show private customer data, API keys,
          emails, Stripe account IDs, internal lead data, or admin-only information.
        </div>

        <label className={styles.field}>
          <span>Post text</span>
          <textarea
            className={styles.textarea}
            rows={5}
            value={postText}
            onChange={(event) => setPostText(event.target.value)}
            placeholder="Write your draft manually or generate a first version."
          />
        </label>

        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={generating}
            onClick={() => onGenerate({ ...draft, title, postType, screenshotNotes, postText })}
          >
            {generating ? "Generating..." : "Generate post text"}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={saving || uploadingScreenshot}
            onClick={() =>
              onSave(draft.id, {
                title,
                postType,
                status,
                postText,
                screenshotUrl: screenshotUrl || null,
                screenshotNotes: screenshotNotes || null,
              })
            }
          >
            {saving ? "Saving..." : "Save draft"}
          </button>
          <button type="button" className={styles.secondaryButton} disabled={!postText} onClick={() => onCopy(postText)}>
            Copy post text
          </button>
        </div>
      </div>
    </article>
  );
}

function ScreenshotUploadField({
  value,
  disabled,
  uploading,
  onChange,
  onUpload,
}: {
  value: string;
  disabled: boolean;
  uploading: boolean;
  onChange: (value: string) => void;
  onUpload: (file: File) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    await onUpload(file);
  }

  async function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const items = Array.from(event.clipboardData.items || []);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    event.preventDefault();
    await onUpload(file);
  }

  return (
    <div className={styles.field}>
      <span>Upload or paste screenshot</span>
      <div
        className={styles.screenshotDropzone}
        onPaste={handlePaste}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <strong>{uploading ? "Uploading screenshot..." : "Click to choose a screenshot or paste one from the clipboard"}</strong>
        <span>PNG, JPG, or WEBP up to 5MB</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className={styles.hiddenFileInput}
        disabled={disabled}
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      <label className={styles.field}>
        <span>Screenshot URL or path</span>
        <input
          className={styles.input}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Optional screenshot URL or local path"
          disabled={disabled}
        />
      </label>
      {value ? (
        <div className={styles.screenshotPreviewCard}>
          <img src={value} alt="Screenshot preview for post draft" className={styles.screenshotPreview} />
        </div>
      ) : null}
    </div>
  );
}
