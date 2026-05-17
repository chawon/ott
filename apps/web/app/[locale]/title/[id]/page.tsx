import TitleDetailPage from "./_page.client";

export function generateStaticParams() {
  return process.env.AIT_BUILD === "true" ? [{ id: "__placeholder__" }] : [];
}

export default function TitleDetailRoute() {
  return <TitleDetailPage />;
}
