import { Suspense } from "react";
import FeedbackPageClient from "./_page.client";

export default function FeedbackPage() {
  return (
    <Suspense fallback={null}>
      <FeedbackPageClient />
    </Suspense>
  );
}
