import type { Metadata } from "next";
import { privateRouteMetadata } from "@/lib/seo";

export const metadata: Metadata = privateRouteMetadata;

export default function TitleDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
