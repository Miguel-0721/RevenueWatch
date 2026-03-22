export default function HomePage() {
  return (
    <main className="landing-page">

<header className="navbar">
  <div className="container navbar-inner">
    <a href="/" className="logo">RevenueWatch</a>

  <div className="nav-actions">
  <a href="/login" className="btn btn-primary">
    Open dashboard
  </a>
</div>
  </div>
</header>

       <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <h1 className="hero-title">
              Catch Stripe revenue issues before your clients do
            </h1>

            <p className="hero-subtitle">
              Get notified when payments fail or revenue drops across your Stripe
              accounts. Read-only monitoring, clear alerts, and no money movement.
            </p>

            <div className="hero-actions">
              <a href="/login" className="btn btn-primary">
                Start monitoring
              </a>
              <a href="#how-it-works" className="btn btn-secondary">
                How it works
              </a>
            </div>

        
          </div>

          <div className="hero-visual">
            <div className="alert-preview">
              <div className="alert-preview-header">
                <span className="alert-badge">Live alert example</span>
                <span className="alert-time">2 min ago</span>
              </div>

              <div className="alert-preview-card">
                <div className="alert-preview-top">
                  <div>
                    <p className="alert-label">Revenue drop</p>
                    <h3>Client account revenue down 42%</h3>
                  </div>
                  <span className="severity-pill severity-high">High</span>
                </div>

                <div className="alert-preview-details">
                  <div className="detail-row">
                    <span>Stripe account</span>
                    <strong>Client A</strong>
                  </div>
                  <div className="detail-row">
                    <span>Window</span>
                    <strong>Last 2 hours</strong>
                  </div>
                  <div className="detail-row">
                    <span>Status</span>
                    <strong>Email alert sent</strong>
                  </div>
                </div>
              </div>

              <p className="alert-preview-note">
                RevenueWatch surfaces issues like this quickly with calm,
                read-only alerts.
              </p>
            </div>
          </div>
        </div>
      </section>

    <section className="hero-trust-section">
  <div className="container">
    <div className="hero-trust-grid">
      <div className="hero-trust-card">
        <h3>Read-only access</h3>
        <p>We monitor Stripe data without changing billing, payouts, or account settings.</p>
      </div>

      <div className="hero-trust-card">
        <h3>No money movement</h3>
        <p>RevenueWatch does not move funds, edit payouts, or perform financial actions.</p>
      </div>

      <div className="hero-trust-card">
        <h3>Monitoring and alerts only</h3>
        <p>Get clear alerts when payment failures spike or revenue drops unexpectedly.</p>
      </div>
    </div>
  </div>
</section>


<section id="how-it-works" className="section section-tinted">
        <div className="container">
          <h2 className="section-title">How it works</h2>

          <div className="grid grid-3">
            <div className="card">
              <h3>1. Connect Stripe</h3>
              <p>Securely connect your Stripe accounts using read-only access.</p>
            </div>

            <div className="card">
              <h3>2. We monitor activity</h3>
              <p>
                RevenueWatch tracks payment failures and revenue changes in real time.
              </p>
            </div>

            <div className="card">
              <h3>3. Get alerts</h3>
              <p>Receive email alerts when something unusual happens.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-muted">
        <div className="container">
          <h2 className="section-title">What we monitor</h2>

          <div className="grid grid-2">
            <div className="card feature-card">
              <h3>Payment failure spikes</h3>
              <p>
                Detect unusual increases in failed payments across your Stripe accounts.
              </p>
            </div>

            <div className="card feature-card">
              <h3>Revenue drops</h3>
              <p>
                Identify sustained drops in revenue compared to normal patterns.
              </p>
            </div>
          </div>
        </div>
      </section>
<section className="section section-tinted">
  <div className="container narrow">
    <h2 className="section-title">Who it’s for</h2>

    <p className="section-text">
      Built for agencies and teams managing multiple Stripe accounts.
    </p>

    <p className="section-text who-followup">
      Get immediate alerts when revenue drops or payment failures spike.
    </p>
  </div>
</section>


<section className="section">
  <div className="container narrow">
    <h2 className="section-title">About RevenueWatch</h2>
    <p className="section-text">
      RevenueWatch is an independent software tool built to help businesses monitor Stripe activity and detect issues early.
    </p>
  </div>
</section>

    <section className="section cta-section">
  <div className="container cta-box">
    <h2 className="section-title">Start monitoring your Stripe accounts</h2>
    <a href="/login" className="btn btn-primary">
      Start monitoring
    </a>

    <p className="hero-note">
  Stripe connection available after activation • Read-only access
</p>
  </div>
</section>

      <footer className="site-footer">
        <div className="container footer-inner">
        <div>
  © RevenueWatch • contact@revenuewatch.app
</div>
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