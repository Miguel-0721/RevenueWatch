export default function TermsPage() {
  return (
    <main className="legal-page">
      <header className="navbar">
        <div className="container navbar-inner">
          <a href="/" className="logo">
            RevenueWatch
          </a>

          <div className="nav-actions">
           <a href="/login" className="btn btn-primary">
  Open dashboard
</a>
          </div>
        </div>
      </header>

      <div className="container legal-container">
        <h1 className="legal-title">Terms of Service</h1>
        <p className="legal-updated">Last updated: March 2026</p>

        <section className="legal-section">
          <h2>Overview</h2>
          <p>
            These Terms of Service govern your use of RevenueWatch. By accessing or using
            the service, you agree to these terms.
          </p>
        </section>

        <section className="legal-section">
          <h2>Service description</h2>
          <p>
            RevenueWatch is a read-only monitoring and alerting tool for connected Stripe
            accounts. It is intended to detect revenue drops and payment failure spikes
            and send operational alerts.
          </p>
        </section>

        <section className="legal-section">
          <h2>No financial advice</h2>
          <p>
            RevenueWatch provides factual monitoring and alerting only. It does not
            provide financial advice, legal advice, recommendations, or guarantees.
          </p>
        </section>

        <section className="legal-section">
          <h2>No money movement</h2>
          <p>
            RevenueWatch does not move funds, issue refunds, modify payment settings, or
            act as a payment processor.
          </p>
        </section>

        <section className="legal-section">
          <h2>Availability</h2>
          <p>
            We aim to provide a reliable service, but we do not guarantee uninterrupted
            availability or error-free operation at all times.
          </p>
        </section>

        <section className="legal-section">
          <h2>User responsibilities</h2>
          <ul>
            <li>Provide accurate information when using the service.</li>
            <li>Use the service only for lawful purposes.</li>
            <li>Maintain the security of your own accounts and credentials.</li>
            <li>Review alerts and operational decisions independently.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, RevenueWatch is provided on an
            “as-is” and “as-available” basis. We are not liable for indirect,
            incidental, special, consequential, or business losses arising from the use
            of the service.
          </p>
        </section>

       <section className="legal-section">
  <h2>Termination</h2>
  <p>
    We may suspend or terminate access to the service if necessary for security,
    abuse prevention, legal compliance, or operational reasons.
  </p>
  <p>
    Subscriptions can be cancelled at any time. No refunds are issued for partial
    billing periods.
  </p>
</section>

        <section className="legal-section">
          <h2>Changes</h2>
          <p>
            We may update these terms from time to time. Continued use of the service
            after updates means you accept the revised terms.
          </p>
        </section>

        <section className="legal-section">
          <h2>Contact</h2>
          <p>
            For questions about these terms, contact{" "}
            <a href="mailto:contact@revenuewatch.app">contact@revenuewatch.app</a>.
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