"use client";

import { useEffect, useState } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Surface the error to the browser console so it's visible in DevTools
    // even when the user dismisses the inline panel.
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="text-center max-w-2xl w-full">
        <h1 className="text-5xl font-black text-white mb-2">Oops</h1>
        <p className="text-xl text-blue-200 mb-6">Something went wrong</p>

        <div className="flex items-center justify-center gap-3 mb-6">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/20 transition-colors"
          >
            {showDetails ? "Hide details" : "Show details"}
          </button>
        </div>

        {showDetails && (
          <div className="bg-black/40 border border-white/10 rounded-xl p-4 text-left text-sm text-blue-100 space-y-2 overflow-auto max-h-[60vh]">
            <div>
              <span className="text-blue-300 font-semibold">Message: </span>
              <span className="font-mono">{error.message || "(no message)"}</span>
            </div>
            {error.digest && (
              <div>
                <span className="text-blue-300 font-semibold">Digest: </span>
                <span className="font-mono">{error.digest}</span>
              </div>
            )}
            {error.stack && (
              <div>
                <span className="text-blue-300 font-semibold">Stack:</span>
                <pre className="font-mono text-xs whitespace-pre-wrap mt-1 text-blue-200/80">{error.stack}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
