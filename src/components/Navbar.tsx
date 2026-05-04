import Link from "next/link";
import AppNavLinks from "./AppNavLinks";
import RevenueWatchLogo from "./RevenueWatchLogo";
import { auth, signOut } from "../auth";

type NavbarProps = {
  ctaLabel?: string;
  ctaHref?: string;
  hideCta?: boolean;
  mode?: "marketing" | "app";
};

function Brand() {
  return (
    <Link href="/" className="rw-brand">
      <RevenueWatchLogo />
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
  ctaLabel = "Get started",
  ctaHref = "/login",
  hideCta = false,
  mode = "marketing",
}: NavbarProps) {
  const session = await auth();
  const displayName = getDisplayName(session?.user?.name, session?.user?.email);

  if (session?.user) {
    return (
      <header className={`rw-topbar${mode === "app" ? " rw-topbar-app" : ""}`}>
        <div className="rw-shell rw-topbar-inner">
          <Brand />

          <AppNavLinks />

          <div className="rw-auth-area">
            <details className="rw-user-menu">
              <summary className="rw-user-trigger">
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

                <span className="rw-menu-caret" aria-hidden="true" />
              </summary>

              <div className="rw-user-dropdown">
                <Link href="/api/billing/portal" className="rw-user-dropdown-link">
                  Billing
                </Link>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                >
                  <button type="submit" className="rw-user-dropdown-button">
                    Sign out
                  </button>
                </form>
              </div>
            </details>
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
          <div className="rw-auth-area rw-auth-area-marketing">
            <Link href="/login" className="rw-text-action">
              Sign in
            </Link>
            <Link href={ctaHref} className="rw-connect-button">
              {ctaLabel}
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
