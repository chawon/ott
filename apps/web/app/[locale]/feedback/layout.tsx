import type { Metadata } from "next";
import { privateRouteMetadata } from "@/lib/seo";

export const metadata: Metadata = privateRouteMetadata;

export default function FeedbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
