import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/lib/blog-posts";

// Served as plain XML at https://detailbookapp.com/sitemap.xml (Next renders
// app/sitemap.ts there with HTTP 200 — no JavaScript needed by the crawler).
// Lists ONLY public, indexable, canonical URLs (https, non-www, no trailing
// slash). Excludes dashboard/auth/api, per-user /book pages, /checkout, and
// staff/admin. New blog posts added to lib/blog-posts.ts appear here
// automatically.

const SITE = "https://detailbookapp.com";

// Generate at build time as a static file (best for crawlers + caching).
export const dynamic = "force-static";

type StaticPage = {
  path: string;
  priority: number;
  changeFrequency: "weekly" | "monthly" | "yearly";
};

const STATIC_PAGES: StaticPage[] = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/blog", priority: 0.8, changeFrequency: "weekly" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.6, changeFrequency: "monthly" },
  { path: "/support", priority: 0.6, changeFrequency: "monthly" },
  { path: "/how-to-use", priority: 0.5, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/refund", priority: 0.3, changeFrequency: "yearly" },
  { path: "/cookies", priority: 0.3, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map((p) => ({
    url: `${SITE}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  const blogEntries: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => {
    const parsed = new Date(post.date);
    return {
      url: `${SITE}/blog/${post.slug}`,
      lastModified: Number.isNaN(parsed.getTime()) ? now : parsed,
      changeFrequency: "monthly",
      priority: 0.7,
    };
  });

  return [...staticEntries, ...blogEntries];
}
