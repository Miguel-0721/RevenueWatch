import Link from "next/link";
import { redirect } from "next/navigation";
import { getLeadsAdminSession } from "@/lib/leads-auth";
import { listLeads } from "@/lib/lead-store";
import type { LeadRecord } from "@/lib/leads";
import { LeadManualAddForm } from "./LeadManualAddForm";
import { LeadRowActions } from "./LeadRowActions";
import styles from "./leads.module.css";

function scoreLabel(score: number) {
  if (score >= 8) return "Very strong";
  if (score >= 6) return "Strong";
  if (score >= 4) return "Possible fit";
  return "Low fit";
}

function formatSource(source: string) {
  return source.replace(/_/g, " ");
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    source?: string;
    status?: string;
    minScore?: string;
    likelyStripe?: string;
    pricingStatus?: string;
  }>;
}) {
  const session = await getLeadsAdminSession();
  if (!session) redirect("/dashboard");

  const params = searchParams ? await searchParams : undefined;
  const source = params?.source ?? "all";
  const status = params?.status ?? "all";
  const likelyStripe = params?.likelyStripe ?? "all";
  const pricingStatus = params?.pricingStatus ?? "all";
  const minScore = Number(params?.minScore ?? "0");

  const leads = (await listLeads({
    source,
    status,
    likelyStripe,
    pricingStatus,
    minScore: !Number.isNaN(minScore) ? minScore : 0,
  })) as LeadRecord[];

  const bestLeads = leads
    .filter((lead) => !["skipped", "not_fit", "customer"].includes(lead.status))
    .slice(0, 5);

  return (
    <section className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Private internal tool</p>
          <h1>Parveil Leads</h1>
          <p>
            Find likely SaaS founders, score them, and keep manual outreach organized without
            automating any posting or messaging.
          </p>
        </div>

        <div className={styles.headerActions}>
          <Link href="/dashboard/leads/discover" className={styles.primaryLink}>
            Discover leads
          </Link>
        </div>
      </header>

      <div className={styles.topGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Today&apos;s Best Leads</h2>
            <span className={styles.panelMeta}>{bestLeads.length} shown</span>
          </div>

          {bestLeads.length === 0 ? (
            <div className={styles.emptyState}>
              No high-priority leads yet. Run a scan or add a lead manually.
            </div>
          ) : (
            <div className={styles.bestLeadGrid}>
              {bestLeads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/dashboard/leads/${lead.id}`}
                  className={styles.bestLeadCard}
                >
                  <div className={styles.bestLeadTop}>
                    <div>
                      <strong>{lead.name}</strong>
                      <span>{lead.productName || lead.handle || "Manual lead"}</span>
                    </div>
                    <span className={styles.scoreBadge}>{lead.score}/10</span>
                  </div>
                  <p>{lead.bio || lead.notes || "Open the detail page to review context and draft a reply."}</p>
                  <div className={styles.reasonList}>
                    {(lead.scoreReasons || []).slice(0, 2).map((reason) => (
                      <span key={reason}>{reason}</span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Manual add</h2>
            <span className={styles.panelMeta}>Quick capture</span>
          </div>
          <LeadManualAddForm />
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>All leads</h2>
          <span className={styles.panelMeta}>{leads.length} total</span>
        </div>

        <form className={styles.filterBar}>
          <select name="source" defaultValue={source} className={styles.filterInput}>
            <option value="all">All sources</option>
            <option value="product_hunt">Product Hunt</option>
            <option value="x">X</option>
            <option value="indie_hackers">Indie Hackers</option>
            <option value="manual">Manual</option>
          </select>

          <select name="status" defaultValue={status} className={styles.filterInput}>
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="saved">Saved</option>
            <option value="contacted">Contacted</option>
            <option value="interested">Interested</option>
            <option value="customer">Customer</option>
            <option value="skipped">Skipped</option>
            <option value="not_fit">Not fit</option>
          </select>

          <select
            name="likelyStripe"
            defaultValue={likelyStripe}
            className={styles.filterInput}
          >
            <option value="all">Any Stripe signal</option>
            <option value="yes">Likely Stripe</option>
            <option value="no">Not likely Stripe</option>
            <option value="unknown">Unknown</option>
          </select>

          <select
            name="pricingStatus"
            defaultValue={pricingStatus}
            className={styles.filterInput}
          >
            <option value="all">Any pricing signal</option>
            <option value="yes">Pricing page found</option>
            <option value="no">No pricing page</option>
            <option value="unknown">Unknown</option>
          </select>

          <select name="minScore" defaultValue={String(minScore)} className={styles.filterInput}>
            <option value="0">Any score</option>
            <option value="4">4+</option>
            <option value="6">6+</option>
            <option value="8">8+</option>
          </select>

          <button type="submit" className={styles.secondaryButton}>
            Apply filters
          </button>
        </form>

        {leads.length === 0 ? (
          <div className={styles.emptyState}>
            No leads match the current filters. Run discovery or add a lead manually.
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Source</th>
                  <th>Signals</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <div className={styles.leadCell}>
                        <Link href={`/dashboard/leads/${lead.id}`} className={styles.leadLink}>
                          {lead.name}
                        </Link>
                        <span>{lead.productName || lead.handle || lead.website || "No product yet"}</span>
                      </div>
                    </td>
                    <td className={styles.mutedCell}>{formatSource(lead.source)}</td>
                    <td>
                      <div className={styles.signalList}>
                        {(lead.painSignals || []).slice(0, 3).map((signal) => (
                          <span key={signal} className={styles.signalChip}>
                            {signal.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className={styles.scoreCell}>
                        <strong>{lead.score}/10</strong>
                        <span>{scoreLabel(lead.score)}</span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.statusBadge}>{formatStatus(lead.status)}</span>
                    </td>
                    <td>
                      <LeadRowActions lead={lead} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
