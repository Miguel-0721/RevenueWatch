export default function HomePage() {
  return (
    <main className="landing-page">

<header className="navbar">
  <div className="container navbar-inner">
    <a href="/" className="logo">RevenueWatch</a>

  <div className="nav-actions">
  <a href="/login" className="btn btn-primary">
    Get started
  </a>
</div>
  </div>
</header>

       <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
           <h1 className="hero-title">
  Catch payment failures and revenue drops before your clients do
</h1>

            <p className="hero-subtitle">
              Get notified when payments fail or revenue drops across your Stripe
              accounts. Read-only monitoring, clear alerts, and no money movement.
            </p>

            <div className="hero-actions">
             <a href="/login" className="btn btn-primary">
  Connect Stripe &amp; start monitoring
</a>
              <a href="#how-it-works" className="btn btn-secondary">
                How it works
              </a>
            </div>

        
          </div>

          <div className="hero-visual">
            <div className="alert-preview">
              <div className="alert-preview-header">
                <span className="alert-badge">Example alert</span>
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
    <h3>Get notified instantly</h3>
    <p>Receive a clear email when something needs your attention.</p>
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
<p>RevenueWatch watches your Stripe activity and flags anything unusual.</p>

        <div className="mock-monitor-box">
          <div className="mock-bar mock-bar-1" />
          <div className="mock-bar mock-bar-2" />
          <div className="mock-bar mock-bar-3" />
          <div className="mock-bar mock-bar-4" />
        </div>
      </div>

      <div className="how-visual-card">
        <div className="how-visual-kicker">Step 3</div>
       <h3>Get notified instantly</h3>
<p>Receive a clear email when something needs your attention.</p>

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
<span className="monitor-pill monitor-pill-danger">Revenue monitoring</span>
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
    <span>Revenue compared to normal</span>
    <strong>Below expected</strong>
  </div>
  <div className="monitor-ui-row">
    <span>Completed payments</span>
    <strong>Decreasing</strong>
  </div>
  <div className="monitor-ui-row">
    <span>Recent payments</span>
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
      <p>Monitor multiple client Stripe accounts and catch issues before clients notice.</p>
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


<section className="section section-muted">
 <div className="container">
 <h2 className="section-title">Simple pricing based on how many Stripe accounts you monitor</h2>
<p className="section-text section-intro">
  Paid plans are built for teams managing multiple Stripe accounts.
</p>
<p className="pricing-early-access">
  Early access: the Starter plan is free while we onboard initial users.
</p>

   <div className="pricing-grid">
  <div className="pricing-card">
    <div className="pricing-card-body">
      <div className="pricing-card-top">
        <div>
          <h3>Starter</h3>
          <p className="pricing-subtitle">For individuals monitoring a single Stripe account</p>
        </div>
      </div>

      <div className="pricing-price">Free</div>
      <div className="pricing-limit">1 Stripe account</div>

      <ul className="pricing-list">
        <li>Payment failure alerts</li>
        <li>Revenue drop alerts</li>
        <li>Read-only monitoring</li>
      </ul>
    </div>

    <a href="/login" className="btn btn-secondary">
      Start free
    </a>
  </div>

  <div className="pricing-card pricing-card-featured">
    <div className="pricing-card-body">
      <div className="pricing-badge">Most popular</div>

      <div className="pricing-card-top">
        <div>
          <h3>Growth</h3>
          <p className="pricing-subtitle">Monitor multiple Stripe accounts across clients in one place.</p>
        </div>
      </div>

      <div className="pricing-price">€79/mo</div>
      <div className="pricing-limit">Up to 10 Stripe accounts</div>

      <ul className="pricing-list">
        <li>Monitor up to 10 Stripe accounts</li>
        <li>Payment failure + revenue alerts</li>
        <li>Multi-account monitoring</li>
        <li>Instant email alerts</li>
      </ul>
    </div>

    <a href="/login" className="btn btn-primary">
      Start monitoring
    </a>
  </div>

  <div className="pricing-card">
    <div className="pricing-card-body">
      <div className="pricing-card-top">
        <div>
          <h3>Pro</h3>
          <p className="pricing-subtitle">For teams managing a larger number of Stripe accounts</p>
        </div>
      </div>

      <div className="pricing-price">€149/mo</div>
      <div className="pricing-limit">Up to 25 Stripe accounts</div>

      <ul className="pricing-list">
        <li>Monitor up to 25 Stripe accounts</li>
        <li>All alerts across connected accounts</li>
        <li>Higher account capacity</li>
        <li>Designed for larger teams</li>
      </ul>
    </div>

    <a href="/contact" className="btn btn-secondary">
      Contact us
    </a>
  </div>
</div>

   <p className="pricing-note">
  All plans use read-only Stripe access. RevenueWatch never moves money or modifies your account.
</p>
  </div>
</section>

<section className="section">
  <div className="container narrow">
    <h2 className="section-title">About RevenueWatch</h2>

    <p className="section-text">
  RevenueWatch is a monitoring tool built specifically for Stripe-based businesses to detect payment and revenue issues early.
</p>

    <p className="section-text who-followup">
  It does not move money, change billing, or interfere with your operations. It simply watches activity and sends clear alerts when something looks wrong.
</p>
  </div>
</section>

    <section className="section cta-section">
  <div className="container cta-box">
    <h2 className="section-title">Start monitoring your Stripe accounts</h2>
   <a href="/login" className="btn btn-primary">
  Connect Stripe &amp; start monitoring
</a>

    <p className="hero-note">
  Read-only Stripe connection • No money movement
</p>
  </div>
</section>

      <footer className="site-footer">
        <div className="container footer-inner">
    <div>
  © RevenueWatch • <a href="mailto:contact@revenuewatch.app">contact@revenuewatch.app</a>
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