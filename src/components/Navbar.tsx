import { auth, signOut } from "../auth";

export default async function Navbar() {
  const session = await auth();

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <a href="/" className="logo">
          RevenueWatch
        </a>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <a
  href="/"
  style={{
    fontSize: "13px",
    color: "#64748b",
    textDecoration: "none",
    fontWeight: 600,
  }}
>
  ← Home
</a>

          {session?.user ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                paddingLeft: "12px",
                borderLeft: "1px solid #e7edf5",
              }}
            >
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || "User"}
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "999px",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "999px",
                    background: "#e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#334155",
                  }}
                >
                  {(session.user.name?.[0] || session.user.email?.[0] || "U").toUpperCase()}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  lineHeight: 1.2,
                }}
              >
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  {session.user.name || "Signed in user"}
                </span>

                <span
                  style={{
                    fontSize: "12px",
                    color: "#64748b",
                    marginTop: "2px",
                  }}
                >
                  {session.user.email}
                </span>
              </div>

              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button
                  type="submit"
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "8px 12px",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}