import Link from "next/link";
import RevenueWatchLogo from "./RevenueWatchLogo";

export default function MarketingFooter() {
  return (
    <footer id="support" className="rw-footer">
      <div className="rw-shell rw-footer-inner">
        <div className="rw-footer-brand">
          <div className="rw-footer-logo">
            <RevenueWatchLogo compact />
          </div>
          <p>{"\u00A9 2026 RevenueWatch"}</p>
        </div>

        <nav className="rw-footer-links" aria-label="Footer">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </div>
    </footer>
  );
}
