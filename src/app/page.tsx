export default function Home() {
  return (
    <main style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h1>RevenueWatch</h1>

      <p style={{ marginTop: "20px", maxWidth: "600px" }}>
        Monitor Stripe accounts and get alerted when revenue drops or
        payment failures spike.
      </p>

      <div style={{ marginTop: "30px" }}>
        <a href="/alerts">View Alerts</a>
      </div>
    </main>
  );
}