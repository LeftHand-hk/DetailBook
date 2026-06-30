// Single source of truth for the blog post LIST (slug + index metadata).
// Both the blog index (/blog) and the sitemap read from here, so adding a
// new entry automatically lists it on the index AND in sitemap.xml. The full
// article body lives in app/blog/[slug]/page.tsx keyed by the same slug.

export type BlogPostMeta = {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  date: string;     // human label, e.g. "Mar 18, 2026"
  readTime: string; // e.g. "6 min"
};

export const BLOG_POSTS: BlogPostMeta[] = [
  {
    slug: "how-to-stop-no-shows",
    title: "How to Stop No-Shows in Your Detailing Business (5 Proven Methods)",
    category: "Business Tips",
    excerpt: "No-shows are the #1 profit killer for mobile detailers. Here's exactly how to eliminate them.",
    date: "Mar 18, 2026",
    readTime: "6 min",
  },
  {
    slug: "best-scheduling-software-2026",
    title: "Best Scheduling Software for Mobile Auto Detailers in 2026",
    category: "Reviews",
    excerpt: "We compared every booking tool on the market. Here's what actually works for detailers.",
    date: "Mar 15, 2026",
    readTime: "8 min",
  },
  {
    slug: "deposit-policy-guide",
    title: "How to Create a Deposit Policy for Your Detailing Business",
    category: "How-To",
    excerpt: "A solid deposit policy protects your time and income. Here's how to write one.",
    date: "Mar 12, 2026",
    readTime: "5 min",
  },
  {
    slug: "auto-detailing-price-list",
    title: "Auto Detailing Price List Template (Free Download)",
    category: "Resources",
    excerpt: "A proven pricing structure template built for mobile detailers.",
    date: "Mar 10, 2026",
    readTime: "4 min",
  },
  {
    slug: "get-more-detailing-customers",
    title: "7 Ways to Get More Detailing Customers Without Cold Calling",
    category: "Marketing",
    excerpt: "Build a steady stream of bookings using these proven, low-cost strategies.",
    date: "Mar 7, 2026",
    readTime: "7 min",
  },
  {
    slug: "start-mobile-detailing-business",
    title: "The Complete Guide to Starting a Mobile Auto Detailing Business",
    category: "Getting Started",
    excerpt: "Everything you need to know to launch your mobile detailing business in 2026.",
    date: "Mar 4, 2026",
    readTime: "12 min",
  },
  {
    slug: "mobile-vs-shop-detailing",
    title: "Mobile Detailing vs. Shop Detailing: Which is More Profitable?",
    category: "Business Tips",
    excerpt: "A full breakdown of costs, revenue, and lifestyle for both models.",
    date: "Feb 28, 2026",
    readTime: "6 min",
  },
  {
    slug: "online-booking-setup",
    title: "How to Set Up Online Booking for Your Detailing Business",
    category: "How-To",
    excerpt: "Step-by-step guide to accepting online bookings in under 30 minutes.",
    date: "Feb 25, 2026",
    readTime: "5 min",
  },
  {
    slug: "5-star-google-reviews",
    title: "How to Get 5-Star Google Reviews for Your Detailing Business",
    category: "Marketing",
    excerpt: "Reviews drive new customers. Here's the exact system to get more of them.",
    date: "Feb 22, 2026",
    readTime: "4 min",
  },
];
