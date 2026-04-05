import Link from "next/link";
import SiteLayout from "@/components/SiteLayout";

const essentialCookies = [
  { name: "__session", purpose: "Maintains your authenticated session so you stay logged in", duration: "Session" },
  { name: "csrf_token", purpose: "Protects against cross-site request forgery attacks", duration: "Session" },
  { name: "sb-auth-token", purpose: "Supabase authentication token for API access", duration: "7 days" },
  { name: "cookie_consent", purpose: "Remembers your cookie consent preferences", duration: "1 year" },
];

const analyticsCookies = [
  { name: "_ga", purpose: "Google Analytics: distinguishes unique users by assigning a randomly generated number", duration: "2 years" },
  { name: "_ga_[ID]", purpose: "Google Analytics: persists session state across page requests", duration: "2 years" },
  { name: "_gid", purpose: "Google Analytics: distinguishes users, expires after 24 hours", duration: "24 hours" },
  { name: "ph_[token]_posthog", purpose: "PostHog: tracks product usage for feature development decisions", duration: "1 year" },
];

const marketingCookies = [
  { name: "_fbp", purpose: "Facebook Pixel: tracks conversions from ads to measure campaign performance", duration: "90 days" },
  { name: "_gcl_au", purpose: "Google Ads: stores and tracks conversions from Google advertising", duration: "90 days" },
  { name: "_uetsid", purpose: "Microsoft Advertising: used to track conversions from Bing ads", duration: "1 day" },
];

export default function CookiesPage() {
  return (
    <SiteLayout>
      {/* ── Hero ── */}
      <section className="relative py-20 overflow-hidden bg-[#080c18]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/12 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight mb-4 animate-fadeInUp">
            Cookie Policy
          </h1>
          <p className="text-gray-400 text-lg animate-fadeInUp delay-100">
            Last updated: March 1, 2026
          </p>
        </div>
      </section>

      {/* ── Content ── */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Intro */}
          <p className="text-gray-600 leading-relaxed mb-10 text-base border-l-4 border-blue-500 pl-4 bg-blue-50 py-3 pr-4 rounded-r-xl">
            This Cookie Policy explains how DetailBook uses cookies and similar tracking technologies when you visit detailbook.app or use our platform. By using our service, you consent to the use of cookies as described in this policy.
          </p>

          {/* What are cookies */}
          <div className="mb-12" id="what-are-cookies">
            <h2 className="text-xl font-black text-gray-900 mb-4 pb-2 border-b border-gray-200">What Are Cookies?</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              Cookies are small text files that are placed on your device (computer, smartphone, or tablet) when you visit a website. They are widely used to make websites work efficiently, remember your preferences, and provide information to site owners.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Cookies can be &quot;session cookies&quot; (deleted when you close your browser) or &quot;persistent cookies&quot; (stored for a specified period). We use both types for the purposes described below.
            </p>
          </div>

          {/* Essential Cookies */}
          <div className="mb-12" id="essential">
            <h2 className="text-xl font-black text-gray-900 mb-2 pb-2 border-b border-gray-200">Essential Cookies</h2>
            <p className="text-gray-600 leading-relaxed mb-5">
              These cookies are strictly necessary for the website to function and cannot be disabled. They are usually set in response to actions you take, such as logging in or filling in a form. You can set your browser to block these cookies, but parts of the site may not work as a result.
            </p>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b border-gray-200">Cookie Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b border-gray-200">Purpose</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {essentialCookies.map((c, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="px-4 py-3 font-mono text-blue-700 font-medium border-b border-gray-100 whitespace-nowrap">{c.name}</td>
                      <td className="px-4 py-3 text-gray-600 border-b border-gray-100">{c.purpose}</td>
                      <td className="px-4 py-3 text-gray-600 border-b border-gray-100 whitespace-nowrap">{c.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Analytics Cookies */}
          <div className="mb-12" id="analytics">
            <h2 className="text-xl font-black text-gray-900 mb-2 pb-2 border-b border-gray-200">Analytics Cookies</h2>
            <p className="text-gray-600 leading-relaxed mb-5">
              These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously. This data helps us improve our product — for example, understanding which features are most used or where users encounter friction.
            </p>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b border-gray-200">Cookie Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b border-gray-200">Purpose</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsCookies.map((c, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="px-4 py-3 font-mono text-purple-700 font-medium border-b border-gray-100 whitespace-nowrap">{c.name}</td>
                      <td className="px-4 py-3 text-gray-600 border-b border-gray-100">{c.purpose}</td>
                      <td className="px-4 py-3 text-gray-600 border-b border-gray-100 whitespace-nowrap">{c.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Marketing Cookies */}
          <div className="mb-12" id="marketing">
            <h2 className="text-xl font-black text-gray-900 mb-2 pb-2 border-b border-gray-200">Marketing Cookies</h2>
            <p className="text-gray-600 leading-relaxed mb-5">
              These cookies are used to track visitors across websites so we can display relevant advertising. They help us measure the effectiveness of our ad campaigns and ensure we don&apos;t show the same ads too many times.
            </p>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b border-gray-200">Cookie Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b border-gray-200">Purpose</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {marketingCookies.map((c, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="px-4 py-3 font-mono text-orange-700 font-medium border-b border-gray-100 whitespace-nowrap">{c.name}</td>
                      <td className="px-4 py-3 text-gray-600 border-b border-gray-100">{c.purpose}</td>
                      <td className="px-4 py-3 text-gray-600 border-b border-gray-100 whitespace-nowrap">{c.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Managing Cookies */}
          <div className="mb-12" id="managing">
            <h2 className="text-xl font-black text-gray-900 mb-4 pb-2 border-b border-gray-200">Managing Cookies</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              You can control and manage cookies in several ways:
            </p>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">•</span>
                <span><strong className="text-gray-800">Browser settings:</strong> Most browsers allow you to refuse or delete cookies through their settings. Note that disabling cookies may affect the functionality of our service.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">•</span>
                <span><strong className="text-gray-800">Google Analytics opt-out:</strong> Install the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Analytics Opt-out Browser Add-on</a> to prevent Google Analytics from collecting your data.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">•</span>
                <span><strong className="text-gray-800">Advertising opt-out:</strong> Visit the <a href="https://optout.aboutads.info" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Digital Advertising Alliance opt-out page</a> to manage interest-based advertising preferences.</span>
              </li>
            </ul>
          </div>

          {/* Changes */}
          <div className="mb-10" id="changes">
            <h2 className="text-xl font-black text-gray-900 mb-4 pb-2 border-b border-gray-200">Changes to This Policy</h2>
            <p className="text-gray-600 leading-relaxed">
              We may update this Cookie Policy from time to time to reflect changes in technology, legislation, or our data practices. We will notify you of significant changes by updating the &quot;Last updated&quot; date at the top of this page.
            </p>
          </div>

          <div className="mt-10 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Related:{" "}
              <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
              {" · "}
              <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>
            </p>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
