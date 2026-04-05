"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", color: "white", fontFamily: "system-ui" }}>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: "3rem", fontWeight: 900, marginBottom: "0.5rem" }}>Oops</h1>
            <p style={{ fontSize: "1.25rem", color: "#93c5fd", marginBottom: "2rem" }}>Something went wrong</p>
            <button
              onClick={() => reset()}
              style={{ background: "#2563eb", color: "white", fontWeight: 600, padding: "0.75rem 1.5rem", borderRadius: "0.75rem", border: "none", cursor: "pointer", fontSize: "1rem" }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
