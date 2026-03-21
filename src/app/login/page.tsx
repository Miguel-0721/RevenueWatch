export default function LoginPage() {
  return (
    <main className="legal-page">
      <header className="navbar">
        <div className="container navbar-inner">
          <a href="/" className="logo">
            RevenueWatch
          </a>

          <div className="nav-actions">
            <a href="/" className="btn btn-secondary">
              Back to home
            </a>
          </div>
        </div>
      </header>

      <div className="container login-container">
        <div className="login-card">
    <p className="login-eyebrow">RevenueWatch</p>
<h1 className="login-title">Dashboard access</h1>

<p className="login-text">
  RevenueWatch is currently in setup and Stripe activation. Full account access
  and Stripe connection will be enabled after verification is complete.
</p>

<p className="login-text">
  In the meantime, you can view the dashboard preview or contact us for
  inquiries.
</p>

          <div className="login-actions">
            <a href="/dashboard" className="btn btn-primary">
              View dashboard preview
            </a>

            <a href="/contact" className="btn btn-secondary">
              Contact
            </a>
          </div>
        </div>
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