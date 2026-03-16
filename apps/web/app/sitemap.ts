import type { MetadataRoute } from "next";

const baseUrl = "https://ottline.app";

// Update this date when content pages are meaningfully changed
const CONTENT_DATE = new Date("2026-03-16");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: baseUrl,
      lastModified: CONTENT_DATE,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: CONTENT_DATE,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: CONTENT_DATE,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/public`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date("2026-02-14"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
