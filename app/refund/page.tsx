import Link from "next/link";
import SiteLayout from "@/components/SiteLayout";

const sections = [
  {
    id: "overview",
    title: "1. Overview",
    content: `This Refund Policy explains how DetailBook handles refunds for platform subscription fees and customer booking deposits. Please read this policy carefully before subscribing or accepting payments through our platform.

DetailBook operates as a SaaS platform for auto detailing businesses. We have two distinct types of payments: (1) subscription fees paid by business owners to DetailBook, and (2) deposit payments made by customers to business owners through the platform.`,
  },
  {
    id: "subscription-refunds",
    title: "2. Subscription Refunds",
    content: `**Free trial:** All new accounts receive a 15-day free trial on the Starter plan with no credit card required. You can explore the platform fully before committing to a paid subscription.

**Monthly subscriptions:** Subscription fees are billed monthly in advance and are non-refundable. If you cancel your subscription, you will retain access to the platform until the end of the current billing period. No partial refunds are issued for unused time within a billing cycle.

**Exceptions:** We may issue a refund in the following circumstances:
- You were charged due to a technical error on our part
- You were charged after canceling your subscription
- Duplicate charges occurred on the same billing date

To request an exception refund, contact us at info@detailbookapp.com within 7 days of the charge. We will review your request and respond within 3 business days.

**Upgrades and downgrades:** When upgrading from Starter to Pro, the price difference is prorated for the remainder of the billing period. When downgrading, the change takes effect at the start of the next billing period — no partial refunds are issued.`,
  },
  {
    id: "deposit-refunds",
    title: "3. Customer Deposit Refunds",
    content: `DetailBook facilitates deposit payments from customers to auto detailing businesses. These deposits are collected on behalf of the business owner — DetailBook is not a party to this transaction.

**Business owner responsibility:** Each business using DetailBook is solely responsible for setting and communicating their own deposit and cancellation policies to their customers. DetailBook does not dictate, manage, or enforce deposit refund policies between businesses and their customers.

**Customer disputes:** If you are a customer seeking a refund of a deposit paid to a detailing business through DetailBook:
- Contact the business directly using the contact information on their booking page
- The business owner controls all refund decisions for their deposits
- DetailBook cannot process or authorize deposit refunds on behalf of a business

**Stripe disputes:** If a business owner fails to respond to a refund request, customers may file a dispute through their bank or card issuer. DetailBook cooperates with payment processor dispute resolution processes.`,
  },
  {
    id: "cancellation",
    title: "4. How to Cancel Your Subscription",
    content: `You can cancel your DetailBook subscription at any time from your account:

1. Log in to your dashboard
2. Go to Settings → Billing
3. Click "Manage Subscription" or "Cancel Plan"
4. Confirm your cancellation

Your subscription will remain active until the end of the current billing period. After that, your account will be deactivated and your public booking page will go offline. Your data is retained for 90 days after cancellation, during which time you may reactivate by subscribing again.

If you have trouble canceling, contact us at info@detailbookapp.com and we will process it manually within 1 business day.`,
  },
  {
    id: "chargebacks",
    title: "5. Chargebacks",
    content: `If you initiate a chargeback or payment dispute with your bank or card issuer instead of contacting us first, we reserve the right to:

- Suspend or terminate your account immediately
- Provide your bank with documentation showing the charges were valid and in accordance with these Terms
- Recover any funds lost due to fraudulent chargebacks

We strongly encourage you to contact us first at info@detailbookapp.com — we are committed to resolving billing issues quickly and fairly.`,
  },
  {
    id: "contact",
    title: "6. Contact",
    content: `For any questions about refunds or billing, please contact us:

Email: info@detailbookapp.com
General: info@detailbookapp.com

We aim to respond to all billing inquiries within 1–2 business days.

DetailBook
`,
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
            Last updated: April 5, 2026
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
              <p className="text-gray-600 leading-relaxed mb-10 text-base border-l-4 border-blue-500 pl-4 bg-blue-50 py-3 pr-4 rounded-r-xl">
                DetailBook offers a 15-day free trial with no credit card required. Monthly subscription fees are non-refundable except in cases of billing errors. Customer deposit refunds are handled directly by the business owner.
              </p>

              {sections.map((section) => (
                <div key={section.id} id={section.id} className="mb-12 scroll-mt-24">
                  <h2 className="text-xl font-black text-gray-900 mb-4 pb-2 border-b border-gray-200">
                    {section.title}
                  </h2>
                  <div className="space-y-3">
                    {section.content.split("\n\n").map((para, i) => {
                      if (para.startsWith("- ")) {
                        const items = para.split("\n").filter(l => l.startsWith("- "));
                        return (
                          <ul key={i} className="list-disc pl-5 space-y-1">
                            {items.map((item, j) => (
                              <li key={j} className="text-gray-600">{item.replace("- ", "")}</li>
                            ))}
                          </ul>
                        );
                      }
                      if (para.match(/^\d+\./m)) {
                        const items = para.split("\n").filter(l => l.match(/^\d+\./));
                        return (
                          <ol key={i} className="list-decimal pl-5 space-y-1">
                            {items.map((item, j) => (
                              <li key={j} className="text-gray-600">{item.replace(/^\d+\.\s/, "")}</li>
                            ))}
                          </ol>
                        );
                      }
                      const parts = para.split(/(\*\*[^*]+\*\*)/g);
                      const isHeading = parts.length === 1 && para.startsWith("**") && para.endsWith("**");
                      if (isHeading) {
                        return <h3 key={i} className="font-bold text-gray-900 mt-4">{para.replace(/\*\*/g, "")}</h3>;
                      }
                      return (
                        <p key={i} className="text-gray-600 leading-relaxed">
                          {parts.map((part, j) =>
                            part.startsWith("**") && part.endsWith("**") ? (
                              <strong key={j} className="text-gray-900 font-semibold">{part.replace(/\*\*/g, "")}</strong>
                            ) : (
                              part
                            )
                          )}
                        </p>
                      );
                    })}
                  </div>
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
