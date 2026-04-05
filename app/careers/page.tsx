"use client";

import Link from "next/link";
import SiteLayout from "@/components/SiteLayout";

const roles = [
  {
    title: "Full-Stack Engineer",
    type: "Full-time · Remote",
    location: "Remote (US)",
    tags: ["TypeScript", "Next.js", "Supabase", "PostgreSQL"],
    description:
      "We're looking for a full-stack engineer who loves building products that real people use every day. You'll work across our Next.js frontend and Supabase backend, shipping features that directly impact how 500+ detailers run their businesses. You'll have high autonomy and own entire features end to end.",
    responsibilities: [
      "Build and maintain features across the full stack (Next.js, TypeScript, Supabase)",
      "Design and optimize database schemas and API routes",
      "Collaborate directly with the founder to prioritize and ship fast",
      "Write clean, well-tested code with an eye toward performance and simplicity",
      "Participate in code reviews and help shape our engineering culture",
    ],
    requirements: [
      "3+ years of production experience with TypeScript and React",
      "Experience with Next.js App Router",
      "Comfort with SQL and relational database design",
      "Experience shipping and maintaining SaaS products",
    ],
  },
  {
    title: "Customer Success Manager",
    type: "Full-time · Remote",
    location: "Remote (US/Canada)",
    tags: ["Customer Success", "SaaS", "SMB", "Onboarding"],
    description:
      "DetailBook's product is only as good as the experience our customers have using it. We're looking for a customer success manager who genuinely cares about helping small business owners succeed. You'll be the first voice customers hear, the person who helps them get set up, and the advocate who brings their feedback back to the product team.",
    responsibilities: [
      "Onboard new customers and ensure they get value from DetailBook fast",
      "Handle support tickets via email and chat with speed and empathy",
      "Identify and proactively reach out to at-risk accounts",
      "Gather customer feedback and communicate it clearly to the product team",
      "Build and maintain help documentation and how-to resources",
    ],
    requirements: [
      "2+ years in customer success or support at a SaaS company",
      "Excellent written and verbal communication",
      "Genuine empathy for small business owners",
      "Comfort with tools like Intercom, HubSpot, or similar",
    ],
  },
  {
    title: "Growth Marketing Manager",
    type: "Full-time · Remote",
    location: "Remote (US)",
    tags: ["SEO", "Content", "Paid Ads", "Social Media"],
    description:
      "We're growing fast through content and SEO, and we need someone to accelerate that growth. You'll own our content calendar, drive our SEO strategy, manage paid acquisition experiments, and grow our social presence. You'll have budget to spend and full ownership of the growth function.",
    responsibilities: [
      "Own SEO strategy and execute on content to grow organic traffic",
      "Manage and optimize paid acquisition campaigns (Google, Meta)",
      "Build and execute our social media content calendar",
      "Run A/B tests on landing pages and signup flows",
      "Track, analyze, and report on all growth metrics",
    ],
    requirements: [
      "3+ years of growth marketing experience at a SaaS or service business",
      "Demonstrated track record of growing organic traffic through SEO",
      "Hands-on experience with Google Ads and Meta Ads",
      "Strong writer who can create content that ranks and converts",
    ],
  },
];

const perks = [
  {
    title: "Remote-First",
    description: "Work from anywhere in North America. We don't believe in mandatory in-person.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    title: "Competitive Salary",
    description: "We pay at market rate for exceptional talent. Salary bands are transparent.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Health Benefits",
    description: "Full health, dental, and vision coverage for you and your family.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    title: "Equity",
    description: "Everyone on the team has ownership. We're building this together.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    title: "Flexible Hours",
    description: "We care about output, not hours. Work when you're most productive.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Meaningful Work",
    description: "You're helping real tradespeople build better businesses. The impact is direct.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
];

export default function CareersPage() {
  return (
    <SiteLayout>
      {/* ── Hero ── */}
      <section className="relative py-28 overflow-hidden">
        <div className="absolute inset-0 bg-[#080c18]" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-15%] right-[-10%] w-[55%] h-[55%] bg-blue-600/20 rounded-full blur-[120px] animate-blobFloat" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[45%] h-[45%] bg-indigo-700/15 rounded-full blur-[100px] animate-blobFloat delay-400" />
        </div>
        <div className="absolute inset-0 overflow-hidden opacity-[0.05] pointer-events-none">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold px-3 py-1.5 rounded-full mb-6 animate-fadeInUp">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            WE&apos;RE HIRING
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight mb-6 animate-fadeInUp delay-100">
            Join the{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              DetailBook
            </span>{" "}
            Team
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed animate-fadeInUp delay-200">
            We&apos;re building the tools that help tradespeople run better businesses. If you care about
            real-world impact and want to work on a product people genuinely love, we want to hear from you.
          </p>
        </div>
      </section>

      {/* ── About the team ── */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-8 sm:p-10">
            <h2 className="text-2xl font-black text-white mb-4">We&apos;re a small team building big things</h2>
            <div className="space-y-4 text-gray-300 leading-relaxed">
              <p>
                DetailBook is a remote-first, mission-driven company. We&apos;re a small team — everyone is a
                builder, everyone has ownership, and everyone talks directly to customers. There&apos;s no
                bureaucracy. If you have a good idea, you ship it.
              </p>
              <p>
                We care deeply about our customers: mobile auto detailers who are running small businesses
                and using DetailBook to level up their operations. Every line of code, every support message,
                and every marketing campaign ultimately serves those customers.
              </p>
              <p>
                We offer competitive compensation, equity, full benefits, and the kind of autonomy that&apos;s
                hard to find at larger companies. If you want to be proud of what you build, this is the place.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Perks ── */}
      <section className="py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-white text-center mb-10">Why DetailBook</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {perks.map((perk, i) => (
              <div
                key={i}
                className="bg-slate-800/60 border border-white/10 rounded-xl p-5 flex gap-4 items-start animate-fadeInUp"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center text-blue-400 shrink-0">
                  {perk.icon}
                </div>
                <div>
                  <h3 className="text-white font-bold mb-1">{perk.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{perk.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Open Roles ── */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-white text-center mb-3">Open Positions</h2>
          <p className="text-gray-400 text-center mb-12">All roles are fully remote.</p>
          <div className="space-y-6">
            {roles.map((role, i) => (
              <div
                key={i}
                className="bg-slate-800/60 border border-white/10 rounded-2xl p-8 hover:border-blue-500/30 transition-all duration-300 animate-fadeInUp"
                style={{ animationDelay: `${i * 0.12}s` }}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">{role.title}</h3>
                    <p className="text-blue-400 text-sm font-semibold">{role.type}</p>
                  </div>
                  <a
                    href="mailto:info@detailbookapp.com"
                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all duration-200 shrink-0"
                  >
                    Apply Now
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </a>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {role.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-slate-700/80 border border-white/10 text-gray-300 px-2.5 py-1 rounded-lg">
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="text-gray-300 leading-relaxed mb-5">{role.description}</p>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-white text-sm font-bold mb-2">Responsibilities</h4>
                    <ul className="space-y-1.5">
                      {role.responsibilities.map((r, j) => (
                        <li key={j} className="flex items-start gap-2 text-gray-400 text-sm">
                          <svg className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-white text-sm font-bold mb-2">Requirements</h4>
                    <ul className="space-y-1.5">
                      {role.requirements.map((r, j) => (
                        <li key={j} className="flex items-start gap-2 text-gray-400 text-sm">
                          <svg className="w-4 h-4 text-green-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Don't see your role ── */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 border border-white/10 rounded-2xl p-10 text-center">
            <h2 className="text-2xl font-black text-white mb-3">Don&apos;t see your role?</h2>
            <p className="text-gray-400 mb-6 leading-relaxed">
              We&apos;re always interested in meeting talented people who care about our mission. If you think
              you can help us build better tools for detailers, we want to hear from you.
            </p>
            <a
              href="mailto:info@detailbookapp.com"
              className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-600 border border-white/10 text-white font-bold px-7 py-3.5 rounded-xl transition-all duration-200"
            >
              Send Us Your Resume
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </a>
            <p className="text-gray-500 text-sm mt-3">info@detailbookapp.com</p>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
