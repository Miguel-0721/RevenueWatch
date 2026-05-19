import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLeadsAdminSession } from "@/lib/leads-auth";
import { findLeadById } from "@/lib/lead-store";
import type { LeadRecord } from "@/lib/leads";
import { LeadDetailEditor } from "../LeadDetailEditor";
import styles from "../leads.module.css";

function formatStatus(value: string) {
  return value.replace(/_/g, " ");
}

function buildSearchHref(baseUrl: string, query: string) {
  return `${baseUrl}${encodeURIComponent(query)}`;
}

function getMissingProfileCopy(source: string) {
  if (source === "product_hunt") {
    return "Not found from the Product Hunt API. The public Product Hunt page may still show a social link.";
  }

  return "Profile not available";
}

function getProfileDisplay(profileUrl: string | null) {
  if (!profileUrl) return null;

  try {
    const parsed = new URL(profileUrl);
    const host = parsed.hostname.toLowerCase();

    if (host === "x.com" || host === "www.x.com" || host === "twitter.com" || host === "www.twitter.com") {
      return {
        label: "X profile",
        action: "Open X profile",
      };
    }

    if (host === "producthunt.com" || host === "www.producthunt.com") {
      return {
        label: "Product Hunt profile",
        action: "Open Product Hunt profile",
      };
    }
  } catch {
    return {
      label: "Profile",
      action: "Open profile",
    };
  }

  return {
    label: "Profile",
    action: "Open profile",
  };
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const session = await getLeadsAdminSession();
  if (!session) redirect("/dashboard");

  const { leadId } = await params;
  const lead = (await findLeadById(leadId)) as LeadRecord | null;

  if (!lead) {
    notFound();
  }

  const productLabel = lead.productName || lead.name;
  const xSearchHref = buildSearchHref("https://x.com/search?q=", `${productLabel} founder`);
  const googleSearchHref = buildSearchHref(
    "https://www.google.com/search?q=",
    `${productLabel} Product Hunt founder`
  );
  const missingProfileCopy = getMissingProfileCopy(lead.source);
  const profileDisplay = getProfileDisplay(lead.profileUrl);

  return (
    <section className={styles.shell}>
      <div className={styles.backRow}>
        <Link href="/dashboard/leads" className={styles.backLink}>
          Back to leads
        </Link>
      </div>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Lead detail</p>
          <h1>{lead.name}</h1>
          <p>{lead.productName || lead.bio || "Review the lead context, update notes, and draft a reply."}</p>
        </div>

        <div className={styles.headerScore}>
          <span className={styles.scoreHero}>{lead.score}/10</span>
          <span className={styles.statusBadge}>{formatStatus(lead.status)}</span>
        </div>
      </header>

      <div className={styles.detailGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Lead profile</h2>
            <span className={styles.panelMeta}>{lead.source.replace(/_/g, " ")}</span>
          </div>

          <dl className={styles.detailList}>
            <div>
              <dt>Handle</dt>
              <dd>{lead.handle || <span className={styles.inlineMuted}>{missingProfileCopy}</span>}</dd>
            </div>
            <div>
              <dt>Website</dt>
              <dd>
                {lead.website ? (
                  <a href={lead.website} target="_blank" rel="noreferrer">
                    Open website
                  </a>
                ) : (
                  <span className={styles.inlineMuted}>Not available</span>
                )}
              </dd>
            </div>
            {profileDisplay?.label === "Product Hunt profile" ? (
              <div>
                <dt>Product Hunt profile</dt>
                <dd>
                  <a href={lead.profileUrl!} target="_blank" rel="noreferrer">
                    Open Product Hunt profile
                  </a>
                </dd>
              </div>
            ) : (
              <div>
                <dt>X profile</dt>
                <dd>
                  {profileDisplay ? (
                    <a href={lead.profileUrl!} target="_blank" rel="noreferrer">
                      {profileDisplay.action}
                    </a>
                  ) : (
                    <div className={styles.linkCluster}>
                      <span className={styles.inlineMuted}>{missingProfileCopy}</span>
                      <a href={xSearchHref} target="_blank" rel="noreferrer">
                        Search X
                      </a>
                      <a href={googleSearchHref} target="_blank" rel="noreferrer">
                        Search Google
                      </a>
                    </div>
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt>Source</dt>
              <dd>{lead.sourceUrl ? <a href={lead.sourceUrl} target="_blank" rel="noreferrer">Open source</a> : formatStatus(lead.source)}</dd>
            </div>
            <div>
              <dt>Pricing signal</dt>
              <dd>{lead.pricingStatus}</dd>
            </div>
            <div>
              <dt>Likely Stripe</dt>
              <dd>{lead.likelyStripe}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{lead.location || "Unknown"}</dd>
            </div>
            <div>
              <dt>Last contacted</dt>
              <dd>
                {lead.lastContactedAt
                  ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
                      new Date(lead.lastContactedAt)
                    )
                  : "Not yet"}
              </dd>
            </div>
          </dl>

          <div className={styles.detailTextBlock}>
            <h3>Score reasons</h3>
            <div className={styles.reasonList}>
              {lead.scoreReasons.length > 0 ? (
                lead.scoreReasons.map((reason) => <span key={reason}>{reason}</span>)
              ) : (
                <span>No scoring reasons captured yet.</span>
              )}
            </div>
          </div>

          <div className={styles.detailTextBlock}>
            <h3>Pain signals</h3>
            <div className={styles.signalList}>
              {lead.painSignals.length > 0 ? (
                lead.painSignals.map((signal) => (
                  <span key={signal} className={styles.signalChip}>
                    {signal.replace(/_/g, " ")}
                  </span>
                ))
              ) : (
                <span className={styles.inlineMuted}>No explicit pain signal captured.</span>
              )}
            </div>
          </div>
        </section>

        <LeadDetailEditor lead={lead} />
      </div>
    </section>
  );
}
