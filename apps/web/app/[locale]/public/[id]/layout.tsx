import type { Metadata } from "next";
import { privateRouteMetadata } from "@/lib/seo";

export const metadata: Metadata = privateRouteMetadata;

export default function PublicDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
