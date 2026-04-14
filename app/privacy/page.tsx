import Link from "next/link";
import SiteLayout from "@/components/SiteLayout";

const sections = [
  {
    id: "information-we-collect",
    title: "1. Information We Collect",
    content: `We collect information you provide directly to us, information we collect automatically when you use our services, and information from third parties.

**Information you provide:**
When you create an account, we collect your name, email address, password, and business information. When you connect a payment processor, we collect the information necessary to process payments. When you contact us for support, we collect the content of those communications.

**Information collected automatically:**
We automatically collect log data including your IP address, browser type, operating system, pages visited, time spent, and referring URLs. We use cookies and similar tracking technologies to collect this information (see our Cookie Policy for details).

**Information from third parties:**
We may receive information about you from third-party services you connect to DetailBook, such as Google Calendar or Stripe. This information is used only to provide you the connected service.`,
  },
  {
    id: "how-we-use",
    title: "2. How We Use Your Information",
    content: `We use the information we collect to:

- Provide, maintain, and improve our services
- Process transactions and send related information including booking confirmations and receipts
- Send automated SMS and email reminders on your behalf to your customers
- Respond to comments, questions, and customer service requests
- Send technical notices, updates, and security alerts
- Monitor and analyze usage patterns to improve the product
- Detect, prevent, and address fraud and other illegal activities
- Comply with legal obligations

We do not sell your personal data to third parties for their marketing purposes.`,
  },
  {
    id: "data-sharing",
    title: "3. Data Sharing",
    content: `We may share your information in the following circumstances:

**Service providers:** We share data with vendors and service providers who help us deliver our services, including Stripe (payment processing), Twilio (SMS delivery), Supabase (database hosting), and Netlify (hosting infrastructure). These parties are bound by data processing agreements.

**Business transfers:** If DetailBook is involved in a merger, acquisition, or sale of all or a portion of its assets, your data may be transferred as part of that transaction.

**Legal requirements:** We may disclose your information if required by law, subpoena, or court order, or if we believe disclosure is necessary to protect the rights, property, or safety of DetailBook, our users, or the public.

**With your consent:** We may share information in other ways with your explicit consent.

We do not share your customers' data with any third party except as necessary to provide services to you.`,
  },
  {
    id: "cookies",
    title: "4. Cookies",
    content: `We use cookies and similar tracking technologies to operate our service. Cookies are small text files stored on your device.

We use essential cookies (required for the service to function), analytics cookies (to understand how users interact with our product), and preference cookies (to remember your settings).

You can control cookie settings through your browser settings or by reviewing our Cookie Policy at detailbook.app/cookies. Note that disabling certain cookies may affect the functionality of our services.`,
  },
  {
    id: "data-security",
    title: "5. Data Security",
    content: `We take data security seriously and implement appropriate technical and organizational measures to protect your information against unauthorized access, alteration, disclosure, or destruction.

Measures include:
- All data transmitted between your browser and our servers is encrypted using TLS/SSL
- Passwords are hashed and never stored in plain text
- Database access is restricted and logged
- Payment card data is handled exclusively by Stripe and never stored on DetailBook servers
- Regular security audits and penetration testing

While we use commercially reasonable safeguards, no security system is impenetrable. We encourage you to use a strong, unique password and to notify us immediately if you suspect unauthorized access to your account.`,
  },
  {
    id: "your-rights",
    title: "6. Your Rights",
    content: `Depending on your location, you may have certain rights regarding your personal data:

**Access:** You may request a copy of the personal data we hold about you.

**Correction:** You may request that we correct inaccurate or incomplete personal data.

**Deletion:** You may request that we delete your personal data. Note that some data may be retained for legal or business purposes (e.g., transaction records).

**Portability:** You may request that we provide your data in a structured, machine-readable format.

**Objection:** You may object to certain types of processing, including direct marketing.

**California residents:** If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information is collected and the right to opt-out of the sale of personal information (we do not sell personal information).

To exercise any of these rights, contact us at info@detailbookapp.com.`,
  },
  {
    id: "data-retention",
    title: "7. Data Retention",
    content: `We retain your account data for as long as your account is active or as needed to provide services. If you cancel your account, we will delete or anonymize your data within 90 days, except for transaction records and other data we are required to retain for legal, financial, or compliance reasons.

Customer data (your clients' information) collected through your booking page is retained for the same period. You may request earlier deletion by contacting support.`,
  },
  {
    id: "contact",
    title: "8. Contact Us",
    content: `If you have questions about this Privacy Policy or our data practices, please contact us:

Email: info@detailbookapp.com
General inquiries: info@detailbookapp.com

DetailBook


We will respond to privacy-related inquiries within 30 days.`,
  },
];

export default function PrivacyPage() {
  return (
    <SiteLayout>
      {/* ── Hero ── */}
      <section className="relative py-20 overflow-hidden bg-[#080c18]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-15%] right-[-10%] w-[45%] h-[45%] bg-blue-600/15 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight mb-4 animate-fadeInUp">
            Privacy Policy
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
                This Privacy Policy explains how DetailBook (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) collects, uses, and shares information about you when you use our scheduling and booking platform. By using DetailBook, you agree to the practices described in this policy.
              </p>

              {sections.map((section) => (
                <div key={section.id} id={section.id} className="mb-12 scroll-mt-24">
                  <h2 className="text-xl font-black text-gray-900 mb-4 pb-2 border-b border-gray-200">
                    {section.title}
                  </h2>
                  <div className="space-y-3">
                    {section.content.split("\n\n").map((para, i) => {
                      if (para.startsWith("**") && para.endsWith("**") && !para.slice(2).includes("\n")) {
                        return <h3 key={i} className="font-bold text-gray-900 mt-4">{para.replace(/\*\*/g, "")}</h3>;
                      }
                      const parts = para.split(/(\*\*[^*]+\*\*)/g);
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
