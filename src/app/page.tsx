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
        <div className="container">
          <h1 className="hero-title">
            Monitor Stripe revenue issues before clients notice
          </h1>

         <p className="hero-subtitle">
  RevenueWatch helps agencies and online businesses detect payment failure spikes and revenue drops across Stripe accounts with simple, read-only alerts.
</p>

     <div className="hero-actions">
  <a href="/login" className="btn btn-primary">
    Start monitoring
  </a>
  <a href="#how-it-works" className="btn btn-secondary">
    How it works
  </a>
</div>

<p className="hero-note">
  Built for Stripe-based businesses • Read-only access • No money movement
</p>
        </div>
      </section>

      <section className="trust-bar">
        <div className="container trust-items">
          <div className="trust-item">Read-only Stripe access</div>
          <div className="trust-item">No money movement or billing changes</div>
          <div className="trust-item">Monitoring and alerting only</div>
        </div>
      </section>

      <section id="how-it-works" className="section">
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
<section className="section">
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