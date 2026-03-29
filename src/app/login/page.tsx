import { signIn, auth } from "../../auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f5f7fb",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#ffffff",
          border: "1px solid #e7edf5",
          borderRadius: 20,
          padding: 28,
          boxShadow: "0 10px 30px rgba(15,23,42,0.04)",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            lineHeight: 1.08,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: "#0f172a",
          }}
        >
          Sign in to RevenueWatch
        </h1>

        <p
          style={{
            margin: "10px 0 18px",
            fontSize: 14,
            lineHeight: 1.7,
            color: "#64748b",
          }}
        >
          Continue with Google to access your monitoring dashboard.
        </p>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            style={{
              width: "100%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "12px 14px",
              borderRadius: 12,
              background: "#0f172a",
              color: "#ffffff",
              border: "none",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}