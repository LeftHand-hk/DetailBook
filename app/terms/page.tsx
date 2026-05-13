import Link from "next/link";
import SiteLayout from "@/components/SiteLayout";

const sections = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    content: `By accessing or using DetailBook (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service.

These Terms apply to all users of the Service, including users who create accounts, access the Service without an account, and users who subscribe to paid plans. We reserve the right to update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the revised Terms.

If you are using the Service on behalf of a business, you represent that you have authority to bind that business to these Terms.`,
  },
  {
    id: "description",
    title: "2. Description of Service",
    content: `DetailBook is a scheduling, booking, and business management platform designed for mobile auto detailers and similar service providers. The Service includes:

- A customizable public booking page for accepting customer appointments
- Deposit and payment collection through integrated payment processors
- Automated SMS and email reminders
- Calendar management and Google Calendar synchronization
- Service package management
- Business analytics and reporting

DetailBook offers a Starter plan and a Pro plan. Features available vary by plan. We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time.`,
  },
  {
    id: "user-accounts",
    title: "3. User Accounts",
    content: `To access the Service, you must create an account. You agree to:

- Provide accurate, complete, and current information when creating your account
- Maintain the security of your password and immediately notify us of any unauthorized access
- Accept responsibility for all activity that occurs under your account
- Not share your account credentials with others or allow others to access your account

You must be at least 18 years of age to create an account. Accounts are personal and non-transferable. We reserve the right to terminate accounts that violate these Terms.`,
  },
  {
    id: "payment-terms",
    title: "4. Payment Terms",
    content: `**Subscription fees:** Access to paid features requires a paid subscription. Subscription fees are charged monthly or annually in advance. All fees are non-refundable unless otherwise stated or required by applicable law.

**Free trial:** We offer a 7-day free trial on the Starter plan for new accounts. A valid payment method is required to activate the trial. You will not be charged during the trial; if you do not cancel before the trial ends, your subscription begins automatically and your card is charged for the first month.

**Payment processing:** Subscription payments are processed by Stripe. By subscribing, you authorize us to charge your payment method on a recurring basis until you cancel.

**Price changes:** We may change our subscription prices at any time. We will provide at least 30 days' notice before any price increase takes effect. Your continued use of the Service after the effective date of a price change constitutes your acceptance of the new price.

**Cancellation:** You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of the current billing period. We do not provide refunds for partial billing periods.

**Customer payment processing:** DetailBook facilitates payment collection from your customers on your behalf through Stripe Connect. You are responsible for your own pricing, deposit policies, refunds, and disputes with your customers. DetailBook is not a party to transactions between you and your customers.`,
  },
  {
    id: "acceptable-use",
    title: "5. Acceptable Use",
    content: `You agree not to use the Service to:

- Violate any applicable law or regulation
- Send spam or unsolicited communications to your customers beyond the automated reminders and confirmations enabled by the Service
- Impersonate any person or entity or falsely represent your affiliation with any person or entity
- Collect or harvest any personally identifiable information from the Service beyond what is necessary for your own business operations
- Use the Service for any purpose other than legitimate business scheduling and booking operations
- Reverse engineer, decompile, or disassemble any part of the Service
- Interfere with or disrupt the integrity or performance of the Service
- Upload or transmit any viruses, malware, or other malicious code

We reserve the right to suspend or terminate accounts that violate these provisions without prior notice.`,
  },
  {
    id: "intellectual-property",
    title: "6. Intellectual Property",
    content: `**Our IP:** The Service, including its software, design, text, graphics, and other content, is owned by DetailBook and protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works without our express written permission.

**Your content:** You retain ownership of content you upload to the Service, including your business name, logo, service descriptions, and customer data. By using the Service, you grant us a limited license to use your content solely to operate and improve the Service.

**Feedback:** If you provide us with feedback, suggestions, or ideas about the Service, you grant us a perpetual, royalty-free license to use that feedback without obligation to you.`,
  },
  {
    id: "disclaimer",
    title: "7. Disclaimer of Warranties",
    content: `THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, DETAILBOOK DISCLAIMS ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE. WE DO NOT WARRANT THAT THE SERVICE WILL MEET YOUR SPECIFIC REQUIREMENTS OR THAT RESULTS OBTAINED FROM USE OF THE SERVICE WILL BE ACCURATE OR RELIABLE.`,
  },
  {
    id: "limitation",
    title: "8. Limitation of Liability",
    content: `TO THE FULLEST EXTENT PERMITTED BY LAW, DETAILBOOK SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, LOSS OF DATA, OR BUSINESS INTERRUPTION, ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE.

IN NO EVENT SHALL DETAILBOOK'S TOTAL LIABILITY TO YOU EXCEED THE AMOUNT YOU PAID TO US IN THE 12 MONTHS PRECEDING THE CLAIM.

Some jurisdictions do not allow the exclusion or limitation of certain damages, so some of the above limitations may not apply to you.`,
  },
  {
    id: "termination",
    title: "9. Termination",
    content: `Either party may terminate the agreement at any time. You may terminate by canceling your subscription and deleting your account. We may terminate or suspend your account immediately, without prior notice, for:

- Violation of these Terms
- Non-payment of subscription fees
- Fraudulent or illegal activity
- Any other reason at our sole discretion

Upon termination, your right to access the Service ceases immediately. We will retain your data for 90 days following termination before deletion, during which time you may request an export.`,
  },
  {
    id: "governing-law",
    title: "10. Governing Law",
    content: `These Terms are governed by the laws of the United States. Any disputes shall be resolved through binding arbitration under applicable rules.

You waive any right to participate in a class action lawsuit or class-wide arbitration. Nothing in this section prevents either party from seeking injunctive relief in a court of competent jurisdiction.`,
  },
  {
    id: "contact",
    title: "11. Contact",
    content: `If you have questions about these Terms, please contact us:

Email: info@detailbookapp.com`,
  },
];

export default function TermsPage() {
  return (
    <SiteLayout>
      {/* ── Hero ── */}
      <section className="relative py-20 overflow-hidden bg-[#080c18]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-15%] left-[-5%] w-[45%] h-[45%] bg-indigo-600/15 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight mb-4 animate-fadeInUp">
            Terms of Service
          </h1>
          <p className="text-gray-400 text-lg animate-fadeInUp delay-100">
            Last updated: March 1, 2026
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
                Please read these Terms of Service carefully before using the DetailBook platform. These Terms constitute a legally binding agreement between you and DetailBook.
              </p>

              {sections.map((section) => (
                <div key={section.id} id={section.id} className="mb-12 scroll-mt-24">
                  <h2 className="text-xl font-black text-gray-900 mb-4 pb-2 border-b border-gray-200">
                    {section.title}
                  </h2>
                  <div className="space-y-3">
                    {section.content.split("\n\n").map((para, i) => {
                      const parts = para.split(/(\*\*[^*]+\*\*)/g);
                      const isAllBold = para.startsWith("**") && para.endsWith("**") && !para.slice(2, -2).includes("**");
                      if (isAllBold) {
                        return <h3 key={i} className="font-bold text-gray-900 mt-4">{para.replace(/\*\*/g, "")}</h3>;
                      }
                      return (
                        <p key={i} className={`leading-relaxed ${para === para.toUpperCase() && para.length > 20 ? "text-gray-700 text-sm" : "text-gray-600"}`}>
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
                  <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
                  {" · "}
                  <Link href="/cookies" className="text-blue-600 hover:underline">Cookie Policy</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
