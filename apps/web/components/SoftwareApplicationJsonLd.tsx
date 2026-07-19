import { localizedUrl } from "@/lib/seo";

export default function SoftwareApplicationJsonLd({
  locale,
  description,
}: {
  locale: string;
  description: string;
}) {
  const isEnglish = locale === "en";
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ottline",
    url: localizedUrl(locale),
    description,
    inLanguage: isEnglish ? "en-US" : "ko-KR",
    applicationCategory: "LifestyleApplication",
    applicationSubCategory: "Entertainment",
    operatingSystem: "Web, Android, iOS, Windows",
    image: "https://ottline.app/icon.png",
    screenshot: [
      "https://ottline.app/pwa/screenshot-desktop-wide.png",
      "https://ottline.app/pwa/screenshot-mobile-narrow.png",
    ],
    offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
    isAccessibleForFree: true,
    featureList: isEnglish
      ? [
          "Start video and book logs without sign-up",
          "Local-first storage",
          "Personal timeline",
          "Pairing-code sync",
          "CSV export",
        ]
      : [
          "가입 없이 시작하는 영상·책 기록",
          "로컬 퍼스트 저장",
          "개인 타임라인",
          "페어링 코드 동기화",
          "CSV 내보내기",
        ],
  };

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is serialized from a closed local object.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
