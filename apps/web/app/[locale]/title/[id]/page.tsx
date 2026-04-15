import TitlePageClient from "./_page.client";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function TitlePage() {
  return <TitlePageClient />;
}
