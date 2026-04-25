import Navbar from "@/components/Navbar";
import MarketingFooter from "@/components/MarketingFooter";

export default function ContactPage() {
  return (
    <main className="legal-page">
      <Navbar mode="marketing" />
      <div className="rw-shell legal-container">
        <h1 className="legal-title">Contact</h1>
        <p className="legal-updated">RevenueWatch</p>
        <p className="legal-meta">
          RevenueWatch is operated by Parmora, registered in the Netherlands.
        </p>

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
