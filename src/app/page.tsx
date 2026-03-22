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
  <div className="container how-it-works-layout">
    <div className="how-it-works-left">
      <h2 className="section-title">How it works</h2>

      <div className="timeline">
        <div className="timeline-item">
          <div className="timeline-marker">1</div>
          <div className="timeline-content">
            <h3>Connect Stripe</h3>
            <p>Securely connect your Stripe accounts using read-only access.</p>
          </div>
        </div>

        <div className="timeline-line" />

        <div className="timeline-item">
          <div className="timeline-marker">2</div>
          <div className="timeline-content">
            <h3>We monitor activity</h3>
            <p>
              RevenueWatch tracks payment failures and revenue changes in real
              time.
            </p>
          </div>
        </div>

        <div className="timeline-line" />

        <div className="timeline-item">
          <div className="timeline-marker">3</div>
          <div className="timeline-content">
            <h3>Get alerts</h3>
            <p>Receive email alerts when something unusual happens.</p>
          </div>
        </div>
      </div>
    </div>

    <div className="how-it-works-right">
      <div className="how-visual-card">
        <div className="how-visual-kicker">Step 1</div>
        <h3>Connect with Stripe</h3>
        <p>Read-only connection for monitoring only.</p>

        <div className="mock-connect-box">
          <div className="mock-connect-top">
            <span className="mock-dot" />
            <span className="mock-dot" />
            <span className="mock-dot" />
          </div>
          <div className="mock-connect-button">Connect Stripe account</div>
        </div>
      </div>

      <div className="how-visual-card">
        <div className="how-visual-kicker">Step 2</div>
        <h3>Monitoring in the background</h3>
        <p>RevenueWatch checks activity and compares it to normal patterns.</p>

        <div className="mock-monitor-box">
          <div className="mock-bar mock-bar-1" />
          <div className="mock-bar mock-bar-2" />
          <div className="mock-bar mock-bar-3" />
          <div className="mock-bar mock-bar-4" />
        </div>
      </div>

      <div className="how-visual-card">
        <div className="how-visual-kicker">Step 3</div>
        <h3>Email alert sent</h3>
        <p>Clear alerts when something looks unusual.</p>

        <div className="mock-alert-mini">
          <div className="mock-alert-row">
            <span>Revenue drop detected</span>
            <strong>High</strong>
          </div>
          <div className="mock-alert-sub">Client A • Last 2 hours</div>
        </div>
      </div>
    </div>
  </div>
</section>

<section className="section section-muted">
  <div className="container">
<h2 className="section-title">What we monitor</h2>
<p className="section-text section-intro">
  Two core alerts help you spot unusual Stripe activity early.
</p>
    <div className="monitor-grid">
      <div className="monitor-card">
        <div className="monitor-card-top">
       <div>
  <h3>Payment failure spikes</h3>
</div>
<span className="monitor-pill monitor-pill-danger">Failure monitoring</span>
        </div>

        <p className="monitor-text">
          Detect sudden increases in failed payments before they start affecting
          revenue and customer experience.
        </p>

        <div className="monitor-ui">
          <div className="monitor-ui-header">
            <span className="status-dot" />
            <strong>Failure spike detected</strong>
          </div>

          <div className="monitor-ui-list">
         <div className="monitor-ui-row">
  <span>Card declines increasing</span>
  <strong>Above normal</strong>
</div>
            <div className="monitor-ui-row">
              <span>Payment failures</span>
<strong>Spike detected</strong>
            </div>
            <div className="monitor-ui-row">
              <span>Checkout errors</span>
<strong>Unusual increase</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="monitor-card">
        <div className="monitor-card-top">
         <div>
  <h3>Revenue drops</h3>
</div>
<span className="monitor-pill">Revenue monitoring</span>
        </div>

        <p className="monitor-text">
          Identify sustained revenue declines compared to normal account
          patterns, so issues are noticed early.
        </p>

        <div className="monitor-ui">
         <div className="monitor-ui-header">
 <span className="status-dot" />
  <strong>Revenue drop detected</strong>
</div>

          <div className="monitor-ui-list">
            <div className="monitor-ui-row">
              <span>Revenue vs normal</span>
<strong>Below expected</strong>
            </div>
            <div className="monitor-ui-row">
             <span>Successful payments</span>
<strong>Decreasing</strong>
            </div>
            <div className="monitor-ui-row">
              <span>Recent activity</span>
<strong>Lower than normal</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
<section className="section section-tinted">
  <div className="container">
    <h2 className="section-title">Who it’s for</h2>

    <div className="grid grid-3">
      <div className="card">
        <h3>Agencies</h3>
        <p>Monitor multiple client Stripe accounts and catch issues early.</p>
      </div>

      <div className="card">
        <h3>SaaS teams</h3>
        <p>Spot payment failures and revenue drops before customers notice.</p>
      </div>

      <div className="card">
        <h3>Small businesses</h3>
        <p>Stay informed when Stripe activity changes unexpectedly.</p>
      </div>
    </div>
  </div>
</section>


<section className="section">
  <div className="container narrow">
    <h2 className="section-title">About RevenueWatch</h2>

    <p className="section-text">
      RevenueWatch is an independent software tool built to help businesses monitor Stripe activity and detect issues early.
    </p>

    <p className="section-text who-followup">
      It does not move money, does not change billing, and does not interfere with your operations. It simply watches activity and sends clear alerts when something looks wrong.
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