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
      <RevenueWatchLogo size="header" />
    </Link>
  );
}

function getDisplayName(name?: string | null, email?: string | null) {
  if (name) {
    return name.trim().split(/\s+/)[0];
  }

  return email?.split("@")[0] || "Account";
}

function MarketingNavLinks() {
  return (
    <nav className="rw-nav-links" aria-label="Primary">
      <Link href="/#how-it-works" className="rw-nav-link">
        How it Works
      </Link>
      <Link href="/#pricing" className="rw-nav-link">
        Pricing
      </Link>
      <Link href="/#support" className="rw-nav-link">
        Support
      </Link>
    </nav>
  );
}

function UserMenu({
  displayName,
  image,
  name,
  email,
}: {
  displayName: string;
  image?: string | null;
  name?: string | null;
  email?: string | null;
}) {
  return (
    <details className="rw-user-menu">
      <summary className="rw-user-trigger">
        {image ? (
          <img src={image} alt={name || "User"} className="rw-avatar" />
        ) : (
          <div className="rw-avatar rw-avatar-fallback">
            {(name?.[0] || email?.[0] || "U").toUpperCase()}
          </div>
        )}

        <div className="rw-user-meta">
          <span>{displayName}</span>
        </div>

        <span className="rw-menu-caret" aria-hidden="true" />
      </summary>

      <div className="rw-user-dropdown">
        <Link href="/dashboard/billing" className="rw-user-dropdown-link">
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
  );
}

export default async function Navbar({
  ctaLabel = "Get started",
  ctaHref = "/login",
  hideCta = false,
  mode = "marketing",
}: NavbarProps) {
  const session = await auth();
  const displayName = getDisplayName(session?.user?.name, session?.user?.email);

  if (mode === "app" && session?.user) {
    return (
      <header className={`rw-topbar${mode === "app" ? " rw-topbar-app" : ""}`}>
        <div className="rw-shell rw-topbar-inner">
          <Brand />

          <AppNavLinks />

          <div className="rw-auth-area">
            <UserMenu
              displayName={displayName}
              image={session.user.image}
              name={session.user.name}
              email={session.user.email}
            />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="rw-topbar">
      <div className="rw-shell rw-topbar-inner">
        <Brand />

        <MarketingNavLinks />

        {session?.user ? (
          <div className="rw-auth-area rw-auth-area-marketing">
            <Link href="/dashboard" className="rw-connect-button">
              Dashboard
            </Link>
            <UserMenu
              displayName={displayName}
              image={session.user.image}
              name={session.user.name}
              email={session.user.email}
            />
          </div>
        ) : hideCta ? null : (
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
