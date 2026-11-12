import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

// Read at request time: the public origin comes from the environment of the running container.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api", "/admin", "/cabinet", "/*/admin", "/*/cabinet"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
