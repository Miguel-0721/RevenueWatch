import { redirect } from "next/navigation";
import { getLeadsAdminSession } from "@/lib/leads-auth";
import { listDiscoveredProductHuntLeads } from "@/lib/lead-store";
import type { LeadCandidate } from "@/lib/leads";
import { DiscoverLeadsPanel } from "../DiscoverLeadsPanel";
import styles from "../leads.module.css";
import Link from "next/link";

export default async function DiscoverLeadsPage() {
  const session = await getLeadsAdminSession();
  if (!session) redirect("/dashboard");

  const discoveredLeads = await listDiscoveredProductHuntLeads();
  const initialCandidates: LeadCandidate[] = discoveredLeads.map((lead) => ({
    name: lead.name,
    handle: lead.handle,
    profileUrl: lead.profileUrl,
    productName: lead.productName,
    website: lead.website,
    source: lead.source as LeadCandidate["source"],
    sourceUrl: lead.sourceUrl,
    location: lead.location,
    bio: lead.bio,
    postText: lead.postText,
    postUrl: lead.postUrl,
    pricingStatus: lead.pricingStatus as LeadCandidate["pricingStatus"],
    likelyStripe: lead.likelyStripe as LeadCandidate["likelyStripe"],
    painSignals: lead.painSignals,
    score: lead.score,
    scoreReasons: lead.scoreReasons,
    status: lead.status as LeadCandidate["status"],
    notes: lead.notes,
    suggestedReply: lead.suggestedReply,
    lastContactedAt: lead.lastContactedAt,
  }));

  return (
    <section className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Private internal tool</p>
          <h1>Discover leads</h1>
          <p>
            Pull possible SaaS founder leads from Product Hunt and X, score them, then save only
            the best ones for manual outreach.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/dashboard/leads/post-drafts" className={styles.secondaryButton}>
            Post drafts
          </Link>
        </div>
      </header>

      <DiscoverLeadsPanel initialCandidates={initialCandidates} />
    </section>
  );
}
