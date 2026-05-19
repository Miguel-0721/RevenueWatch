export const LEAD_SOURCES = [
  "product_hunt",
  "x",
  "indie_hackers",
  "manual",
] as const;

export const LEAD_STATUSES = [
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
] as const;

export const SIGNAL_STATES = ["yes", "no", "unknown"] as const;

export const REPLY_TYPES = [
  "public_reply",
  "dm",
  "product_hunt_comment",
  "follow_up",
  "objection_response",
] as const;

export const X_SEARCH_QUERIES = [
  "\"launched my SaaS\"",
  "\"built with Stripe\"",
  "\"MRR\" \"Stripe\"",
  "\"failed payments\" \"SaaS\"",
  "\"Product Hunt launch\"",
  "\"bootstrapped SaaS\"",
  "\"Stripe\" \"SaaS\"",
  "\"subscription revenue\"",
  "\"SaaS churn\"",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type SignalState = (typeof SIGNAL_STATES)[number];
export type ReplyType = (typeof REPLY_TYPES)[number];

export type LeadRecord = {
  id: string;
  name: string;
  handle: string | null;
  profileUrl: string | null;
  productName: string | null;
  website: string | null;
  source: string;
  sourceUrl: string | null;
  location: string | null;
  bio: string | null;
  postText: string | null;
  postUrl: string | null;
  pricingStatus: string;
  likelyStripe: string;
  painSignals: string[];
  score: number;
  scoreReasons: string[];
  status: string;
  notes: string | null;
  suggestedReply: string | null;
  lastContactedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LeadCandidate = {
  name: string;
  handle?: string | null;
  profileUrl?: string | null;
  productName?: string | null;
  website?: string | null;
  source: LeadSource;
  sourceUrl?: string | null;
  location?: string | null;
  bio?: string | null;
  postText?: string | null;
  postUrl?: string | null;
  pricingStatus?: SignalState;
  likelyStripe?: SignalState;
  painSignals?: string[];
  score?: number;
  scoreReasons?: string[];
  status?: LeadStatus;
  notes?: string | null;
  suggestedReply?: string | null;
  lastContactedAt?: Date | null;
};

type ScoreResult = {
  score: number;
  scoreReasons: string[];
  painSignals: string[];
  pricingStatus: SignalState;
  likelyStripe: SignalState;
};

type DiscoveryResult =
  | {
      ok: true;
      candidates: LeadCandidate[];
    }
  | {
      ok: false;
      missingEnv?: string[];
      error: string;
      candidates: LeadCandidate[];
    };

function normalizeUrl(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function normalizeHandle(handle?: string | null) {
  if (!handle) return null;
  const cleaned = handle.trim().replace(/^@+/, "");
  return cleaned || null;
}

function compactText(value?: string | null) {
  return value?.trim() || "";
}

function includesAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

async function hasPricingPage(website?: string | null): Promise<SignalState> {
  const normalized = normalizeUrl(website);
  if (!normalized) return "unknown";

  const pricingPaths = ["/pricing", "/plans"];

  for (const path of pricingPaths) {
    try {
      const response = await fetch(new URL(path, normalized), {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent": "Parveil Leads/1.0",
        },
      });

      if (response.ok) {
        const body = (await response.text()).toLowerCase();
        if (body.includes("pricing") || body.includes("plan")) {
          return "yes";
        }
      }
    } catch {
      continue;
    }
  }

  return "unknown";
}

export async function scoreLeadCandidate(candidate: LeadCandidate): Promise<ScoreResult> {
  const text = [
    candidate.name,
    candidate.handle,
    candidate.productName,
    candidate.bio,
    candidate.postText,
    candidate.website,
    candidate.location,
  ]
    .map((part) => compactText(part))
    .join(" ")
    .toLowerCase();

  let points = 0;
  const reasons: string[] = [];
  const painSignals: string[] = [];

  const pricingStatus = candidate.pricingStatus ?? (await hasPricingPage(candidate.website));
  if (pricingStatus === "yes") {
    points += 2;
    reasons.push("Has a visible pricing signal");
  }

  if (includesAny(text, ["founder", "co-founder", "cofounder"])) {
    points += 2;
    reasons.push("Looks like a founder profile");
  }

  if (includesAny(text, ["saas", "subscription", "recurring", "b2b", "product"])) {
    points += 2;
    reasons.push("Appears to run a SaaS/product business");
  }

  if (includesAny(text, ["indie", "solo", "small team", "bootstrapped", "bootstrapping"])) {
    points += 2;
    reasons.push("Looks like an indie or small-team founder");
  }

  let likelyStripe: SignalState = candidate.likelyStripe ?? "unknown";
  if (includesAny(text, ["stripe", "payments", "checkout", "billing"])) {
    points += 3;
    reasons.push("Mentions Stripe or payments");
    likelyStripe = "yes";
    painSignals.push("stripe_or_payments");
  }

  if (includesAny(text, ["mrr", "arr", "revenue", "subscription revenue"])) {
    points += 3;
    reasons.push("Mentions MRR or revenue");
    painSignals.push("revenue_focus");
  }

  if (
    includesAny(text, [
      "failed payments",
      "payment failures",
      "involuntary churn",
      "churn",
      "dunning",
    ])
  ) {
    points += 4;
    reasons.push("Shows payment failure or churn pain");
    painSignals.push("failed_payments_or_churn");
  }

  if (
    candidate.source === "product_hunt" ||
    includesAny(text, ["launched", "launching", "product hunt", "just shipped", "shipping today"])
  ) {
    points += 1;
    reasons.push("Recently launched or actively shipping");
  }

  if (includesAny(text, ["united states", "usa", "canada", "uk", "united kingdom"])) {
    points += 1;
    reasons.push("Located in the US, Canada, or the UK");
  }

  if (includesAny(text, ["consumer", "gaming", "game studio", "crypto casino"])) {
    points -= 3;
    reasons.push("Looks more consumer or unrelated");
  }

  if (includesAny(text, ["angel investor", "vc", "venture capitalist", "investor"])) {
    points -= 3;
    reasons.push("Looks investor-focused rather than operator-focused");
  }

  if (!candidate.productName && !candidate.website && !candidate.postText) {
    points -= 2;
    reasons.push("No clear product signal");
  }

  if (!candidate.profileUrl && !candidate.website && !candidate.sourceUrl && !candidate.postUrl) {
    points -= 2;
    reasons.push("No profile or contact path");
  }

  if (likelyStripe === "unknown") {
    likelyStripe = "no";
  }

  return {
    score: Math.max(0, Math.min(10, points)),
    scoreReasons: reasons,
    painSignals: [...new Set([...(candidate.painSignals ?? []), ...painSignals])],
    pricingStatus,
    likelyStripe,
  };
}

export async function prepareLeadCandidate(candidate: LeadCandidate): Promise<LeadCandidate> {
  const normalizedCandidate: LeadCandidate = {
    ...candidate,
    name: candidate.name.trim(),
    handle: normalizeHandle(candidate.handle),
    website: normalizeUrl(candidate.website),
    profileUrl: normalizeUrl(candidate.profileUrl),
    sourceUrl: normalizeUrl(candidate.sourceUrl),
    postUrl: normalizeUrl(candidate.postUrl),
    status: candidate.status ?? "new",
  };

  const scoreResult = await scoreLeadCandidate(normalizedCandidate);

  return {
    ...normalizedCandidate,
    pricingStatus: scoreResult.pricingStatus,
    likelyStripe: scoreResult.likelyStripe,
    painSignals: scoreResult.painSignals,
    score: scoreResult.score,
    scoreReasons: scoreResult.scoreReasons,
  };
}

export function getLeadDuplicateWhere(candidate: LeadCandidate) {
  const checks = [candidate.profileUrl, candidate.postUrl, candidate.sourceUrl, candidate.website]
    .map((value) => normalizeUrl(value))
    .filter(Boolean) as string[];

  const uniqueChecks = [...new Set(checks)];
  if (uniqueChecks.length === 0) {
    return null;
  }

  return {
    OR: uniqueChecks.flatMap((value) => [
      { profileUrl: value },
      { postUrl: value },
      { sourceUrl: value },
      { website: value },
    ]),
  };
}

function collectTopics(node: any) {
  return (node?.topics?.edges ?? [])
    .map((edge: any) => edge?.node?.name)
    .filter(Boolean)
    .join(", ");
}

export async function discoverProductHuntLeads(): Promise<DiscoveryResult> {
  if (!process.env.PRODUCT_HUNT_API_TOKEN) {
    return {
      ok: false,
      error: "Product Hunt credentials are missing.",
      missingEnv: ["PRODUCT_HUNT_API_TOKEN"],
      candidates: [],
    };
  }

  const query = `
    query DiscoverPosts($first: Int!) {
      posts(first: $first) {
        edges {
          node {
            id
            name
            tagline
            description
            url
            website
            createdAt
            topics {
              edges {
                node {
                  name
                }
              }
            }
            makers {
              edges {
                node {
                  name
                  username
                  websiteUrl
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PRODUCT_HUNT_API_TOKEN}`,
      },
      body: JSON.stringify({
        query,
        variables: { first: 12 },
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Product Hunt scan failed with ${response.status}.`,
        candidates: [],
      };
    }

    const payload = await response.json();
    if (payload.errors?.length) {
      return {
        ok: false,
        error: payload.errors[0]?.message ?? "Product Hunt scan failed.",
        candidates: [],
      };
    }

    const edges = payload.data?.posts?.edges ?? [];
    const candidates = await Promise.all(
      edges.map(async (edge: any) => {
        const node = edge?.node;
        const maker = node?.makers?.edges?.[0]?.node;
        const prepared = await prepareLeadCandidate({
          name: maker?.name || node?.name || "Unknown lead",
          handle: maker?.username ? `@${maker.username}` : null,
          profileUrl: maker?.username ? `https://www.producthunt.com/@${maker.username}` : maker?.websiteUrl,
          productName: node?.name ?? null,
          website: node?.website ?? null,
          source: "product_hunt",
          sourceUrl: node?.url ?? null,
          bio: [node?.tagline, node?.description, collectTopics(node)].filter(Boolean).join(" · "),
          postText: node?.tagline ?? node?.description ?? null,
        });

        return prepared;
      })
    );

    return { ok: true, candidates };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Product Hunt scan failed.",
      candidates: [],
    };
  }
}

export async function discoverXLeads(): Promise<DiscoveryResult> {
  if (!process.env.X_BEARER_TOKEN) {
    return {
      ok: false,
      error: "X credentials are missing.",
      missingEnv: ["X_BEARER_TOKEN"],
      candidates: [],
    };
  }

  const candidates: LeadCandidate[] = [];
  const seen = new Set<string>();

  try {
    for (const searchQuery of X_SEARCH_QUERIES) {
      const url = new URL("https://api.x.com/2/tweets/search/recent");
      url.searchParams.set("query", `${searchQuery} -is:retweet lang:en`);
      url.searchParams.set("max_results", "10");
      url.searchParams.set("expansions", "author_id");
      url.searchParams.set("user.fields", "name,username,description,location,url");
      url.searchParams.set("tweet.fields", "created_at,text");

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${process.env.X_BEARER_TOKEN}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        return {
          ok: false,
          error: `X scan failed with ${response.status}.`,
          candidates: [],
        };
      }

      const payload = await response.json();
      const users = new Map<string, any>(
        (payload.includes?.users ?? []).map((user: any) => [user.id, user])
      );

      for (const tweet of payload.data ?? []) {
        const user = users.get(tweet.author_id);
        const key = tweet.id || `${user?.username}:${tweet.text}`;
        if (!key || seen.has(key)) continue;
        seen.add(key);

        candidates.push(
          await prepareLeadCandidate({
            name: user?.name || user?.username || "Unknown lead",
            handle: user?.username ? `@${user.username}` : null,
            profileUrl: user?.username ? `https://x.com/${user.username}` : null,
            productName: null,
            website: user?.url ?? null,
            source: "x",
            sourceUrl: user?.username ? `https://x.com/${user.username}` : null,
            location: user?.location ?? null,
            bio: user?.description ?? null,
            postText: tweet.text ?? null,
            postUrl: user?.username ? `https://x.com/${user.username}/status/${tweet.id}` : null,
          })
        );
      }
    }

    candidates.sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
    return { ok: true, candidates };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "X scan failed.",
      candidates: [],
    };
  }
}

export async function discoverBothLeadSources(): Promise<{
  productHunt: DiscoveryResult;
  x: DiscoveryResult;
  candidates: LeadCandidate[];
}> {
  const [productHunt, x] = await Promise.all([
    discoverProductHuntLeads(),
    discoverXLeads(),
  ]);

  const combined = [...productHunt.candidates, ...x.candidates];
  const unique = new Map<string, LeadCandidate>();

  for (const candidate of combined) {
    const key =
      candidate.postUrl ||
      candidate.sourceUrl ||
      candidate.profileUrl ||
      candidate.website ||
      `${candidate.source}:${candidate.name}:${candidate.productName ?? ""}`;

    const existing = unique.get(key);
    if (!existing || (candidate.score ?? 0) > (existing.score ?? 0)) {
      unique.set(key, candidate);
    }
  }

  const candidates = [...unique.values()].sort((left, right) => (right.score ?? 0) - (left.score ?? 0));

  return {
    productHunt,
    x,
    candidates,
  };
}

export async function generateLeadReply({
  lead,
  inputText,
  replyType,
}: {
  lead: LeadRecord;
  inputText: string;
  replyType: ReplyType;
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
        "You write short founder-to-founder outbound replies for Parveil Leads.",
        "Tone: human, casual, specific, not salesy, no hype, no link unless asked.",
        "Public replies should usually be one sentence and around 140 characters when possible.",
        "For first-touch public replies, usually ask one simple question and keep it light.",
        "Avoid em dashes, long dashes, and polished AI-sounding sentence joins.",
        "Use simple sentence structure that sounds like a normal founder writing quickly.",
        "Do not mention Parveil unless the person already asked about the product directly.",
        "Do not mention revenue drops or payment failure spikes early unless the post clearly makes that relevant.",
        "Ask whether the founder or product uses Stripe for billing or payments, not whether their customers use Stripe.",
        "A strong default first-touch question is whether they use Stripe or how they handle billing.",
        "DMs can be slightly longer, but still natural, concise, and not salesy.",
        "Keep the reply directly copy-pasteable.",
        "Parveil is a small Stripe monitoring tool for SaaS founders. It helps spot payment failure spikes and unusual revenue drops faster.",
        "Parveil only monitors Stripe activity. It does not create charges, issue refunds, move money, or change Stripe account settings.",
      ].join(" "),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Reply type: ${replyType}`,
                `Lead name: ${lead.name}`,
                `Lead handle: ${lead.handle ?? "n/a"}`,
                `Product name: ${lead.productName ?? "n/a"}`,
                `Lead bio/context: ${lead.bio ?? "n/a"}`,
                `Lead pain signals: ${lead.painSignals.join(", ") || "none noted"}`,
                `Lead notes: ${lead.notes ?? "n/a"}`,
                `Source message/post:`,
                inputText,
                "",
                "Write one short reply only.",
                "If the reply type is public_reply, prefer one sentence and keep it very short.",
                "For public replies, prefer wording like: 'Congrats on the launch. Curious, are you using Stripe for billing today?'",
                "For public replies, prefer wording like: 'Nice launch. Are you using Stripe for payments on this?'",
                "For public replies, prefer wording like: 'Congrats. Is this subscription-based or one-time pricing?'",
              ].join("\n"),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 400 || response.status === 404) {
      throw new Error(
        `OpenAI reply generation failed. Check OPENAI_LEADS_MODEL (${model}) and account model access. ${body}`
      );
    }
    throw new Error(`OpenAI reply generation failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  if (process.env.NODE_ENV !== "production") {
    console.log("Parveil Leads OpenAI response shape", {
      model,
      id: payload?.id,
      status: payload?.status,
      outputTextType: typeof payload?.output_text,
      outputCount: Array.isArray(payload?.output) ? payload.output.length : 0,
      firstOutputType: payload?.output?.[0]?.type ?? null,
      firstContentTypes: Array.isArray(payload?.output?.[0]?.content)
        ? payload.output[0].content.map((entry: { type?: string }) => entry?.type ?? null)
        : [],
    });
  }

  const text = extractResponseText(payload);

  if (!text) {
    throw new Error("OpenAI did not return reply text.");
  }

  return text;
}

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

  const messageEntries = Array.isArray(payload?.messages) ? payload.messages : [];
  for (const message of messageEntries) {
    const contentEntries = Array.isArray(message?.content) ? message.content : [];
    for (const contentEntry of contentEntries) {
      if (typeof contentEntry?.text === "string" && contentEntry.text.trim()) {
        return contentEntry.text.trim();
      }
    }
  }

  return null;
}
