import Navbar from "@/components/Navbar";
import MarketingFooter from "@/components/MarketingFooter";

type ContactPageProps = {
  searchParams?: Promise<{
    plan?: string;
  }>;
};

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const isProInquiry = params?.plan === "pro";

  return (
    <main className="legal-page">
      <Navbar mode="marketing" />
      <div className="rw-shell legal-container">
        <h1 className="legal-title">Contact</h1>
        <p className="legal-updated">RevenueWatch</p>
        <p className="legal-meta">
          RevenueWatch is operated by Parmora, registered in the Netherlands.
        </p>

        {isProInquiry ? (
          <section className="legal-section">
            <h2>Pro upgrade request</h2>
            <p>
              Pro is designed for larger portfolios. Tell us about your setup
              and we&apos;ll get you onboarded.
            </p>
            <p>
              Contact us at{" "}
              <a href="mailto:contact@revenuewatch.app?subject=RevenueWatch%20Pro%20upgrade">
                contact@revenuewatch.app
              </a>{" "}
              and mention that you want to upgrade to Pro.
            </p>
          </section>
        ) : null}

        <section className="legal-section">
          <h2>General inquiries</h2>
          <p>
            For support, business inquiries, or general questions, contact us at{" "}
            <a href="mailto:contact@revenuewatch.app">contact@revenuewatch.app</a>.
          </p>
          <p>Phone: +31 6 27128476</p>
          <p>Support is primarily handled via email for faster assistance.</p>
        </section>

        <section className="legal-section">
          <h2>Service description</h2>
          <p>
            RevenueWatch is a read-only Stripe monitoring and alerting tool
            designed to detect payment failure spikes and revenue drops.
          </p>
        </section>

        <section className="legal-section">
          <h2>Response time</h2>
          <p>
            We aim to respond to relevant inquiries as soon as reasonably
            possible.
          </p>
        </section>
      </div>

      <MarketingFooter />
    </main>
  );
}
