import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Explicitly allow Meta crawlers — they fetch the homepage for
      // domain verification and link previews. Listed first so they
      // are matched ahead of the catch-all "User-agent: *" below.
      { userAgent: "facebookexternalhit", allow: "/" },
      { userAgent: "Facebot", allow: "/" },
      // General rules: index marketing pages, keep authed/admin/api out.
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/dashboard", "/staff", "/api"],
      },
    ],
    sitemap: "https://detailbookapp.com/sitemap.xml",
  };
}
