import { buildSoftwareApplicationSchema } from "@/lib/seo";

export default function SoftwareApplicationJsonLd({
  locale,
  description,
}: {
  locale: string;
  description: string;
}) {
  const schema = buildSoftwareApplicationSchema({ locale, description });

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is serialized from a closed local object.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
