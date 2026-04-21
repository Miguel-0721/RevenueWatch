import Link from "next/link";
import AppNavLinks from "./AppNavLinks";
import StitchIcon from "./StitchIcon";
import { auth, signOut } from "../auth";

type NavbarProps = {
  ctaLabel?: string;
  ctaHref?: string;
  hideCta?: boolean;
};

function Brand() {
  return (
    <Link href="/" className="rw-brand">
      <StitchIcon name="monitoring" className="rw-icon" />
      <span className="rw-wordmark">RevenueWatch</span>
    </Link>
  );
}

function getDisplayName(name?: string | null, email?: string | null) {
  if (name) {
    return name.trim().split(/\s+/)[0];
  }

  return email?.split("@")[0] || "Account";
}

export default async function Navbar({
  ctaLabel = "Connect Stripe",
  ctaHref = "/login",
  hideCta = false,
}: NavbarProps) {
  const session = await auth();
  const displayName = getDisplayName(session?.user?.name, session?.user?.email);

  if (session?.user) {
    return (
      <header className="rw-topbar">
        <div className="rw-shell rw-topbar-inner">
          <Brand />

          <AppNavLinks />

          <div className="rw-auth-area">
            <div className="rw-user-block">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || "User"}
                  className="rw-avatar"
                />
              ) : (
                <div className="rw-avatar rw-avatar-fallback">
                  {(session.user.name?.[0] || session.user.email?.[0] || "U").toUpperCase()}
                </div>
              )}

              <div className="rw-user-meta">
                <span>{displayName}</span>
              </div>

              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button type="submit" className="rw-signout">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="rw-topbar">
      <div className="rw-shell rw-topbar-inner">
        <Brand />

        <nav className="rw-nav-links" aria-label="Primary">
          <Link href="/" className="rw-nav-link rw-nav-link-active">
            Home
          </Link>
          <Link href="/#how-it-works" className="rw-nav-link">
            How it Works
          </Link>
          <Link href="/#pricing" className="rw-nav-link">
            Pricing
          </Link>
          <Link href="/contact" className="rw-nav-link">
            Support
          </Link>
        </nav>

        {hideCta ? null : (
          <Link href={ctaHref} className="rw-connect-button">
            {ctaLabel}
          </Link>
        )}
      </div>
    </header>
  );
}
