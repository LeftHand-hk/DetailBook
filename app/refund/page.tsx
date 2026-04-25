import Link from "next/link";
import SiteLayout from "@/components/SiteLayout";

const sections = [
  {
    id: "how-to-request",
    title: "How to Request a Refund",
    content: `To request a refund, contact us at info@detailbookapp.com with your account details. Refunds are processed back to the original payment method within 5-10 business days.`,
  },
  {
    id: "cancellations",
    title: "Subscription Cancellations",
    content: `You may cancel your subscription at any time from your account dashboard. Cancellations take effect at the end of the current billing period.`,
  },
  {
    id: "contact",
    title: "Contact",
    content: `For questions about this Refund Policy, contact info@detailbookapp.com.`,
  },
];

export default function RefundPage() {
  return (
    <SiteLayout>
      {/* ── Hero ── */}
      <section className="relative py-20 overflow-hidden bg-[#080c18]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-15%] left-[20%] w-[45%] h-[45%] bg-blue-600/15 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight mb-4 animate-fadeInUp">
            Refund Policy
          </h1>
          <p className="text-gray-400 text-lg animate-fadeInUp delay-100">
            Last updated: April 25, 2026
          </p>
        </div>
      </section>

      {/* ── Content ── */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-10">

            {/* TOC sidebar */}
            <nav className="lg:w-56 shrink-0">
              <div className="sticky top-24">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Contents</p>
                <ul className="space-y-2">
                  {sections.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="text-sm text-gray-500 hover:text-blue-600 transition-colors leading-snug block py-0.5"
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>

            {/* Body */}
            <div className="flex-1 min-w-0">
              <p className="text-gray-700 leading-relaxed mb-10 text-base border-l-4 border-blue-500 pl-4 bg-blue-50 py-3 pr-4 rounded-r-xl">
                At DetailBook, we want you to be fully satisfied with your subscription. If you are not satisfied for any reason, you may request a full refund within 14 days of your initial purchase.
              </p>

              {sections.map((section) => (
                <div key={section.id} id={section.id} className="mb-12 scroll-mt-24">
                  <h2 className="text-xl font-black text-gray-900 mb-4 pb-2 border-b border-gray-200">
                    {section.title}
                  </h2>
                  <p className="text-gray-600 leading-relaxed">{section.content}</p>
                </div>
              ))}

              <div className="mt-10 pt-8 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  Related:{" "}
                  <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>
                  {" · "}
                  <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
