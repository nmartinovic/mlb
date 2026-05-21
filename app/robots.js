const SITE_URL = process.env.SITE_URL || "https://ninthinning.email";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/architecture.html"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
