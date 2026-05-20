import Link from "next/link";
import { redirect } from "next/navigation";
import { getLeadsAdminSession } from "@/lib/leads-auth";
import { listPostDrafts } from "@/lib/post-draft-store";
import { PostDraftsWorkspace } from "../PostDraftsWorkspace";
import styles from "../leads.module.css";

export default async function PostDraftsPage() {
  const session = await getLeadsAdminSession();
  if (!session) redirect("/dashboard");

  const drafts = await listPostDrafts();

  return (
    <section className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Private internal tool</p>
          <h1>Post Drafts</h1>
          <p>
            Draft short founder-style posts for Parveil, review screenshot context, and copy the
            final text manually. Nothing is posted automatically.
          </p>
        </div>

        <div className={styles.headerActions}>
          <Link href="/dashboard/leads" className={styles.secondaryButton}>
            Back to leads
          </Link>
        </div>
      </header>

      <PostDraftsWorkspace initialDrafts={drafts} />
    </section>
  );
}
