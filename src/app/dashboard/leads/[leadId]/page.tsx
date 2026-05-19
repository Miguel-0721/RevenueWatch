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
              <dd>{lead.handle || "Unknown"}</dd>
            </div>
            <div>
              <dt>Website</dt>
              <dd>{lead.website ? <a href={lead.website} target="_blank" rel="noreferrer">Open website</a> : "None"}</dd>
            </div>
            <div>
              <dt>Profile</dt>
              <dd>{lead.profileUrl ? <a href={lead.profileUrl} target="_blank" rel="noreferrer">Open profile</a> : "None"}</dd>
            </div>
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
