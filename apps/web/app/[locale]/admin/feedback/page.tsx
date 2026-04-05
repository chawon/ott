import { notFound } from "next/navigation";
import AdminFeedbackConsole from "@/components/AdminFeedbackConsole";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readToken(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) return value[0];
  return null;
}

export default async function AdminFeedbackPage({ searchParams }: Props) {
  if (process.env.AIT_BUILD === "true") notFound();
  const sParams = searchParams ? await searchParams : {};
  const token = readToken(sParams?.token);
  const expected =
    process.env.ADMIN_FEEDBACK_TOKEN ??
    process.env.ADMIN_ANALYTICS_TOKEN ??
    null;

  if (!expected || token !== expected) {
    notFound();
  }

  return <AdminFeedbackConsole token={token} />;
}
