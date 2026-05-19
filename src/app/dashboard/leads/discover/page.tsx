import { redirect } from "next/navigation";
import { getLeadsAdminSession } from "@/lib/leads-auth";
import { DiscoverLeadsPanel } from "../DiscoverLeadsPanel";
import styles from "../leads.module.css";

export default async function DiscoverLeadsPage() {
  const session = await getLeadsAdminSession();
  if (!session) redirect("/dashboard");

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
      </header>

      <DiscoverLeadsPanel />
    </section>
  );
}
