import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-7xl font-black text-white mb-2">404</h1>
        <p className="text-xl text-blue-200 mb-8">Page not found</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors"
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
