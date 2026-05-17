export function generateStaticParams() {
  return process.env.AIT_BUILD === "true" ? [{ id: "__placeholder__" }] : [];
}

export default function PublicDiscussionDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
