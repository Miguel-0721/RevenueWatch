export const POST_DRAFT_TYPES = [
  "founder_update",
  "product_progress",
  "lesson_learned",
  "feature_update",
  "customer_discovery",
  "launch_prep",
] as const;

export const POST_DRAFT_STATUSES = ["draft", "ready", "posted", "skipped"] as const;

export type PostDraftType = (typeof POST_DRAFT_TYPES)[number];
export type PostDraftStatus = (typeof POST_DRAFT_STATUSES)[number];

export type PostDraftRecord = {
  id: string;
  title: string;
  postType: string;
  postText: string | null;
  screenshotUrl: string | null;
  screenshotNotes: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PostDraftInput = {
  title: string;
  postType: PostDraftType;
  postText?: string | null;
  screenshotUrl?: string | null;
  screenshotNotes?: string | null;
  status?: PostDraftStatus;
};

function extractResponseText(payload: any) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const outputEntries = Array.isArray(payload?.output) ? payload.output : [];
  for (const outputEntry of outputEntries) {
    const contentEntries = Array.isArray(outputEntry?.content) ? outputEntry.content : [];
    for (const contentEntry of contentEntries) {
      const directText =
        typeof contentEntry?.text === "string"
          ? contentEntry.text
          : typeof contentEntry?.text?.value === "string"
            ? contentEntry.text.value
            : typeof contentEntry?.content === "string"
              ? contentEntry.content
              : null;

      if (directText?.trim()) {
        return directText.trim();
      }
    }
  }

  return null;
}

export async function generatePostDraftText(draft: {
  title: string;
  postType: string;
  screenshotNotes?: string | null;
  existingText?: string | null;
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const model = process.env.OPENAI_LEADS_MODEL?.trim() || "gpt-5.5";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      instructions: [
        "You write short internal X/Twitter post drafts for Parveil.",
        "Tone: human, simple, calm, honest, founder-like.",
        "Avoid em dashes, hype, marketing fluff, and fake traction.",
        "Do not pretend there are customers or users unless explicitly stated.",
        "Do not include links unless asked.",
        "Keep the post short and copy-pasteable.",
        "It should sound like a real founder update, not a launch thread.",
        "Parveil is a Stripe monitoring tool for SaaS founders.",
        "Parveil helps spot payment failure spikes and unusual revenue drops faster.",
        "Parveil only monitors Stripe activity. It does not create charges, issue refunds, move money, or change Stripe account settings.",
      ].join(" "),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Post type: ${draft.postType}`,
                `Draft title: ${draft.title}`,
                `Screenshot context: ${draft.screenshotNotes ?? "none"}`,
                `Existing text: ${draft.existingText ?? "none"}`,
                "",
                "Write one short post only.",
                "Keep it plain and human.",
                "Do not use em dashes.",
              ].join("\n"),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI post draft generation failed: ${response.status} ${body}`);
  }

  const payload: any = await response.json();
  const text = extractResponseText(payload);
  if (!text) {
    throw new Error("OpenAI did not return post draft text.");
  }

  return text;
}
