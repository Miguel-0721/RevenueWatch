export default function Navbar() {
  return (
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
  );
}