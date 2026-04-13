import Link from "next/link";
import StitchIcon from "./StitchIcon";

export default function MarketingFooter() {
  return (
    <footer className="rw-footer">
      <div className="rw-shell rw-footer-inner">
        <div className="rw-footer-brand">
          <div className="rw-footer-logo">
            <StitchIcon name="monitoring" className="rw-icon" />
            <span className="rw-wordmark">RevenueWatch</span>
          </div>
          <p>{"\u00A9 2024 RevenueWatch \u2022 Operated by Parmora"}</p>
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
