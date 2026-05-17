import PublicDiscussionDetailPage from "./_page.client";

export function generateStaticParams() {
  return process.env.AIT_BUILD === "true" ? [{ id: "__placeholder__" }] : [];
}

export default function PublicDiscussionDetailRoute() {
  return <PublicDiscussionDetailPage />;
}
