import PublicDiscussionDetailPage from "./_page.client";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <PublicDiscussionDetailPage />;
}
