"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import SiteLayout from "@/components/SiteLayout";

/* ─────────────────────────────────────────────
   Post data with full article bodies
───────────────────────────────────────────── */
const posts = [
  {
    slug: "how-to-stop-no-shows",
    title: "How to Stop No-Shows in Your Detailing Business (5 Proven Methods)",
    category: "Business Tips",
    date: "Mar 18, 2026",
    readTime: "6 min",
    author: "DetailBook Team",
    body: `
No-shows are the #1 profit killer for mobile auto detailers. You block out three hours, drive across town, and sit in an empty driveway. No text, no call — just wasted time and lost income.

The good news? No-shows are almost entirely preventable. Here are five proven methods that detailers use to virtually eliminate them.

**1. Require a Deposit at Booking**

This is the single most effective thing you can do. When a customer has already paid $25–$50 to reserve their appointment, they have skin in the game. The psychology is simple: people don't ghost money they've already spent.

Set your deposit at 20–30% of the service price. Make it clear in your booking flow that it's non-refundable within 24 hours of the appointment. With DetailBook, this is built in — customers pay the deposit through Stripe when they book, and you keep it if they cancel last-minute.

**2. Send a Confirmation Text Immediately**

Right after booking, send an automated confirmation with the date, time, service, and address. This creates a paper trail and sets expectations immediately. If the customer gave you the wrong address or booked the wrong date, this is when they'll catch it — before you're standing in someone else's driveway.

**3. Send Reminder Messages Before the Appointment**

Most no-shows happen because people forget. Life is busy. A reminder text 2 hours before the appointment dramatically reduces this. Keep the messages warm but firm. Include the appointment details and your cancellation policy.

DetailBook automates these reminders on the Pro plan, so you never have to think about it.

**4. Have a Clear Cancellation Policy**

Display your cancellation policy prominently on your booking page. Typical policy: cancellations within 24 hours forfeit the deposit. Knowing there's a financial consequence makes customers take their booking more seriously and incentivizes them to communicate rather than disappear.

**5. Follow Up If They Don't Show**

If a customer no-shows without contacting you, send a short, professional text within 30 minutes. Something like: "Hey, I'm at [address] for your detail appointment. Everything okay? Let me know if you need to reschedule." This recovers some bookings and shows professionalism. If they don't respond, you keep the deposit and move on.

**The Bottom Line**

Combine all five of these methods and you'll cut your no-show rate to near zero. The deposit system alone has reduced no-shows by 80–90% for most DetailBook customers. It's not about being harsh — it's about running a professional business.
    `,
  },
  {
    slug: "best-scheduling-software-2026",
    title: "Best Scheduling Software for Mobile Auto Detailers in 2026",
    category: "Reviews",
    date: "Mar 15, 2026",
    readTime: "8 min",
    author: "DetailBook Team",
    body: `
Choosing the right scheduling software is one of the most important decisions you'll make as a mobile detailer. The wrong tool wastes your time. The right one makes your business look professional, reduces no-shows, and helps you grow.

We spent weeks testing every major option. Here's the honest breakdown.

**DetailBook**

Built specifically for mobile auto detailers. Includes online booking, deposit collection, SMS reminders, package builder, Google Calendar sync, and a clean mobile dashboard. Starts at $29/month with a 30-day free trial.

*Best for:* Detailers who want something purpose-built and don't want to configure a generic tool. ★★★★★

**Jobber**

The gold standard for field service businesses in general. Extremely powerful — quoting, invoicing, CRM, route optimization. But it's built for companies with employees, and it shows. The interface is complex, and the pricing ($49–$199/month) reflects enterprise ambitions.

*Best for:* Detailing shops with 3+ employees. ★★★☆☆

**Square Appointments**

Free to start, which is appealing. But Square is a payment company first — the scheduling features are basic. No deposit system, no SMS reminders unless you pay for marketing tools separately, no service package builder.

*Best for:* Absolute beginners who need something free right now. ★★★☆☆

**Urable**

Purpose-built for detailers and similar trades. Has strong features including packages, before/after photos, and client history. Interface feels dated and the onboarding is rough.

*Best for:* Detailers who've outgrown simpler tools. ★★★★☆

**Calendly + Stripe (DIY)**

Some detailers string together Calendly for scheduling and Stripe for deposits. It works, but it's fragile, requires manual coordination, and doesn't send automated reminders.

*Best for:* Tech-savvy operators who don't mind duct tape. ★★☆☆☆

**Our Recommendation**

If you're a solo mobile detailer or a small crew, DetailBook is the best choice in 2026. It's built for your specific workflow, priced fairly, and the onboarding takes under 30 minutes. Try the free trial before committing to anything.
    `,
  },
  {
    slug: "deposit-policy-guide",
    title: "How to Create a Deposit Policy for Your Detailing Business",
    category: "How-To",
    date: "Mar 12, 2026",
    readTime: "5 min",
    author: "DetailBook Team",
    body: `
A deposit policy is one of the most important business tools a mobile detailer can have. Done right, it eliminates no-shows, protects your income, and signals to customers that you run a serious, professional operation.

Here's how to create one that works.

**What is a Deposit Policy?**

A deposit policy states that customers must pay a portion of their service fee upfront to secure their appointment. It also specifies what happens if they cancel or don't show up.

**How Much Should You Charge?**

The standard range is 20–30% of the service total. For a $150 full detail, that's a $30–$45 deposit. This is enough to make the customer committed without being so high that it creates friction in the booking process.

Some detailers charge a flat deposit (e.g., $25 for all appointments). This simplifies things and still provides protection.

**The 24-Hour Cancellation Rule**

The most effective deposit policies require that cancellations happen at least 24 hours before the appointment to receive a refund. Cancellations within 24 hours forfeit the deposit. This gives you protection against last-minute changes while still being fair to customers with legitimate emergencies.

**Write It in Plain Language**

Your policy should be readable and clear. Avoid legal jargon. Example:

*"A deposit is required to confirm your booking. Deposits are fully refundable for cancellations made at least 24 hours before your appointment. Cancellations within 24 hours of the appointment or no-shows will forfeit the deposit."*

**Where to Display Your Policy**

Show it prominently on your booking page, in your booking confirmation text, and in your reminder messages. The more places you display it, the fewer disputes you'll have.

**Handling Pushback**

Some customers will be uncomfortable with deposits at first. Hold your ground politely. Most understand once you explain it protects your time as a small business owner. Customers who are genuinely booking in good faith almost never cancel — so the deposit shouldn't scare them.

With DetailBook, your deposit policy is automatically shown on the booking page and included in every confirmation and reminder message.
    `,
  },
  {
    slug: "auto-detailing-price-list",
    title: "Auto Detailing Price List Template (Free Download)",
    category: "Resources",
    date: "Mar 10, 2026",
    readTime: "4 min",
    author: "DetailBook Team",
    body: `
One of the most common questions new detailers ask is: how should I price my services? Price too low and you burn out working for less than minimum wage. Price too high and your phone stops ringing.

After analyzing hundreds of successful detailing businesses on DetailBook, here's the pricing structure that works in most US markets.

**Exterior Wash & Wax**
- Sedan/Coupe: $80–$120
- SUV/Crossover: $100–$150
- Truck/Full-size SUV: $120–$180

**Interior Detail**
- Sedan/Coupe: $100–$150
- SUV/Crossover: $130–$180
- Truck/Full-size SUV: $150–$200

**Full Detail (Interior + Exterior)**
- Sedan/Coupe: $175–$250
- SUV/Crossover: $200–$300
- Truck/Full-size SUV: $225–$350

**Add-On Services**
- Engine Bay Clean: +$50–$80
- Odor Elimination: +$40–$75
- Pet Hair Removal: +$40–$60
- Clay Bar Treatment: +$50–$80
- Paint Correction (single stage): +$150–$300
- Ceramic Coating (full vehicle): $500–$1,500+

**How to Set Your Prices**

Start by researching your local market. Search for mobile detailers in your area on Google and look at their pricing. Aim to price in the middle-to-upper range — don't compete on price, compete on quality and convenience.

Factor in your drive time, supply costs (~15–20% of revenue), and the going hourly rate for skilled labor in your area ($35–$65/hr for detailing).

**The Psychology of Packages**

Don't offer a la carte pricing for everything. Build 2–3 packages (e.g., Basic, Signature, Premium) with clear names and value propositions. Packages make it easy for customers to make decisions and naturally push them toward higher-value services. DetailBook's package builder makes this simple to set up.
    `,
  },
  {
    slug: "get-more-detailing-customers",
    title: "7 Ways to Get More Detailing Customers Without Cold Calling",
    category: "Marketing",
    date: "Mar 7, 2026",
    readTime: "7 min",
    author: "DetailBook Team",
    body: `
You don't need to cold call anyone to build a full schedule. Here are seven proven, low-cost strategies that mobile detailers use to grow their customer base consistently.

**1. Set Up Your Google Business Profile**

This is the single highest-ROI marketing move for a local service business. A complete Google Business Profile puts you in the "map pack" when people search "mobile detailer near me." Fill in every field, add photos of your work, and actively request reviews from customers.

**2. Before & After Photos on Instagram**

You do visually striking work. Show it off. Post before and after photos consistently — aim for 3–4 times per week. Use local hashtags (#[yourcity]detail, #mobiledetailing). This compounds over time and is effectively free advertising.

**3. Join Nextdoor and Local Facebook Groups**

Nextdoor and local Facebook community groups are gold for service businesses. Introduce yourself, post your work, and respond when neighbors ask for detailing recommendations. Trust is built fast in tight-knit local communities.

**4. Partner with Car Dealerships and Lots**

Reach out to used car dealers in your area. Offer to detail their inventory at a wholesale rate. Dealers often need quick turnarounds between sales, and this can provide a steady stream of volume work to fill slow days.

**5. Create a Referral Program**

Give every satisfied customer a reason to refer you. A simple "give $20, get $20" referral deal works well. Tell customers at the end of every appointment: "If you refer a friend, I'll give you both $20 off your next detail." Word-of-mouth is your most powerful channel.

**6. Build a Professional Booking Page**

A shareable booking link builds instant credibility. When someone asks "how do I book you?" — instead of exchanging texts for 20 minutes, you send them a clean, professional link where they can book and pay. DetailBook gives you this link in minutes.

**7. Collect Reviews Systematically**

After every appointment, send a short text asking for a Google review. Timing matters — send it within 2 hours while the experience is fresh. Include a direct link to your Google review page. Aim for 5 reviews per month and watch your search ranking climb.
    `,
  },
  {
    slug: "start-mobile-detailing-business",
    title: "The Complete Guide to Starting a Mobile Auto Detailing Business",
    category: "Getting Started",
    date: "Mar 4, 2026",
    readTime: "12 min",
    author: "DetailBook Team",
    body: `
Mobile auto detailing is one of the best businesses you can start in 2026. Low startup costs, high margins, immediate demand, and you're your own boss. Here's everything you need to launch.

**Step 1: Get Your Equipment**

You don't need to spend a fortune to start. Here's a solid starter kit for under $1,500:

- Pressure washer (electric, 1600–2000 PSI): $150–$300
- Wet/dry vacuum: $60–$120
- Dual-action polisher: $100–$200
- Microfiber towels (24-pack): $30–$50
- Chemical supplies (ONR, iron remover, interior cleaner, protectant): $150–$250
- Foam cannon and buckets: $40–$80
- Extension cord and water tank (for waterless/rinseless options): $50–$150
- Detail brushes, applicator pads: $30–$60

Total: $600–$1,200 to start.

**Step 2: Choose Your Services**

Start with 2–3 core services. A common starter menu: Exterior Wash & Wax, Interior Detail, and Full Detail. Once you're profitable and confident, expand to paint correction, coatings, and other premium services.

**Step 3: Set Your Prices**

Research your local market. Don't undercut everyone — compete on quality and professionalism. See our pricing guide for benchmarks.

**Step 4: Handle the Legal Basics**

Register your business (LLC recommended for liability protection — costs $50–$200 depending on your state). Get business insurance ($500–$1,200/year). Check if your city requires a business license. Open a separate business bank account.

**Step 5: Build Your Online Presence**

- Google Business Profile (free, essential)
- Instagram account with before/after photos
- A professional booking page with DetailBook

**Step 6: Get Your First Customers**

Post in local Facebook groups and Nextdoor. Offer discounted rates to the first 5–10 customers in exchange for honest reviews. Ask family and friends to refer you. Run a simple Google Ads campaign targeting "[your city] mobile detailer."

**Step 7: Set Up Your Booking System**

Don't run your business through Instagram DMs and text messages. Set up online booking from day one. It looks professional, saves time, and with deposits enabled, eliminates no-shows. DetailBook lets you do this in under 30 minutes.

**Step 8: Deliver Great Work and Ask for Reviews**

Your reputation is your most valuable asset. Do excellent work every single time. Within 2 hours of finishing, send a text asking for a Google review. Five consistent 5-star reviews will make your phone ring.

The first 90 days are the hardest. After that, if you've followed these steps, you'll have a steady client base and a business that generates real income on your own schedule.
    `,
  },
  {
    slug: "mobile-vs-shop-detailing",
    title: "Mobile Detailing vs. Shop Detailing: Which is More Profitable?",
    category: "Business Tips",
    date: "Feb 28, 2026",
    readTime: "6 min",
    author: "DetailBook Team",
    body: `
Thinking about starting a detailing business — or scaling your existing one? At some point, you'll face the mobile vs. shop question. Both models can be highly profitable. But they're completely different businesses. Here's the full breakdown.

**Mobile Detailing**

*How it works:* You bring your equipment to the customer's home or workplace. No physical location required.

*Startup costs:* $1,000–$5,000 for a solid setup. No rent, no buildout.

*Monthly overhead:* Low. Vehicle costs, supplies (~15% of revenue), insurance, software. Total: $500–$1,200/month for a solo operator.

*Revenue potential:* A solo mobile detailer working 5 days a week can realistically gross $6,000–$12,000/month in most markets. High end is higher in premium markets (LA, NYC, Miami, etc.)

*Pros:* Low overhead, flexibility, no commute for customers (huge selling point), low startup risk.

*Cons:* Weather-dependent, physically demanding, limited to one location at a time, scaling requires hiring.

**Shop Detailing**

*How it works:* Customers bring their vehicles to a fixed location. You have bays, equipment, and staff.

*Startup costs:* $20,000–$100,000+ for space, buildout, professional equipment.

*Monthly overhead:* High. Rent ($1,500–$5,000+/month), utilities, payroll, supplies. Total: $5,000–$15,000+/month minimum.

*Revenue potential:* A productive shop can gross $30,000–$80,000+/month with the right team and volume. Much higher ceiling.

*Pros:* Scalable, weather-proof, can serve multiple vehicles simultaneously, buildable brand and location.

*Cons:* High overhead, high risk, management complexity, requires significant capital.

**Our Verdict**

For most people reading this, mobile detailing is the better choice in 2026. The risk is low, you can be profitable in your first month, and you can always open a shop later once you've built a client base and saved capital. Many of the most successful shop owners started mobile.

If you're an experienced operator with capital and team management experience, a shop can generate significantly higher total income. But don't open a shop before you've proven your mobile business first.
    `,
  },
  {
    slug: "online-booking-setup",
    title: "How to Set Up Online Booking for Your Detailing Business",
    category: "How-To",
    date: "Feb 25, 2026",
    readTime: "5 min",
    author: "DetailBook Team",
    body: `
Still taking bookings through Instagram DMs and text messages? You're losing customers every day. People expect to book services online, 24/7, without having to talk to anyone. Here's how to set up professional online booking in under 30 minutes.

**Why You Need Online Booking**

Every time someone has to wait for you to respond before they can book, some percentage of them give up and book someone else. Online booking captures customers while they're ready to buy — at 10pm on a Sunday, at their work desk during lunch, whenever the mood strikes.

It also creates a paper trail: confirmation messages, deposit collection, and reminder automation all happen without you lifting a finger.

**Step 1: Sign Up for DetailBook**

Go to detailbook.app and start your free 7-day trial. Card required, cancel anytime.

**Step 2: Set Up Your Services**

Click "Services & Packages" and add your services. For each service, set a name, description, price, and estimated duration. Start with 2–3 core services — you can always add more later.

**Step 3: Configure Your Deposit Settings**

In Settings > Deposits, enable deposit collection. Set the deposit amount (we recommend $25–$30 flat or 25% of service price). Connect your Stripe account so deposits go directly to your bank.

**Step 4: Customize Your Booking Page**

Add your business name, logo, service area, hours, and a short bio. Upload a professional photo or your best before/after shot as your cover image.

**Step 5: Share Your Booking Link**

Your booking page is live at detailbook.app/book/[your-handle]. Share it everywhere:
- Instagram bio link
- Google Business Profile website field
- Nextdoor and Facebook group posts
- Your business cards
- Email signature

**Step 6: Enable SMS Reminders**

In Dashboard > Messages, enable the 2-hour reminder. These are sent automatically — you don't have to do anything. This step alone will cut your no-shows significantly.

That's it. You now have a professional booking system that looks great, collects deposits, and reminds customers automatically. What used to take 20 text messages now takes 2 minutes.
    `,
  },
  {
    slug: "5-star-google-reviews",
    title: "How to Get 5-Star Google Reviews for Your Detailing Business",
    category: "Marketing",
    date: "Feb 22, 2026",
    readTime: "4 min",
    author: "DetailBook Team",
    body: `
Google reviews are the single most powerful form of social proof for a local service business. A detailer with 50 five-star reviews will get 5x more calls than one with 10 reviews — even if the work quality is identical. Here's the exact system to build your review base fast.

**Why Reviews Matter So Much**

When someone searches "mobile detailer near me," Google shows a map with 3 businesses. The businesses with more reviews, more recent reviews, and higher ratings consistently appear first. This is free, ongoing advertising worth thousands of dollars a month.

**Step 1: Create and Fully Optimize Your Google Business Profile**

If you haven't done this already, it's your first priority. Go to business.google.com and claim or create your listing. Fill out every single field: business category, hours, service area, phone number, website, photos of your work.

**Step 2: Get Your Direct Review Link**

In your Google Business dashboard, find the "Get more reviews" option. Copy your direct review link. This takes customers straight to the review form without any extra steps.

**Step 3: Ask Every Single Customer**

The biggest mistake detailers make is not asking. After every detail, say something like: "If you're happy with the work, I'd really appreciate a quick Google review — it takes about 30 seconds and helps my small business a lot."

People who are satisfied with a service are usually happy to leave a review when asked directly.

**Step 4: Send the Link via Text Within 2 Hours**

While the experience is still fresh, send a short text: "So glad you loved the detail! If you have 30 seconds, a Google review means the world: [your direct link]"

Timing is critical. Reviews drop off sharply if you wait more than a few hours.

**Step 5: Respond to Every Review**

Respond to every review — positive and negative. For positive reviews, thank them by name and mention a specific detail. For negative reviews, respond professionally and offer to make it right. Responses show future customers that you're engaged and care about your work.

**Your Goal: 5 Reviews Per Month**

At that pace, you'll have 60 reviews in a year. Combined with your Google Business optimization, you'll consistently appear in the top 3 map results for your area — generating a steady stream of inbound customers without spending a dollar on ads.
    `,
  },
];

const categoryColors: Record<string, string> = {
  "Business Tips": "bg-blue-500/15 text-blue-400 border-blue-500/25",
  "Reviews":       "bg-purple-500/15 text-purple-400 border-purple-500/25",
  "How-To":        "bg-green-500/15 text-green-400 border-green-500/25",
  "Resources":     "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  "Marketing":     "bg-pink-500/15 text-pink-400 border-pink-500/25",
  "Getting Started":"bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
};

function renderBody(body: string) {
  const paragraphs = body.trim().split("\n\n");
  return paragraphs.map((para, i) => {
    if (para.startsWith("**") && para.endsWith("**") && !para.slice(2).includes("\n")) {
      return (
        <h3 key={i} className="text-xl font-bold text-white mt-8 mb-3">
          {para.replace(/\*\*/g, "")}
        </h3>
      );
    }
    // inline bold
    const parts = para.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="text-gray-300 leading-relaxed mb-4">
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={j} className="text-white font-semibold">{part.replace(/\*\*/g, "")}</strong>
          ) : (
            part
          )
        )}
      </p>
    );
  });
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = posts.find((p) => p.slug === params.slug);
  if (!post) return notFound();

  const otherPosts = posts.filter((p) => p.slug !== params.slug).slice(0, 3);

  return (
    <SiteLayout>
      {/* ── Hero ── */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[#080c18]" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] bg-blue-600/15 rounded-full blur-[100px] animate-blobFloat" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-sm font-semibold mb-8 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
            </svg>
            Back to Blog
          </Link>
          <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-lg border mb-5 ${categoryColors[post.category] ?? "bg-gray-500/15 text-gray-400 border-gray-500/25"}`}>
            {post.category}
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight mb-6">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-xs">
                AR
              </div>
              <span className="text-white font-semibold">{post.author}</span>
            </div>
            <span className="text-gray-600">•</span>
            <span>{post.date}</span>
            <span className="text-gray-600">•</span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {post.readTime} read
            </span>
          </div>
        </div>
      </section>

      {/* ── Content + Sidebar ── */}
      <section className="py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-12">
            {/* Article */}
            <article className="flex-1 max-w-3xl">
              <div className="bg-slate-800/40 border border-white/10 rounded-2xl p-8 sm:p-10">
                {renderBody(post.body)}
              </div>

              {/* CTA */}
              <div className="mt-10 bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 rounded-2xl p-8 text-center">
                <h3 className="text-2xl font-black text-white mb-3">
                  Ready to try DetailBook free?
                </h3>
                <p className="text-gray-400 mb-6">
                  Start your free 7-day trial. Card required, cancel anytime.
                </p>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-7 py-3.5 rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/25 hover:-translate-y-0.5"
                >
                  Start Your 30-Day Free Trial
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </article>

            {/* Sidebar */}
            <aside className="lg:w-72 shrink-0">
              <div className="sticky top-24">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
                  More Articles
                </h3>
                <div className="space-y-4">
                  {otherPosts.map((p) => (
                    <Link
                      key={p.slug}
                      href={`/blog/${p.slug}`}
                      className="block bg-slate-800/60 border border-white/10 rounded-xl p-4 hover:border-blue-500/30 hover:-translate-y-0.5 transition-all duration-200"
                    >
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${categoryColors[p.category] ?? "bg-gray-500/15 text-gray-400 border-gray-500/25"}`}>
                        {p.category}
                      </span>
                      <p className="text-white text-sm font-semibold mt-2 mb-1 leading-snug">{p.title}</p>
                      <p className="text-xs text-gray-500">{p.date} · {p.readTime} read</p>
                    </Link>
                  ))}
                </div>

                {/* Back to blog */}
                <Link
                  href="/blog"
                  className="mt-6 flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white text-sm font-semibold py-3 px-4 rounded-xl transition-all duration-200"
                >
                  View All Articles
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
