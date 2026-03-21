export default function ContactPage() {
  return (
    <main className="legal-page">
      <header className="navbar">
        <div className="container navbar-inner">
          <a href="/" className="logo">
            RevenueWatch
          </a>

          <div className="nav-actions">
            <a href="/dashboard" className="btn btn-primary">
              Open dashboard
            </a>
          </div>
        </div>
      </header>

      <div className="container legal-container">
        <h1 className="legal-title">Contact</h1>
        <p className="legal-updated">RevenueWatch</p>

        <section className="legal-section">
          <h2>General inquiries</h2>
          <p>
            For support, business inquiries, or general questions, contact us at{" "}
            <a href="mailto:contact@revenuewatch.app">contact@revenuewatch.app</a>.
          </p>
        </section>

        <section className="legal-section">
          <h2>Service description</h2>
          <p>
            RevenueWatch is a read-only Stripe monitoring and alerting tool designed to
            detect payment failure spikes and revenue drops.
          </p>
        </section>

        <section className="legal-section">
          <h2>Response time</h2>
          <p>
            We aim to respond to relevant inquiries as soon as reasonably possible.
          </p>
        </section>
      </div>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div>© RevenueWatch • contact@revenuewatch.app</div>
          <div className="footer-links">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/contact">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  );
}