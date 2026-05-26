import { MLB_TEAMS } from "@/lib/teams";

const SITE_URL = process.env.SITE_URL || "https://ninthinning.email";

export default function sitemap() {
  return [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...MLB_TEAMS.map((t) => ({
      url: `${SITE_URL}/teams/${t.slug}`,
      changeFrequency: "monthly",
      priority: 0.7,
    })),
    {
      url: `${SITE_URL}/recaps`,
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
