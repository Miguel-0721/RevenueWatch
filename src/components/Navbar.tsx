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
          <a href="/" className="btn btn-secondary">
            Back to home
          </a>

          {session?.user ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
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

              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
                style={{ marginTop: "4px" }}
              >
                <button
                  type="submit"
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    margin: 0,
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#2563eb",
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