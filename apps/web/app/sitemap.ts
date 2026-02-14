import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://ott.preview.pe.kr"; // 실제 운영 URL

  const routes = ["", "/timeline", "/public", "/account", "/about", "/faq", "/privacy"].map(
    (route) => ({
      url: `${baseUrl}${route}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: route === "" ? 1 : 0.8,
    })
  );

  return [...routes];
}
