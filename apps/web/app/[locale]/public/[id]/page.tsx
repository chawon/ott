"use client";

import { useParams } from "next/navigation";
import PublicDiscussionDetail from "@/components/PublicDiscussionDetail";

export default function PublicDiscussionDetailPage() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const discussionId = Array.isArray(rawId) ? rawId[0] : rawId;

  return (
    <PublicDiscussionDetail key={discussionId} discussionId={discussionId} />
  );
}
